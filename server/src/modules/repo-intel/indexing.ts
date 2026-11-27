/**
 * repo-intel — indexing use case (full, incremental, manual resync) and the
 * job handlers that run it in the background.
 *
 * Studio callers enqueue INDEX / REFRESH / RESYNC jobs (repos/service.ts after
 * a clone, `POST /repos/:id/resync`); the handlers registered by
 * `registerRepoIntelJobHandlers` (from the composition root, `app.ts`) call
 * the methods below inline. Tests / a CI runner can call them directly.
 */
import type { JobQueue, RepoRef } from '@devdigest/shared';
import { INDEX_JOB_KIND, REFRESH_JOB_KIND, RESYNC_JOB_KIND } from './constants.js';
import type { IndexPayload, RepoIndexerDeps } from './ports.js';
import type { IndexResult } from './types.js';
import { runFullIndex } from './pipeline/full.js';
import { runIncremental } from './pipeline/incremental.js';

export class RepoIndexer {
  constructor(private deps: RepoIndexerDeps) {}

  /** Full index of the repo, inline (no enqueue). */
  indexRepo(repoId: string): Promise<IndexResult> {
    return runFullIndex(this.deps, { repoId });
  }

  /**
   * Incremental refresh, inline. Falls back to a full index when the persisted
   * state is missing or its `indexerVersion` is stale.
   */
  refreshIndex(repoId: string): Promise<IndexResult> {
    return runIncremental(this.deps, { repoId });
  }

  /**
   * Manual "re-analyze": advance the clone to `origin/<defaultBranch>` (so the
   * index reflects the latest code), then run an incremental refresh. The
   * incremental pass falls back to a full reindex internally when the diff base
   * is unreachable or the indexer version moved, so this is always
   * correct — never a destructive re-clone. Degrades (never throws) when the
   * repo isn't cloned yet or the fetch fails.
   */
  async resyncRepo(repoId: string): Promise<IndexResult> {
    const startedAt = Date.now();
    const repo = await this.deps.store.getRepoBasics(repoId);
    if (!repo || !repo.clonePath) {
      return { status: 'degraded', filesIndexed: 0, filesSkipped: 0, durationMs: Date.now() - startedAt, reason: 'no_clone' };
    }
    const ref: RepoRef = { owner: repo.owner, name: repo.name };
    try {
      await this.deps.git.sync(ref, repo.defaultBranch);
    } catch (err) {
      return {
        status: 'degraded',
        filesIndexed: 0,
        filesSkipped: 0,
        durationMs: Date.now() - startedAt,
        reason: `sync_failed:${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return runIncremental(this.deps, { repoId });
  }
}

/** The indexing operations a job handler needs. */
export type RepoIndexing = Pick<RepoIndexer, 'indexRepo' | 'refreshIndex' | 'resyncRepo'>;

/**
 * Register the INDEX / REFRESH / RESYNC handlers. Called once from the
 * composition root. `indexer` is resolved per job, so building the app does
 * not construct the indexer's adapters.
 *
 * The handlers swallow the IndexResult on purpose (a job handler resolves to
 * `void`); status / progress is observable via `repo_index_state`.
 */
export function registerRepoIntelJobHandlers(
  jobs: Pick<JobQueue, 'register'>,
  indexer: () => RepoIndexing,
): void {
  jobs.register(INDEX_JOB_KIND, async (payload) => {
    await indexer().indexRepo((payload as IndexPayload).repoId);
  });
  jobs.register(REFRESH_JOB_KIND, async (payload) => {
    await indexer().refreshIndex((payload as IndexPayload).repoId);
  });
  jobs.register(RESYNC_JOB_KIND, async (payload) => {
    await indexer().resyncRepo((payload as IndexPayload).repoId);
  });
}
