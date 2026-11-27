/**
 * repo-intel — pure reads over the persisted index: the cached repo map, file
 * rank, symbol rows, rank-driven file samples and critical paths. No clone
 * access; each method degrades to `[]` / a degraded object when the flag is
 * off or the index is missing.
 */
import { BFS_DEPTH, DEFAULT_REPO_MAP_TOKEN_BUDGET } from './constants.js';
import type { RepoIntelStore } from './ports.js';
import type { FileRankRow, RepoMapResult, SymbolRow } from './types.js';

export interface IndexQueriesDeps {
  store: Pick<
    RepoIntelStore,
    | 'tryGetIndexState'
    | 'getRepoMapCache'
    | 'getFileRankFor'
    | 'getSymbolRows'
    | 'getRankedPaths'
    | 'getEdges'
  >;
  enabled: boolean;
}

/** How many top-ranked files seed `getCriticalPaths` dependency chains. */
const CRITICAL_PATH_ROOTS = 5;

/**
 * Path kinds excluded from rank-driven file samples (conventions/onboarding):
 * tests, configs, declaration files, migrations, generated dirs. Substring
 * match on the repo-relative path (kept deliberately simple + deterministic).
 */
const JUNK_PATH_PATTERNS = [
  '.test.',
  '.spec.',
  '.d.ts',
  '__tests__/',
  '__mocks__/',
  '/test/',
  '/tests/',
  '/migrations/',
  '/__fixtures__/',
  '.config.',
  'vitest.',
  'jest.',
  'eslint',
  'prettier',
] as const;

function isJunkPath(path: string): boolean {
  const lower = path.toLowerCase();
  return JUNK_PATH_PATTERNS.some((p) => lower.includes(p));
}

export class IndexQueries {
  constructor(private deps: IndexQueriesDeps) {}

  /**
   * Serve the cached repo-map for the repo's last-indexed SHA. The map is only
   * rendered by the pipeline at `DEFAULT_REPO_MAP_TOKEN_BUDGET`; other budgets
   * (or an unindexed / partial-without-rank repo) miss and degrade cleanly.
   */
  async getRepoMap(repoId: string, tokenBudget?: number): Promise<RepoMapResult> {
    const degraded: RepoMapResult = {
      text: '',
      tokens: 0,
      cached: false,
      degraded: true,
      reason: 'no_data',
    };
    if (!this.deps.enabled) {
      return { ...degraded, reason: 'flag_off' };
    }
    const state = await this.deps.store.tryGetIndexState(repoId);
    if (!state || !state.lastIndexedSha) return degraded;
    const budget = tokenBudget ?? DEFAULT_REPO_MAP_TOKEN_BUDGET;
    const hit = await this.deps.store.getRepoMapCache(repoId, state.lastIndexedSha, budget);
    if (!hit) return degraded;
    return { text: hit.mapText, tokens: hit.tokenCount, cached: true };
  }

  /** Percentile per path from `file_rank` (smart-diff / run-executor "top-N%"). */
  async getFileRank(repoId: string, paths: string[]): Promise<FileRankRow[]> {
    if (!this.deps.enabled) return [];
    if (paths.length === 0) return [];
    return this.deps.store.getFileRankFor(repoId, paths);
  }

  /** Persistent symbol read-model (T2 columns) for the given files. */
  async getSymbolsInFiles(repoId: string, paths: string[]): Promise<SymbolRow[]> {
    if (!this.deps.enabled) return [];
    if (paths.length === 0) return [];
    const rows = await this.deps.store.getSymbolRows(repoId, paths);
    return rows.map((r) => ({
      file: r.path,
      name: r.name,
      kind: r.kind,
      exported: r.exported,
      startLine: r.line ?? 0,
      endLine: r.endLine ?? r.line ?? 0,
      signature: r.signature,
    }));
  }

  /**
   * Top-N file paths by rank DESC, dropping tests/configs/migrations and any
   * caller-supplied `exclude` substrings. Over-fetches by 10× before filtering
   * so the post-filter still yields N where possible.
   */
  async getTopFilesByRank(
    repoId: string,
    n: number,
    opts?: { exclude?: string[] },
  ): Promise<string[]> {
    if (!this.deps.enabled) return [];
    if (n <= 0) return [];
    const exclude = opts?.exclude ?? [];
    const rows = await this.deps.store.getRankedPaths(repoId, Math.max(n * 10, 100));
    const out: string[] = [];
    for (const r of rows) {
      if (isJunkPath(r.path)) continue;
      if (exclude.some((e) => r.path.includes(e))) continue;
      out.push(r.path);
      if (out.length >= n) break;
    }
    return out;
  }

  /**
   * Dependency chains from the highest-ranked files (onboarding reading-path).
   * For each of the top roots, greedily follow the highest-ranked import target
   * up to BFS_DEPTH hops. Pure read over `file_edges` + `file_rank`.
   */
  async getCriticalPaths(repoId: string): Promise<string[][]> {
    if (!this.deps.enabled) return [];
    const edges = await this.deps.store.getEdges(repoId);
    if (edges.length === 0) return [];

    const ranked = await this.deps.store.getRankedPaths(repoId, 100_000);
    const rankOf = new Map(ranked.map((r) => [r.path, r.rank]));

    // Adjacency importer → imported.
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      const arr = adj.get(e.fromFile);
      if (arr) arr.push(e.toFile);
      else adj.set(e.fromFile, [e.toFile]);
    }

    const roots = ranked.slice(0, CRITICAL_PATH_ROOTS).map((r) => r.path);
    const paths: string[][] = [];
    const seenPaths = new Set<string>();
    for (const root of roots) {
      const chain = [root];
      const inChain = new Set(chain);
      let cur = root;
      for (let depth = 0; depth < BFS_DEPTH; depth += 1) {
        const next = (adj.get(cur) ?? [])
          .filter((t) => !inChain.has(t))
          .sort((a, b) => (rankOf.get(b) ?? 0) - (rankOf.get(a) ?? 0))[0];
        if (!next) break;
        chain.push(next);
        inChain.add(next);
        cur = next;
      }
      if (chain.length < 2) continue;
      const key = chain.join('>');
      if (seenPaths.has(key)) continue;
      seenPaths.add(key);
      paths.push(chain);
    }
    return paths;
  }
}
