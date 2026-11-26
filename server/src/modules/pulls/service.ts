import type {
  GitHubClient,
  PrCommentInput,
  PrDetail,
  PrMeta,
  PrReviewComment,
  PrStatus,
} from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { PullRecord, PullsRepoRef, PullsServiceDeps } from './ports.js';
import { deriveReviewStatus, sortBriefs, toFindingBrief } from './status.js';

/**
 * Diff stats aren't on GitHub's PR-list payload, so freshly imported PRs land
 * with zeroed size/diff. The list backfills at most this many per request from
 * the detail endpoint; the periodic refetch chips away at any remainder.
 */
export const BACKFILL_LIMIT = 10;

/**
 * F1 — pulls use cases: PR import/sync from GitHub (list + per-PR detail), the
 * PR list rollup (score, findings preview, cost, review status), and the
 * inline review comments proxied live to GitHub. Review triggering is manual
 * and owned by the reviews module; nothing here starts a review.
 *
 * Local-first: reads never fail because GitHub is unreachable — persisted
 * (seeded or previously imported) PRs stay viewable offline. Only the explicit
 * sync (`POST /repos/:id/poll`) and posting a comment need GitHub.
 */
export class PullsService {
  constructor(private deps: PullsServiceDeps) {}

  /** PR list for a repo: sync from GitHub when possible, then serve the stored rows + rollups. */
  async listForRepo(workspaceId: string, repoId: string): Promise<PrMeta[]> {
    const { pulls, log } = this.deps;
    const repo = await this.requireRepo(workspaceId, repoId);

    let gh: GitHubClient | null = null;
    try {
      gh = await this.deps.github();
    } catch (err) {
      log.warn({ err }, 'GitHub client unavailable (no token / offline); serving persisted PRs');
    }

    if (gh) {
      try {
        await pulls.upsertMany(workspaceId, repo.id, await gh.listPullRequests(repo));
      } catch (err) {
        log.warn({ err }, 'GitHub PR sync skipped (no token / offline); serving persisted PRs');
      }
    }

    const rows = await pulls.listForRepo(repo.id);
    if (gh) await this.backfillStats(gh, repo, rows);

    // Latest review per PR: its SCORE drives the score ring and its findings
    // (as briefs) the FINDINGS column + preview. M1 cost = SUM over done runs.
    const prIds = rows.map((r) => r.id);
    const [latest, costs] = await Promise.all([
      this.deps.reviews.latestReviews(prIds),
      this.deps.costs.costByPull(prIds),
    ]);

    const now = Date.now();
    return rows.map((r) => {
      const review = latest.get(r.id);
      return {
        ...toPrFields(
          r,
          deriveReviewStatus({
            ghStatus: r.status,
            lastReviewedSha: r.lastReviewedSha,
            headSha: r.headSha,
            updatedAt: r.updatedAt,
            now,
          }),
        ),
        score: review ? review.score : null,
        latest_findings: review ? sortBriefs(review.findings.map(toFindingBrief)) : null,
        cost_usd: costs.get(r.id) ?? null,
      };
    });
  }

  /**
   * Manual refresh: sync the PR list from GitHub and stamp `last_polled_at`.
   * Unlike the list read, a missing token or GitHub failure is an error here.
   * Never triggers a review.
   */
  async sync(workspaceId: string, repoId: string): Promise<{ synced: number; reviewTriggered: false }> {
    const repo = await this.requireRepo(workspaceId, repoId);
    const gh = await this.deps.github();
    const prs = await gh.listPullRequests(repo);
    await this.deps.pulls.upsertMany(workspaceId, repo.id, prs);
    await this.deps.pulls.markPolled(repo.id);
    return { synced: prs.length, reviewTriggered: false };
  }

  /** Full PR detail: refreshed from GitHub when possible, else the stored snapshot. */
  async getDetail(workspaceId: string, prId: string): Promise<PrDetail> {
    const { pull, repo } = await this.requirePull(workspaceId, prId);
    try {
      const gh = await this.deps.github();
      const detail = await gh.getPullRequest(repo, pull.number);
      await this.deps.pulls.replaceDetail(pull.id, detail);
      return { ...detail, id: pull.id };
    } catch (err) {
      this.deps.log.warn(
        { err },
        'GitHub PR detail refresh skipped (no token / offline); serving persisted detail',
      );
      const stored = await this.deps.pulls.storedDetail(pull.id);
      return {
        ...toPrFields(pull, pull.status as PrDetail['status']),
        body: pull.body ?? null,
        files: stored.files,
        commits: stored.commits,
      };
    }
  }

  /** Inline review comments, live from GitHub; [] when GitHub is unavailable. */
  async listComments(workspaceId: string, prId: string): Promise<PrReviewComment[]> {
    const { pull, repo } = await this.requirePull(workspaceId, prId);
    let gh: GitHubClient;
    try {
      gh = await this.deps.github();
    } catch (err) {
      this.deps.log.warn({ err }, 'GitHub client unavailable; serving no PR comments');
      return [];
    }
    try {
      return await gh.listReviewComments(repo, pull.number);
    } catch (err) {
      this.deps.log.warn({ err }, 'GitHub review-comments fetch skipped (offline / error)');
      return [];
    }
  }

  /** Post one inline comment (or reply) to GitHub on the PR head commit. */
  async createComment(
    workspaceId: string,
    prId: string,
    input: PrCommentInput,
  ): Promise<PrReviewComment> {
    const { pull, repo } = await this.requirePull(workspaceId, prId);
    let gh: GitHubClient;
    try {
      gh = await this.deps.github();
    } catch {
      throw new AppError('github_unavailable', 'Connect a GitHub token to post comments.', 400);
    }
    try {
      return await gh.createReviewComment(repo, pull.number, {
        commitId: pull.headSha,
        path: input.path,
        line: input.line,
        ...(input.side ? { side: input.side } : {}),
        body: input.body,
        ...(input.in_reply_to != null ? { inReplyTo: input.in_reply_to } : {}),
      });
    } catch (err) {
      // GitHub rejects comments on lines outside the diff / on closed PRs (422).
      const msg = err instanceof Error ? err.message : 'Failed to post the comment to GitHub.';
      throw new AppError('github_comment_failed', msg, 400, { cause: String(err) });
    }
  }

  // ---- internals ------------------------------------------------------------

  private async requireRepo(workspaceId: string, repoId: string): Promise<PullsRepoRef> {
    const repo = await this.deps.pulls.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return repo;
  }

  private async requirePull(
    workspaceId: string,
    prId: string,
  ): Promise<{ pull: PullRecord; repo: PullsRepoRef }> {
    const found = await this.deps.pulls.findPull(workspaceId, prId);
    if (!found) throw new NotFoundError('Pull request not found');
    if (!found.repo) throw new NotFoundError('Repo not found');
    return { pull: found.pull, repo: found.repo };
  }

  /** Fill in diff stats for up to BACKFILL_LIMIT zero-stat PRs (in place, concurrently). */
  private async backfillStats(gh: GitHubClient, repo: PullsRepoRef, rows: PullRecord[]): Promise<void> {
    const needStats = rows
      .filter((r) => r.additions === 0 && r.deletions === 0 && r.filesCount === 0)
      .slice(0, BACKFILL_LIMIT);
    await Promise.all(
      needStats.map(async (r) => {
        try {
          const detail = await gh.getPullRequest(repo, r.number);
          const stats = {
            additions: detail.additions,
            deletions: detail.deletions,
            filesCount: detail.files_count,
          };
          await this.deps.pulls.updateStats(r.id, stats);
          Object.assign(r, stats);
        } catch (err) {
          this.deps.log.warn({ err, number: r.number }, 'PR diff-stat backfill skipped');
        }
      }),
    );
  }
}

/** PR fields shared by the list item and the stored detail (`status` decided by the caller). */
function toPrFields(r: PullRecord, status: PrStatus) {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    author: r.author,
    branch: r.branch,
    base: r.base,
    head_sha: r.headSha,
    additions: r.additions,
    deletions: r.deletions,
    files_count: r.filesCount,
    status,
    opened_at: r.openedAt?.toISOString() ?? null,
    updated_at: r.updatedAt?.toISOString() ?? null,
  };
}
