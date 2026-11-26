import { and, eq, sql } from 'drizzle-orm';
import type { PrDetail, PrMeta } from '@devdigest/shared';
import type { DbOrTx } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type {
  PullRecord,
  PullStats,
  PullsPort,
  PullsRepoRef,
  StoredPullDetail,
} from './ports.js';

type PullRow = typeof t.pullRequests.$inferSelect;

function toPullRecord(r: PullRow): PullRecord {
  return {
    id: r.id,
    repoId: r.repoId,
    number: r.number,
    title: r.title,
    author: r.author,
    branch: r.branch,
    base: r.base,
    headSha: r.headSha,
    lastReviewedSha: r.lastReviewedSha,
    additions: r.additions,
    deletions: r.deletions,
    filesCount: r.filesCount,
    status: r.status,
    body: r.body,
    openedAt: r.openedAt,
    updatedAt: r.updatedAt,
  };
}

const toDate = (iso: string | null | undefined): Date | null => (iso ? new Date(iso) : null);

/**
 * Drizzle implementation of `PullsPort`: `pull_requests`, `pr_files`,
 * `pr_commits` (plus the `repos` lookup and `last_polled_at` stamp the pulls
 * flows need). Workspace-scoped where the caller passes a workspace id.
 */
export class DrizzlePullsRepository implements PullsPort {
  constructor(private db: DbOrTx) {}

  async findRepo(workspaceId: string, repoId: string): Promise<PullsRepoRef | null> {
    const [row] = await this.db
      .select({ id: t.repos.id, owner: t.repos.owner, name: t.repos.name })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row ?? null;
  }

  async findPull(
    workspaceId: string,
    prId: string,
  ): Promise<{ pull: PullRecord; repo: PullsRepoRef | null } | null> {
    const [pull] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    if (!pull) return null;
    const [repo] = await this.db
      .select({ id: t.repos.id, owner: t.repos.owner, name: t.repos.name })
      .from(t.repos)
      .where(eq(t.repos.id, pull.repoId));
    return { pull: toPullRecord(pull), repo: repo ?? null };
  }

  async upsertMany(workspaceId: string, repoId: string, prs: PrMeta[]): Promise<void> {
    // One row per PR number: Postgres rejects an upsert that touches the same
    // row twice in one statement, so a duplicated number keeps its last entry.
    const byNumber = new Map(prs.map((pr) => [pr.number, pr]));
    if (byNumber.size === 0) return;
    await this.db
      .insert(t.pullRequests)
      .values(
        [...byNumber.values()].map((pr) => ({
          workspaceId,
          repoId,
          number: pr.number,
          title: pr.title,
          author: pr.author,
          branch: pr.branch,
          base: pr.base,
          headSha: pr.head_sha,
          additions: pr.additions,
          deletions: pr.deletions,
          filesCount: pr.files_count,
          status: pr.status,
          openedAt: toDate(pr.opened_at),
          updatedAt: toDate(pr.updated_at),
        })),
      )
      .onConflictDoUpdate({
        target: [t.pullRequests.repoId, t.pullRequests.number],
        // Only GitHub-owned, list-reported fields move on a re-sync; diff stats
        // and body come from the detail endpoint and stay as stored.
        set: {
          title: sql`excluded.title`,
          headSha: sql`excluded.head_sha`,
          status: sql`excluded.status`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async listForRepo(repoId: string): Promise<PullRecord[]> {
    const rows = await this.db
      .select()
      .from(t.pullRequests)
      .where(eq(t.pullRequests.repoId, repoId));
    return rows.map(toPullRecord);
  }

  async updateStats(prId: string, stats: PullStats): Promise<void> {
    await this.db
      .update(t.pullRequests)
      .set({ additions: stats.additions, deletions: stats.deletions, filesCount: stats.filesCount })
      .where(eq(t.pullRequests.id, prId));
  }

  async replaceDetail(prId: string, detail: PrDetail): Promise<void> {
    // One transaction (a savepoint when already inside one): a failure part-way
    // never leaves the PR with no files — the previous snapshot stays intact.
    await this.db.transaction(async (tx) => {
      await tx.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
      if (detail.files.length > 0) {
        await tx.insert(t.prFiles).values(
          detail.files.map((f) => ({
            prId,
            path: f.path,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch ?? null,
          })),
        );
      }
      await tx.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
      if (detail.commits.length > 0) {
        await tx.insert(t.prCommits).values(
          detail.commits.map((c) => ({
            prId,
            sha: c.sha,
            message: c.message,
            author: c.author,
            committedAt: toDate(c.committed_at),
          })),
        );
      }
      await tx
        .update(t.pullRequests)
        .set({
          body: detail.body ?? null,
          // Diff stats aren't on GitHub's PR-list payload — backfill them from
          // the detail fetch so the Pull Requests list shows real size/files.
          additions: detail.additions,
          deletions: detail.deletions,
          filesCount: detail.files_count,
        })
        .where(eq(t.pullRequests.id, prId));
    });
  }

  async storedDetail(prId: string): Promise<StoredPullDetail> {
    const files = await this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
    const commits = await this.db.select().from(t.prCommits).where(eq(t.prCommits.prId, prId));
    return {
      files: files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch ?? null,
      })),
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        author: c.author,
        committed_at: c.committedAt?.toISOString() ?? null,
      })),
    };
  }

  async markPolled(repoId: string): Promise<void> {
    await this.db.update(t.repos).set({ lastPolledAt: new Date() }).where(eq(t.repos.id, repoId));
  }
}
