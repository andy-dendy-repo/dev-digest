/**
 * repo-intel ports — what the indexer pipelines and the facade's use cases need
 * from the outside world, expressed in domain types only.
 *
 * Implementations (composition root wires them in `platform/container.ts`):
 *   RepoIntelStore → `RepoIntelRepository` (Drizzle, `./repository.ts`)
 *   CodeParser     → `AstGrepCodeParser`   (`adapters/astgrep`, @ast-grep/napi)
 *   CloneReader    → `FsCloneReader`       (`adapters/clone-reader`, contained reads + walk)
 *   DepGraph       → `DepCruiseGraph`      (`adapters/depgraph`, dependency-cruiser)
 *   Tokenizer      → `TiktokenTokenizer`   (`adapters/tokenizer`, js-tiktoken)
 * plus the shared `GitClient` / `CodeIndex` / `JobQueue` ports from `@devdigest/shared`.
 */
import type { CodeIndex, GitClient } from '@devdigest/shared';
import type { FileRankRow, IndexState, IndexStatus } from './types.js';

// ---------------------------------------------------------------------------
// Persisted shapes (what the pipelines write and the queries read back).
// ---------------------------------------------------------------------------

/** Row shape the indexer pipeline buffers up before persistence. */
export interface IndexerSymbolRow {
  repoId: string;
  path: string;
  name: string;
  kind: string;
  line: number;
  endLine: number | null;
  exported: boolean;
  signature: string | null;
  contentHash: string;
}

export interface IndexerReferenceRow {
  repoId: string;
  fromPath: string;
  toSymbol: string;
  line: number;
  contentHash: string;
}

/** Bundle of values the pipeline persists into `repo_index_state`. */
export interface IndexStateUpsert {
  repoId: string;
  lastIndexedSha: string;
  indexerVersion: number;
  status: IndexStatus;
  filesIndexed: number;
  filesSkipped: number;
  stats: Record<string, unknown>;
}

/** Minimal repo shape the facade needs to locate (and sync) a clone. */
export interface RepoBasics {
  id: string;
  owner: string;
  name: string;
  defaultBranch: string;
  clonePath: string | null;
}

/** Import-graph edge (importer → imported), repo-relative paths. */
export interface IndexerEdgeRow {
  fromFile: string;
  toFile: string;
}

/** One `file_rank` row the rank step buffers before persistence. */
export interface IndexerFileRankRow {
  filePath: string;
  pagerank: number;
  hotness: number;
  rank: number;
  percentile: number;
}

/** Precomputed per-file facts (endpoints/crons) the indexer writes for blast. */
export interface IndexerFileFactsRow {
  filePath: string;
  endpoints: string[];
  crons: string[];
}

/** Candidate row for the repo-map renderer (symbols × file_rank). */
export interface RepoMapCandidateRow {
  path: string;
  name: string;
  exported: boolean;
  signature: string | null;
  rank: number;
}

/** Full symbol row (with the T2 columns) — for getSymbolsInFiles + blast. */
export interface FullSymbolRow {
  path: string;
  name: string;
  kind: string;
  line: number | null;
  endLine: number | null;
  exported: boolean;
  signature: string | null;
}

/** A resolved cross-file caller (reference whose decl_file is a changed file). */
export interface ResolvedCallerRow {
  fromPath: string;
  toSymbol: string;
  line: number;
  rank: number;
}

/** Payload of the INDEX / REFRESH / RESYNC jobs. */
export interface IndexPayload {
  repoId: string;
  /** Optional ref hint — when omitted we look up the repo's owner/name from the DB. */
  owner?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// RepoIntelStore — the repo-intel tables.
// ---------------------------------------------------------------------------

export interface RepoIntelStore {
  /**
   * Run `work` against a store bound to ONE transaction: every write inside
   * commits or rolls back together. The full reindex swaps a repo's whole index
   * this way (its own aggregate), so readers never see a half-written index.
   * Keep slow work (parsing, graph building) outside `work`.
   */
  transaction<T>(work: (store: RepoIntelStore) => Promise<T>): Promise<T>;

  getRepoBasics(repoId: string): Promise<RepoBasics | null>;
  /** `null` when there is no row (or the table is missing): callers degrade. */
  tryGetIndexState(repoId: string): Promise<IndexState | null>;

  // --- indexer writes ---
  deleteAllForRepo(repoId: string): Promise<void>;
  deleteForFiles(repoId: string, paths: string[]): Promise<void>;
  insertSymbols(rows: IndexerSymbolRow[]): Promise<void>;
  insertReferences(rows: IndexerReferenceRow[]): Promise<void>;
  upsertIndexState(state: IndexStateUpsert): Promise<void>;
  touchIndexState(repoId: string, stats?: Record<string, unknown>): Promise<void>;
  advanceSha(repoId: string, sha: string): Promise<void>;
  replaceEdges(repoId: string, edges: IndexerEdgeRow[]): Promise<void>;
  replaceFileRank(repoId: string, rows: IndexerFileRankRow[]): Promise<void>;
  replaceFileFacts(repoId: string, rows: IndexerFileFactsRow[]): Promise<void>;
  patchFileFacts(repoId: string, files: string[], rows: IndexerFileFactsRow[]): Promise<void>;
  /** Resolve `references.decl_file` through the import graph (unique candidate only). */
  resolveReferences(repoId: string, opts: { reset: boolean }): Promise<void>;
  putRepoMapCache(
    repoId: string,
    commitSha: string,
    tokenBudget: number,
    mapText: string,
    tokenCount: number,
  ): Promise<void>;
  deleteRepoMapCache(repoId: string): Promise<void>;

  // --- reads ---
  getEdges(repoId: string): Promise<IndexerEdgeRow[]>;
  getFileRankFor(repoId: string, paths: string[]): Promise<FileRankRow[]>;
  getRankedPaths(repoId: string, limit: number): Promise<Array<{ path: string; rank: number }>>;
  /** Ordered rank DESC, exported DESC, line ASC, name ASC. */
  getRepoMapCandidates(repoId: string): Promise<RepoMapCandidateRow[]>;
  getSymbolRows(repoId: string, paths: string[]): Promise<FullSymbolRow[]>;
  getResolvedCallers(
    repoId: string,
    declFiles: string[],
    names: string[],
  ): Promise<ResolvedCallerRow[]>;
  getFileFacts(repoId: string, files: string[]): Promise<IndexerFileFactsRow[]>;
  getRepoMapCache(
    repoId: string,
    commitSha: string,
    tokenBudget: number,
  ): Promise<{ mapText: string; tokenCount: number } | null>;
}

// ---------------------------------------------------------------------------
// CodeParser — AST extraction (ast-grep in production).
// ---------------------------------------------------------------------------

export interface ParsedSymbol {
  name: string;
  kind: string;
  /** 1-based line of the declaration. */
  line: number;
  /** 1-based line of the closing token of the declaration body. */
  endLine: number;
  /** True when the declaration is reached through an `export` form. */
  exported: boolean;
  /** Declaration head trimmed to MAX_SIGNATURE_CHARS; null for kinds without one. */
  signature: string | null;
}

export interface ParsedReference {
  toSymbol: string;
  /** 1-based line of the reference. */
  line: number;
  /** Path passed in by the caller — surfaced so consumers can fan-out. */
  refFile: string;
}

export interface ParsedImport {
  name: string;
  source: string;
  isType: boolean;
}

export interface ParsedInvocationHead {
  /** The bare identifier being invoked (callee name, ctor name, or JSX tag). */
  name: string;
  /** 1-based line of the invocation. */
  line: number;
  /** Which AST shape produced this head. */
  kind: 'call' | 'new' | 'jsx';
}

/**
 * Synchronous, in-memory parse of one file's source. Methods may throw on a
 * native-binding failure; callers skip the file.
 */
export interface CodeParser {
  /** True when a grammar exists for the file's extension. */
  supports(file: string): boolean;
  /**
   * Declared symbols. Class methods are dual-emitted: `Class.method` AND bare
   * `method` (same line), so reference search resolves either form.
   */
  parseSymbols(file: string, source: string): ParsedSymbol[];
  /** Call sites, `new X`, member calls and JSX usages (declaration lines excluded). */
  parseReferences(file: string, source: string): ParsedReference[];
  /** Bindings introduced by `import` statements. */
  parseImports(file: string, source: string): ParsedImport[];
  /** Bare-identifier invocation heads (phantom-API gate input). */
  parseInvocationHeads(file: string, source: string): ParsedInvocationHead[];
}

// ---------------------------------------------------------------------------
// CloneReader — the on-disk clone (untrusted input).
// ---------------------------------------------------------------------------

export interface WalkStats {
  /** Files seen on disk with a SUPPORTED_EXT extension (before size + bound filters). */
  totalCandidates: number;
  /** Candidates dropped because their size > MAX_FILE_SIZE. */
  skippedTooLarge: number;
  /** Candidates dropped because the file list exceeded MAX_INDEXED_FILES. */
  bounded: number;
}

export interface WalkResult {
  /** Repo-relative paths, forward slashes, sorted. */
  files: string[];
  stats: WalkStats;
}

export interface CloneReader {
  /**
   * Read a repo-relative file, or `null` when it can't be read safely (escapes
   * the clone through a symlink, missing, a directory, too big, unreadable).
   */
  readFile(clonePath: string, relPath: string): Promise<string | null>;
  /**
   * The source files to index: SUPPORTED_EXT only, EXCLUDED_DIRS skipped,
   * symlinks never followed, MAX_FILE_SIZE / MAX_INDEXED_FILES applied.
   */
  walk(clonePath: string): Promise<WalkResult>;
}

// ---------------------------------------------------------------------------
// DepGraph + Tokenizer (moved inward from src/adapters/**).
// ---------------------------------------------------------------------------

export interface FileEdge {
  from: string;
  to: string;
}

export interface DepGraph {
  /**
   * Resolve the local import edges among `files` (repo-relative) under `root`.
   * Never throws — returns `[]` on any failure.
   */
  buildEdges(root: string, files: string[]): Promise<FileEdge[]>;
}

/** Token counter for the repo-map budget search. Must never throw. */
export interface Tokenizer {
  count(text: string): number;
}

// ---------------------------------------------------------------------------
// Use-case dependencies.
// ---------------------------------------------------------------------------

/** What the full / incremental pipelines need. */
export interface IndexingDeps {
  store: RepoIntelStore;
  git: Pick<GitClient, 'currentHead' | 'diffNameOnly'>;
  parser: CodeParser;
  clone: CloneReader;
  depgraph: DepGraph;
  tokenizer: Tokenizer;
  /** Parallel parse slots for the full index (composition root: CPU count − 1). Default 1. */
  parseConcurrency?: number;
}

/** Indexing plus the manual resync (which advances the clone first). */
export interface RepoIndexerDeps extends IndexingDeps {
  git: Pick<GitClient, 'currentHead' | 'diffNameOnly' | 'sync'>;
}

/** Everything the `RepoIntel` facade needs. */
export interface RepoIntelServiceDeps extends RepoIndexerDeps {
  /** `REPO_INTEL_ENABLED`: when false every read degrades (`[]` / degraded object). */
  enabled: boolean;
  /** ripgrep fallback for blast on an unindexed repo. */
  codeIndex: Pick<CodeIndex, 'symbols' | 'references'>;
}
