import type {
  Agent,
  Finding,
  FindingRecord,
  GitClient,
  LLMProvider,
  Provider,
  ReviewRecord,
  RunSummary,
  RunTrace,
  UnifiedDiff,
} from '@devdigest/shared';
import type { RunBus } from '../../platform/sse.js';
import type { AgentsPort } from '../agents/ports.js';
import type { RepoIntel } from '../repo-intel/types.js';
import type { ActiveRun, NewAgentRun, PrFilePatch, ReviewPull, ReviewRepoRef } from './domain.js';

/**
 * Ports of the reviews module (Application ring). Signatures use domain types
 * only; `ReviewRepository` implements them and maps Drizzle rows inside.
 */

/** Values for a new `reviews` row. */
export interface NewReview {
  workspaceId: string;
  prId: string;
  agentId: string | null;
  runId: string | null;
  kind: 'summary' | 'review';
  verdict: string | null;
  summary: string | null;
  score: number | null;
  model: string | null;
}

/** Terminal state of an agent run (`agent_runs` row). */
export interface RunCompletion {
  status: 'done' | 'failed' | 'cancelled';
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  /** USD cost; null when unknown (failed/cancelled runs, unpriced model). */
  costUsd?: number | null;
  findingsCount: number;
  grounding: string;
  /** Review score (0-100); null on failed/cancelled runs. */
  score?: number | null;
  /** Findings that tripped the agent's gate; 0 on failed/cancelled runs. */
  blockers?: number | null;
  /** Failure reason (status='failed') / cancellation note. Null clears it. */
  error?: string | null;
}

/** Identity of a persisted row (what the run executor needs back). */
export interface Persisted {
  id: string;
}

/** The writes that record a finished review run. */
export interface ReviewWritePort {
  insertReview(values: NewReview): Promise<Persisted>;
  insertFindings(reviewId: string, findings: Finding[]): Promise<Persisted[]>;
  /** Record the head SHA a review ran against (PR-list freshness). */
  markReviewed(prId: string, sha: string): Promise<void>;
  completeAgentRun(runId: string, values: RunCompletion): Promise<void>;
  saveRunTrace(runId: string, trace: RunTrace): Promise<void>;
}

/**
 * Atomic review persistence: review → findings → PR reviewed-sha → run
 * completion → trace commit together or not at all, so a failure part-way
 * never leaves findings for a run that is marked failed (or a `done` run with
 * no trace). A failed write rejects with a `PersistenceError` (short, safe
 * message; the driver error on `cause`).
 */
export interface ReviewsUnitOfWork {
  run<T>(work: (repos: { reviews: ReviewWritePort }) => Promise<T>): Promise<T>;
}

/** The PR side a review needs: workspace-scoped PR lookup, its repo, its stored patches. */
export interface PullLookupPort {
  getPull(workspaceId: string, prId: string): Promise<ReviewPull | undefined>;
  getRepo(repoId: string): Promise<ReviewRepoRef | undefined>;
  getPrFiles(prId: string): Promise<PrFilePatch[]>;
}

/** Persisted reviews and finding actions. */
export interface ReviewsPort {
  /** Reviews of a PR, newest first, each with its findings (`agent_name` left null). */
  reviewsForPull(prId: string): Promise<ReviewRecord[]>;
  /** Delete a review (+ findings, cascade) in the workspace; false when not found there. */
  deleteReview(workspaceId: string, reviewId: string): Promise<boolean>;
  /** Workspace that owns a finding (via review → PR); undefined when it does not exist. */
  findingWorkspace(findingId: string): Promise<string | undefined>;
  setFindingAccepted(findingId: string, at: Date | null): Promise<FindingRecord | undefined>;
  setFindingDismissed(findingId: string, at: Date | null): Promise<FindingRecord | undefined>;
}

/** Agent runs (`agent_runs`) and their single-document traces (`run_traces`). */
export interface RunsPort {
  /** Create a run in `running` state; returns its id (= the runId). */
  createAgentRun(values: NewAgentRun): Promise<string>;
  completeAgentRun(runId: string, values: RunCompletion): Promise<void>;
  /** Persist the WHOLE run log as ONE document (upsert by runId). */
  saveRunTrace(runId: string, trace: RunTrace): Promise<void>;
  getRunTrace(runId: string): Promise<RunTrace | undefined>;
  /** In-flight runs of a PR, joined with the agent name. */
  activeRunsForPull(workspaceId: string, prId: string): Promise<ActiveRun[]>;
  /** All runs of a PR (any status), newest first. */
  listRunsForPull(workspaceId: string, prId: string): Promise<RunSummary[]>;
  /** Delete a run (+ trace, + the review it produced) in the workspace. */
  deleteAgentRun(workspaceId: string, runId: string): Promise<boolean>;
  /** Mark a still-running run cancelled (no-op if it already finished). */
  cancelRunIfRunning(runId: string): Promise<boolean>;
  /** Boot-time: mark every run left `running` by a dead process as failed. */
  reapStaleRunningRuns(): Promise<number>;
}

/** The agent reads a review needs. */
export type AgentsReadPort = Pick<AgentsPort, 'listEnabled' | 'getById'>;

/** The repo-intel enrichments the prompt uses (all best-effort, degrade to empty). */
export type RepoIntelReadPort = Pick<RepoIntel, 'getCallerSignatures' | 'getRepoMap' | 'getFileRank'>;

/** Minimal structured logger (pino-compatible: (obj, msg)) for runtime logs. */
export type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug: (obj: unknown, msg?: string) => void;
};

/** Where a review gets the PR's unified diff from. */
export interface DiffSource {
  load(pull: ReviewPull, repo: ReviewRepoRef): Promise<UnifiedDiff>;
}

/** A queued run: the agent to execute and its pre-created run id. */
export interface RunJob {
  agent: Agent;
  runId: string;
}

/** Background execution of queued runs (not awaited by the route). */
export interface RunExecutor {
  executeRuns(
    workspaceId: string,
    pull: ReviewPull,
    repo: ReviewRepoRef,
    jobs: RunJob[],
    logger?: Logger,
  ): Promise<void>;
}

export interface DiffLoaderDeps {
  /** Lazy: the git adapter is built on first use. */
  git: () => GitClient;
  pulls: Pick<PullLookupPort, 'getPrFiles'>;
}

export interface ReviewRunExecutorDeps {
  /** Failure/cancel writes (outside the unit of work). */
  runs: Pick<RunsPort, 'completeAgentRun' | 'saveRunTrace'>;
  uow: ReviewsUnitOfWork;
  diffs: DiffSource;
  /** Throws (ConfigError) when the provider's key is not configured. */
  llm: (id: Provider) => Promise<LLMProvider>;
  /** Lazy: the facade is built on first use. */
  repoIntel: () => RepoIntelReadPort;
  runBus: RunBus;
}

export interface ReviewServiceDeps {
  reviews: ReviewsPort;
  runs: RunsPort;
  pulls: PullLookupPort;
  agents: AgentsReadPort;
  runBus: RunBus;
  executor: RunExecutor;
}
