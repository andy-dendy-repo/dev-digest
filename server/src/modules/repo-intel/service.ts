/**
 * RepoIntelService — the `RepoIntel` facade every consumer codes against.
 *
 * A thin delegator over the module's use cases, each with its own narrow deps:
 *   - indexing        `RepoIndexer`                 (indexing.ts → pipeline/)
 *   - blast radius    `BlastRadiusQuery`            (blast.ts)
 *   - callers digest  `CallerSignaturesQuery`       (callers.ts)
 *   - phantom gate    `UnresolvedReferencesQuery`   (phantom.ts)
 *   - index reads     `IndexQueries`                (index-queries.ts)
 *
 * DEGRADED CONTRACT (types.ts header): no read throws for a missing index,
 * clone or disabled flag — arrays come back `[]`, objects carry `degraded`.
 * `getIndexState` always answers, synthesising a degraded row when none exists.
 *
 * Built in the composition root (`platform/container.ts`) from ports; tests
 * pass fakes of `RepoIntelServiceDeps` directly.
 */
import { BlastRadiusQuery } from './blast.js';
import { CallerSignaturesQuery } from './callers.js';
import { INDEXER_VERSION, MAX_CALLERS_PER_SYMBOL } from './constants.js';
import { IndexQueries } from './index-queries.js';
import { RepoIndexer } from './indexing.js';
import { UnresolvedReferencesQuery } from './phantom.js';
import type { RepoIntelServiceDeps, RepoIntelStore } from './ports.js';
import type {
  BlastResult,
  FileRankRow,
  IndexResult,
  IndexState,
  RefRow,
  RepoIntel,
  RepoMapResult,
  SignatureRow,
  SymbolRow,
} from './types.js';

export class RepoIntelService implements RepoIntel {
  private readonly store: RepoIntelStore;
  private readonly indexer: RepoIndexer;
  private readonly blast: BlastRadiusQuery;
  private readonly callers: CallerSignaturesQuery;
  private readonly phantom: UnresolvedReferencesQuery;
  private readonly queries: IndexQueries;

  constructor(deps: RepoIntelServiceDeps) {
    this.store = deps.store;
    this.indexer = new RepoIndexer(deps);
    this.blast = new BlastRadiusQuery(deps);
    this.callers = new CallerSignaturesQuery(deps);
    this.phantom = new UnresolvedReferencesQuery(deps);
    this.queries = new IndexQueries(deps);
  }

  // --- Indexing (inline; studio runs these from job handlers) --------------

  indexRepo(repoId: string): Promise<IndexResult> {
    return this.indexer.indexRepo(repoId);
  }

  refreshIndex(repoId: string): Promise<IndexResult> {
    return this.indexer.refreshIndex(repoId);
  }

  /** Fetch latest from origin, then refresh incrementally (never re-clones). */
  resyncRepo(repoId: string): Promise<IndexResult> {
    return this.indexer.resyncRepo(repoId);
  }

  /**
   * ALWAYS works. If `repo_index_state` has a row, returns it. Otherwise
   * synthesises a degraded row so callers can branch on `degraded` without
   * ever hitting a thrown error.
   */
  async getIndexState(repoId: string): Promise<IndexState> {
    const persisted = await this.store.tryGetIndexState(repoId);
    if (persisted) return persisted;
    return {
      repoId,
      status: 'degraded',
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: 0,
      reason: 'no_data',
      lastIndexedSha: '',
      indexerVersion: INDEXER_VERSION,
      updatedAt: new Date(0),
      degraded: true,
      degradedReason: 'no_data',
    };
  }

  // --- Reads ----------------------------------------------------------------

  getBlastRadius(repoId: string, changedFiles: string[]): Promise<BlastResult> {
    return this.blast.getBlastRadius(repoId, changedFiles);
  }

  getRepoMap(repoId: string, tokenBudget?: number): Promise<RepoMapResult> {
    return this.queries.getRepoMap(repoId, tokenBudget);
  }

  getFileRank(repoId: string, paths: string[]): Promise<FileRankRow[]> {
    return this.queries.getFileRank(repoId, paths);
  }

  getSymbolsInFiles(repoId: string, paths: string[]): Promise<SymbolRow[]> {
    return this.queries.getSymbolsInFiles(repoId, paths);
  }

  getCallerSignatures(
    repoId: string,
    changedFiles: string[],
    limit: number = MAX_CALLERS_PER_SYMBOL,
  ): Promise<SignatureRow[]> {
    return this.callers.getCallerSignatures(repoId, changedFiles, limit);
  }

  getUnresolvedReferences(repoId: string, files: string[]): Promise<RefRow[]> {
    return this.phantom.getUnresolvedReferences(repoId, files);
  }

  /** Top-N files by rank, minus tests/configs/migrations — conventions sample. */
  getConventionSamples(repoId: string, n: number): Promise<string[]> {
    return this.queries.getTopFilesByRank(repoId, n);
  }

  getTopFilesByRank(
    repoId: string,
    n: number,
    opts?: { exclude?: string[] },
  ): Promise<string[]> {
    return this.queries.getTopFilesByRank(repoId, n, opts);
  }

  getCriticalPaths(repoId: string): Promise<string[][]> {
    return this.queries.getCriticalPaths(repoId);
  }
}
