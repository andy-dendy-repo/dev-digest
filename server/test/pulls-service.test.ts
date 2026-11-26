import { describe, it, expect } from 'vitest';
import type { PrDetail, PrMeta } from '@devdigest/shared';
import { MockGitHubClient } from '../src/adapters/mocks.js';
import { ConfigError, NotFoundError } from '../src/platform/errors.js';
import { BACKFILL_LIMIT, PullsService } from '../src/modules/pulls/service.js';
import type {
  LatestReviewSummary,
  PullRecord,
  PullsPort,
  PullsRepoRef,
  StoredPullDetail,
} from '../src/modules/pulls/ports.js';

/** Hermetic use-case tests: PullsService over in-memory port fakes (no DB, no network). */

const REPO: PullsRepoRef = { id: 'repo-1', owner: 'acme', name: 'api' };

function pullRecord(over: Partial<PullRecord> = {}): PullRecord {
  return {
    id: `pr-${over.number ?? 1}`,
    repoId: REPO.id,
    number: 1,
    title: 'T',
    author: 'a',
    branch: 'b',
    base: 'main',
    headSha: 'sha',
    lastReviewedSha: null,
    additions: 1,
    deletions: 1,
    filesCount: 1,
    status: 'open',
    body: null,
    openedAt: null,
    updatedAt: null,
    ...over,
  };
}

function prMeta(number: number): PrMeta {
  return {
    number,
    title: `PR ${number}`,
    author: 'a',
    branch: 'b',
    base: 'main',
    head_sha: `sha-${number}`,
    additions: 0,
    deletions: 0,
    files_count: 0,
    status: 'open',
  };
}

/** In-memory PullsPort: PRs keyed by number within one repo. */
class FakePulls implements PullsPort {
  rows: PullRecord[] = [];
  stored: StoredPullDetail = { files: [], commits: [] };
  replaced: { prId: string; detail: PrDetail }[] = [];
  polled: string[] = [];
  statsUpdates: string[] = [];

  async findRepo(_ws: string, repoId: string) {
    return repoId === REPO.id ? REPO : null;
  }
  async findPull(_ws: string, prId: string) {
    const pull = this.rows.find((r) => r.id === prId);
    return pull ? { pull, repo: REPO } : null;
  }
  async upsertMany(_ws: string, repoId: string, prs: PrMeta[]) {
    for (const pr of prs) {
      const existing = this.rows.find((r) => r.number === pr.number);
      if (existing) Object.assign(existing, { title: pr.title, headSha: pr.head_sha });
      else
        this.rows.push(
          pullRecord({
            id: `pr-${pr.number}`,
            repoId,
            number: pr.number,
            title: pr.title,
            headSha: pr.head_sha,
            additions: pr.additions,
            deletions: pr.deletions,
            filesCount: pr.files_count,
          }),
        );
    }
  }
  async listForRepo() {
    return this.rows.map((r) => ({ ...r }));
  }
  async updateStats(prId: string) {
    this.statsUpdates.push(prId);
  }
  async replaceDetail(prId: string, detail: PrDetail) {
    this.replaced.push({ prId, detail });
  }
  async storedDetail() {
    return this.stored;
  }
  async markPolled(repoId: string) {
    this.polled.push(repoId);
  }
}

function makeService(opts: {
  pulls?: FakePulls;
  github?: MockGitHubClient | null;
  latest?: Map<string, LatestReviewSummary>;
  costs?: Map<string, number>;
}) {
  const pulls = opts.pulls ?? new FakePulls();
  const warnings: string[] = [];
  const service = new PullsService({
    pulls,
    reviews: { latestReviews: async () => opts.latest ?? new Map() },
    costs: { costByPull: async () => opts.costs ?? new Map() },
    github: async () => {
      if (opts.github === null) throw new ConfigError('GITHUB_TOKEN is not configured');
      return opts.github ?? new MockGitHubClient();
    },
    log: { warn: (_obj, msg) => warnings.push(msg ?? '') },
  });
  return { service, pulls, warnings };
}

describe('PullsService.listForRepo', () => {
  it('unknown repo → NotFoundError', async () => {
    const { service } = makeService({});
    await expect(service.listForRepo('ws', 'nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('syncs from GitHub, then rolls up score, sorted findings briefs and cost', async () => {
    const pulls = new FakePulls();
    pulls.rows.push(pullRecord({ number: 1, lastReviewedSha: 'sha', headSha: 'sha' }));
    const latest = new Map<string, LatestReviewSummary>([
      [
        'pr-1',
        {
          score: 70,
          findings: [
            { id: 'f-w', severity: 'WARNING', category: 'bug', title: 'w', file: 'a.ts', startLine: 1, endLine: 1, confidence: 0.9, rationale: 'r' },
            { id: 'f-c', severity: 'CRITICAL', category: 'security', title: 'c', file: 'a.ts', startLine: 2, endLine: 2, confidence: 0.5, rationale: 'r' },
          ],
        },
      ],
    ]);
    const { service } = makeService({
      pulls,
      github: new MockGitHubClient({ pulls: [prMeta(2)] }),
      latest,
      costs: new Map([['pr-1', 0.25]]),
    });

    const list = await service.listForRepo('ws', REPO.id);

    expect(list.map((p) => p.number).sort()).toEqual([1, 2]);
    const one = list.find((p) => p.number === 1)!;
    expect(one.status).toBe('reviewed');
    expect(one.score).toBe(70);
    expect(one.latest_findings!.map((f) => f.id)).toEqual(['f-c', 'f-w']);
    expect(one.cost_usd).toBe(0.25);
    const two = list.find((p) => p.number === 2)!;
    expect(two).toMatchObject({ status: 'needs_review', score: null, latest_findings: null, cost_usd: null });
  });

  it('serves persisted PRs when GitHub is not configured (no sync, no backfill)', async () => {
    const pulls = new FakePulls();
    pulls.rows.push(pullRecord({ number: 1, additions: 0, deletions: 0, filesCount: 0 }));
    const { service, warnings } = makeService({ pulls, github: null });

    const list = await service.listForRepo('ws', REPO.id);

    expect(list).toHaveLength(1);
    expect(pulls.statsUpdates).toEqual([]);
    expect(warnings[0]).toContain('GitHub client unavailable');
  });

  it(`backfills diff stats for at most ${BACKFILL_LIMIT} zero-stat PRs per request`, async () => {
    const pulls = new FakePulls();
    for (let n = 1; n <= BACKFILL_LIMIT + 3; n++) {
      pulls.rows.push(pullRecord({ id: `pr-${n}`, number: n, additions: 0, deletions: 0, filesCount: 0 }));
    }
    const { service } = makeService({ pulls, github: new MockGitHubClient({ pulls: [] }) });

    const list = await service.listForRepo('ws', REPO.id);

    expect(pulls.statsUpdates).toHaveLength(BACKFILL_LIMIT);
    // Backfilled rows report the detail's stats in this very response.
    expect(list.filter((p) => p.additions === 247)).toHaveLength(BACKFILL_LIMIT);
  });
});

describe('PullsService.sync (polling)', () => {
  it('upserts the GitHub list and stamps last_polled_at; never triggers a review', async () => {
    const { service, pulls } = makeService({
      github: new MockGitHubClient({ pulls: [prMeta(1), prMeta(2)] }),
    });
    expect(await service.sync('ws', REPO.id)).toEqual({ synced: 2, reviewTriggered: false });
    expect(pulls.rows).toHaveLength(2);
    expect(pulls.polled).toEqual([REPO.id]);
  });

  it('fails (unlike the list read) when no GitHub token is configured', async () => {
    const { service, pulls } = makeService({ github: null });
    await expect(service.sync('ws', REPO.id)).rejects.toBeInstanceOf(ConfigError);
    expect(pulls.polled).toEqual([]);
  });
});

describe('PullsService.getDetail', () => {
  it('refreshes from GitHub and persists the detail', async () => {
    const pulls = new FakePulls();
    pulls.rows.push(pullRecord({ number: 5 }));
    const { service } = makeService({ pulls });
    const detail = await service.getDetail('ws', 'pr-5');
    expect(detail.id).toBe('pr-5');
    expect(pulls.replaced.map((r) => r.prId)).toEqual(['pr-5']);
  });

  it('falls back to the stored snapshot (GitHub merge state kept) when GitHub is unavailable', async () => {
    const pulls = new FakePulls();
    pulls.rows.push(pullRecord({ number: 5, status: 'merged', body: 'b' }));
    pulls.stored = {
      files: [{ path: 'a.ts', additions: 1, deletions: 0, patch: null }],
      commits: [],
    };
    const { service } = makeService({ pulls, github: null });
    const detail = await service.getDetail('ws', 'pr-5');
    expect(detail).toMatchObject({ id: 'pr-5', status: 'merged', body: 'b' });
    expect(detail.files.map((f) => f.path)).toEqual(['a.ts']);
  });

  it('unknown PR → NotFoundError', async () => {
    const { service } = makeService({});
    await expect(service.getDetail('ws', 'missing')).rejects.toThrow('Pull request not found');
  });
});

describe('PullsService comments', () => {
  it('no GitHub → [] when listing, 400 github_unavailable when posting', async () => {
    const pulls = new FakePulls();
    pulls.rows.push(pullRecord({ number: 5 }));
    const { service } = makeService({ pulls, github: null });
    expect(await service.listComments('ws', 'pr-5')).toEqual([]);
    await expect(
      service.createComment('ws', 'pr-5', { path: 'a.ts', line: 1, body: 'x' }),
    ).rejects.toMatchObject({ code: 'github_unavailable', statusCode: 400 });
  });

  it('posts on the PR head commit', async () => {
    const pulls = new FakePulls();
    pulls.rows.push(pullRecord({ number: 5, headSha: 'head-5' }));
    const gh = new MockGitHubClient();
    const { service } = makeService({ pulls, github: gh });
    await service.createComment('ws', 'pr-5', { path: 'a.ts', line: 3, body: 'nit' });
    expect(gh.createdComments[0]).toMatchObject({ commitId: 'head-5', path: 'a.ts', line: 3 });
  });
});
