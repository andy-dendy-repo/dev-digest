import type { Finding, RunTrace } from '@devdigest/shared';

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
 * no trace).
 */
export interface ReviewsUnitOfWork {
  run<T>(work: (repos: { reviews: ReviewWritePort }) => Promise<T>): Promise<T>;
}
