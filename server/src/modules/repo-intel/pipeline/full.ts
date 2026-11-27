/**
 * repo-intel pipeline — `runFullIndex`.
 *
 * One-pass full index of a repo. Drives:
 *   1. walk + filter           (CloneReader.walk)
 *   2. parse (CodeParser, parallel via p-queue) + facts
 *   3. delete-and-rewrite the cached symbols/references for this repo
 *      (idempotent — re-running is safe; UNIQUE constraint guards dup rows)
 *   4. [T3] graph (dependency-cruiser) → resolve decl_file → rank (PageRank)
 *      → repo-map render → file_facts
 *   5. upsert `repo_index_state` (status='full' on a clean pass)
 *
 * Soft budget self-watch: JobRunner wraps the handler in
 * `withTimeout(120s)` and rejects → `failed`+retry on hit.
 * The handler can't catch its own outer timeout, so we self-monitor
 * `INDEX_SOFT_BUDGET_MS ≈ 110s` and finish 'partial' BEFORE the hard cap.
 *
 * Option B: rank = PageRank only, hotness=0 (clone is shallow). The T3
 * block is skipped when the soft budget trips, leaving status 'partial'.
 */
import PQueue from 'p-queue';
import type { RepoRef } from '@devdigest/shared';
import { DEFAULT_REPO_MAP_TOKEN_BUDGET, INDEX_SOFT_BUDGET_MS, INDEXER_VERSION } from '../constants.js';
import type {
  IndexerEdgeRow,
  IndexerFileFactsRow,
  IndexerFileRankRow,
  IndexerReferenceRow,
  IndexerSymbolRow,
  IndexingDeps,
  IndexPayload,
  RepoIntelStore,
} from '../ports.js';
import type { IndexResult, IndexStatus } from '../types.js';
import { computeFileRank } from './rank.js';
import { renderRepoMap } from './repo-map.js';
import { asMessage, parseFileForIndex } from './parse-file.js';

export type { IndexPayload };

/** Per-file parse error captured into `stats.parseDegraded` (capped). */
interface ParseDegradedEntry {
  file: string;
  reason: string;
}

/** Hard cap on `stats.parseDegraded` so a broken clone can't blow up jsonb. */
const PARSE_DEGRADED_CAP = 50;

/**
 * Full index of one repo. Returns the final IndexResult so the caller can
 * report it (job ack, HTTP response). Errors that abort the whole run still
 * stamp a `status='failed'` row before re-throwing — the handler is
 * idempotent on retry.
 */
export async function runFullIndex(
  deps: IndexingDeps,
  payload: IndexPayload,
): Promise<IndexResult> {
  const { store: repository, parser, clone } = deps;
  const startedAt = Date.now();
  const repoId = payload.repoId;

  const repo = await repository.getRepoBasics(repoId);
  if (!repo) {
    // Repo deleted between enqueue and run — no-op, no row to write to.
    return degradedResult(startedAt, 'repo_not_found');
  }
  if (!repo.clonePath) {
    // Clone hasn't completed yet (race against runCloneJob) — bail and let
    // the next enqueue (after clone) populate the index. Persist a row so
    // observability can see why no index exists.
    await safePersist(repository, repoId, '', 'degraded', 0, 0, {
      reason: 'no_clone',
      degradedReason: 'no_data',
      durationMs: Date.now() - startedAt,
    });
    return degradedResult(startedAt, 'no_clone');
  }

  const ref: RepoRef = { owner: repo.owner, name: repo.name };
  const currentSha = await safeCurrentHead(deps.git, ref);

  // Walk + filter -------------------------------------------------------
  const walk = await clone.walk(repo.clonePath);
  if (walk.files.length === 0) {
    await safePersist(repository, repoId, currentSha, 'partial', 0, walk.stats.skippedTooLarge, {
      ...walk.stats,
      reason: 'no_files',
      durationMs: Date.now() - startedAt,
    });
    return {
      status: 'partial',
      filesIndexed: 0,
      filesSkipped: walk.stats.skippedTooLarge,
      durationMs: Date.now() - startedAt,
      reason: 'no_files',
    };
  }

  // Parse phase ---------------------------------------------------------
  const symbolsBuf: IndexerSymbolRow[] = [];
  const refsBuf: IndexerReferenceRow[] = [];
  const factsBuf: IndexerFileFactsRow[] = [];
  const parseDegraded: ParseDegradedEntry[] = [];
  let filesIndexed = 0;
  let filesSkipped = walk.stats.skippedTooLarge;
  let softBudgetReached = false;

  const concurrency = Math.max(1, deps.parseConcurrency ?? 1);
  const parseQ = new PQueue({ concurrency });

  for (const relPath of walk.files) {
    // Soft-budget gate: before enqueuing each file, bail out if we've burned
    // the budget. Anything still in flight is awaited via `onIdle()` below.
    if (Date.now() - startedAt > INDEX_SOFT_BUDGET_MS) {
      softBudgetReached = true;
      break;
    }

    void parseQ.add(async () => {
      if (!parser.supports(relPath)) {
        filesSkipped += 1;
        return;
      }
      let source: string;
      try {
        const contained = await clone.readFile(repo.clonePath!, relPath);
        if (contained === null) throw new Error('unreadable or outside the clone (symlink?)');
        source = contained;
      } catch (err) {
        filesSkipped += 1;
        recordParseDegraded(parseDegraded, relPath, asMessage(err));
        return;
      }
      try {
        const parsed = parseFileForIndex(parser, repoId, relPath, source);
        symbolsBuf.push(...parsed.symbols);
        refsBuf.push(...parsed.references);
        if (parsed.facts) factsBuf.push(parsed.facts);
        filesIndexed += 1;
      } catch (err) {
        filesSkipped += 1;
        recordParseDegraded(parseDegraded, relPath, asMessage(err));
      }
    });
  }

  await parseQ.onIdle();

  // Graph phase (no DB) ------------------------------------------------
  // Built BEFORE the persist transaction so the slow dependency-cruiser pass
  // never runs while a connection/transaction is held. Skipped when the soft
  // budget tripped: we're already over time, and the graph build would blow
  // past the hard cap. status then stays 'partial'.
  let graphFailed: string | undefined;
  let edgeRows: IndexerEdgeRow[] = [];
  let rankRows: IndexerFileRankRow[] = [];
  if (!softBudgetReached) {
    try {
      const edges = await deps.depgraph.buildEdges(repo.clonePath, walk.files);
      edgeRows = edges.map((e) => ({ fromFile: e.from, toFile: e.to }));
    } catch (err) {
      graphFailed = asMessage(err);
    }
    // Rank (PageRank only; hotness=0 — Option B).
    rankRows = computeFileRank(walk.files, edgeRows);
  }
  const rankCount = rankRows.length;

  // Clean pass → 'full'. Any degradation (soft budget, graph failure, or a
  // parse error) keeps it honestly 'partial'.
  const clean = !softBudgetReached && !graphFailed && parseDegraded.length === 0;
  const status: IndexStatus = clean ? 'full' : 'partial';

  // Persist phase (ONE transaction) -------------------------------------
  // The whole index for this repo is swapped atomically: readers keep seeing
  // the previous index until commit (never an empty/half-written one), and a
  // failure part-way rolls back to it. Delete-then-insert is the idempotent
  // shape blast already uses; keeps the UNIQUE index
  // (symbols_repo_path_name_kind_line_uq) happy.
  await repository.transaction(async (index) => {
    await index.deleteAllForRepo(repoId);
    await index.insertSymbols(symbolsBuf);
    await index.insertReferences(refsBuf);

    // --- T3: graph → resolve → rank → repo-map → facts -----------------
    if (!softBudgetReached) {
      await index.replaceEdges(repoId, edgeRows);

      // Resolve references.decl_file via the fresh graph. Full index inserts
      // rows with NULL decl_file, so no reset is needed (step 5).
      await index.resolveReferences(repoId, { reset: false });

      await index.replaceFileRank(repoId, rankRows);

      // Repo-map render → cache. Drop stale entries (prior SHAs) first. The
      // candidates read sees this transaction's fresh symbols + rank.
      const candidates = await index.getRepoMapCandidates(repoId);
      const map = renderRepoMap(candidates, deps.tokenizer, DEFAULT_REPO_MAP_TOKEN_BUDGET);
      await index.deleteRepoMapCache(repoId);
      if (currentSha) {
        await index.putRepoMapCache(
          repoId,
          currentSha,
          DEFAULT_REPO_MAP_TOKEN_BUDGET,
          map.text,
          map.tokens,
        );
      }

      // Per-file facts (endpoints/crons) for the blast facade.
      await index.replaceFileFacts(repoId, factsBuf);
    }

    const stats: Record<string, unknown> = {
      ...walk.stats,
      filesSeen: walk.files.length,
      symbolsWritten: symbolsBuf.length,
      referencesWritten: refsBuf.length,
      edgesWritten: edgeRows.length,
      ranked: rankCount,
      factsWritten: factsBuf.length,
      hotnessAvailable: false, // Option B — rank = pagerank only
      ...(graphFailed ? { graphFailed } : {}),
      softBudgetReached,
      parseDegraded,
      durationMs: Date.now() - startedAt,
    };

    await index.upsertIndexState({
      repoId,
      lastIndexedSha: currentSha,
      indexerVersion: INDEXER_VERSION,
      status,
      filesIndexed,
      filesSkipped,
      stats,
    });
  });

  return {
    status,
    filesIndexed,
    filesSkipped,
    durationMs: Date.now() - startedAt,
    reason: softBudgetReached ? 'soft_budget' : graphFailed ? 'graph_failed' : undefined,
  };
}

function recordParseDegraded(buf: ParseDegradedEntry[], file: string, reason: string): void {
  if (buf.length >= PARSE_DEGRADED_CAP) return;
  buf.push({ file, reason });
}

async function safeCurrentHead(git: IndexingDeps['git'], ref: RepoRef): Promise<string> {
  try {
    return await git.currentHead(ref);
  } catch {
    return '';
  }
}

async function safePersist(
  repository: RepoIntelStore,
  repoId: string,
  sha: string,
  status: 'partial' | 'degraded',
  filesIndexed: number,
  filesSkipped: number,
  stats: Record<string, unknown>,
): Promise<void> {
  try {
    await repository.upsertIndexState({
      repoId,
      lastIndexedSha: sha,
      indexerVersion: INDEXER_VERSION,
      status,
      filesIndexed,
      filesSkipped,
      stats,
    });
  } catch {
    // Persistence failure during early-exit path — never throw out of the
    // top-level handler; the next run will re-stamp the row.
  }
}

function degradedResult(startedAt: number, reason: string): IndexResult {
  return {
    status: 'degraded',
    filesIndexed: 0,
    filesSkipped: 0,
    durationMs: Date.now() - startedAt,
    reason,
  };
}
