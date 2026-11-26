import type {
  GitHubClient,
  PrCommit,
  PrDetail,
  PrFile,
  PrMeta,
  RepoRef,
} from '@devdigest/shared';

/**
 * Ports of the pulls module (Application ring). Domain types only: the
 * Drizzle implementation (`repository.ts`) maps rows to these.
 */

/** A repo as the pulls module needs it (GitHub ref + id). */
export interface PullsRepoRef extends RepoRef {
  id: string;
}

/** A stored pull request (`pull_requests` row, camelCase domain shape). */
export interface PullRecord {
  id: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  headSha: string;
  lastReviewedSha: string | null;
  additions: number;
  deletions: number;
  filesCount: number;
  /** GitHub merge state (open / merged / closed). */
  status: string;
  body: string | null;
  openedAt: Date | null;
  updatedAt: Date | null;
}

/** Diff stats GitHub only reports on the detail endpoint. */
export interface PullStats {
  additions: number;
  deletions: number;
  filesCount: number;
}

/** Files + commits persisted for a PR (the offline PR detail). */
export interface StoredPullDetail {
  files: PrFile[];
  commits: PrCommit[];
}

/** Persistence of PRs (owned by this module). */
export interface PullsPort {
  findRepo(workspaceId: string, repoId: string): Promise<PullsRepoRef | null>;
  /** A PR in the workspace together with its repo; null when either is missing. */
  findPull(
    workspaceId: string,
    prId: string,
  ): Promise<{ pull: PullRecord; repo: PullsRepoRef | null } | null>;
  /** Insert new PRs / refresh title, head, state and updated_at of known ones (one statement). */
  upsertMany(workspaceId: string, repoId: string, prs: PrMeta[]): Promise<void>;
  listForRepo(repoId: string): Promise<PullRecord[]>;
  updateStats(prId: string, stats: PullStats): Promise<void>;
  /** Replace files + commits and refresh body/stats atomically. */
  replaceDetail(prId: string, detail: PrDetail): Promise<void>;
  storedDetail(prId: string): Promise<StoredPullDetail>;
  markPolled(repoId: string): Promise<void>;
}

/** A finding as the PR list needs it (mapped to a `FindingBrief` by the service). */
export interface FindingSummary {
  id: string;
  severity: string;
  category: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  confidence: number;
  rationale: string;
}

/** Latest `kind='review'` review of a PR, with its findings. */
export interface LatestReviewSummary {
  score: number | null;
  findings: FindingSummary[];
}

/** Read side of the reviews module that the PR list needs (implemented by the reviews repository). */
export interface ReviewSummaryPort {
  /** Keyed by PR id; PRs never reviewed are absent. */
  latestReviews(prIds: string[]): Promise<Map<string, LatestReviewSummary>>;
}

/** Total USD of each PR's completed runs (implemented by the reviews repository). */
export interface RunCostsPort {
  costByPull(prIds: string[]): Promise<Map<string, number>>;
}

/** Structured warn logger (pino-compatible). */
export interface WarnLogger {
  warn(obj: unknown, msg?: string): void;
}

export interface PullsServiceDeps {
  pulls: PullsPort;
  reviews: ReviewSummaryPort;
  costs: RunCostsPort;
  /** Throws (ConfigError) when no GitHub token is configured. */
  github: () => Promise<GitHubClient>;
  log: WarnLogger;
}
