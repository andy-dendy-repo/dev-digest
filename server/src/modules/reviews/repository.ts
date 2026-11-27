import type { DbOrTx } from '../../db/client.js';
import type { Finding, FindingRecord, Intent, ReviewRecord, RunSummary, RunTrace } from '@devdigest/shared';
import type { FindingRow } from '../../db/rows.js';
import type { ActiveRun, NewAgentRun, PrFilePatch, ReviewPull, ReviewRepoRef } from './domain.js';
import type {
  NewReview,
  Persisted,
  PullLookupPort,
  ReviewWritePort,
  ReviewsPort,
  RunCompletion,
  RunsPort,
} from './ports.js';
import * as reviewRepo from './repository/review.repo.js';
import * as runRepo from './repository/run.repo.js';
import * as pullRepo from './repository/pull.repo.js';
import {
  toFindingRecord,
  toPrFilePatch,
  toReviewPull,
  toReviewRecord,
  toReviewRepoRef,
} from './repository/mappers.js';

/**
 * A2 — review data-access. The ONLY layer touching the DB for the review
 * domain. Owns `reviews`, `findings`, `pr_intent`, and persists the
 * observability rows `agent_runs` + `run_traces` (one trace doc per run).
 * Workspace scoping is enforced via the PR (which carries workspace_id).
 *
 * The query implementations are colocated, split by aggregate, under
 * `./repository/` (review+findings, agent runs, pull/intent); rows are mapped
 * to domain types (`./repository/mappers.ts`) here, so the ports never leak
 * a Drizzle row.
 */
export class ReviewRepository implements ReviewWritePort, ReviewsPort, RunsPort, PullLookupPort {
  /** `db` is the shared client or a unit-of-work transaction (see db/unit-of-work.ts). */
  constructor(private db: DbOrTx) {}

  // ---- PR lookup (workspace-scoped) --------------------------------------

  async getPull(workspaceId: string, prId: string): Promise<ReviewPull | undefined> {
    const row = await pullRepo.getPull(this.db, workspaceId, prId);
    return row ? toReviewPull(row) : undefined;
  }

  async getRepo(repoId: string): Promise<ReviewRepoRef | undefined> {
    const row = await pullRepo.getRepo(this.db, repoId);
    return row ? toReviewRepoRef(row) : undefined;
  }

  async getPrFiles(prId: string): Promise<PrFilePatch[]> {
    return (await pullRepo.getPrFiles(this.db, prId)).map(toPrFilePatch);
  }

  // ---- reviews + findings -------------------------------------------------

  async insertReview(values: NewReview): Promise<Persisted> {
    const row = await reviewRepo.insertReview(this.db, values);
    return { id: row.id };
  }

  async insertFindings(reviewId: string, findings: Finding[]): Promise<Persisted[]> {
    const rows = await reviewRepo.insertFindings(this.db, reviewId, findings);
    return rows.map((r) => ({ id: r.id }));
  }

  /**
   * Latest `kind='review'` review per PR with its findings (PR list;
   * `ReviewSummaryPort` of the pulls module — rows structurally match its
   * camelCase `FindingSummary`).
   */
  latestReviews(prIds: string[]): Promise<Map<string, { score: number | null; findings: FindingRow[] }>> {
    return reviewRepo.latestReviews(this.db, prIds);
  }

  /** Total USD over each PR's completed runs (PR list COST column; `RunCostsPort`). */
  costByPull(prIds: string[]): Promise<Map<string, number>> {
    return runRepo.costByPull(this.db, prIds);
  }

  /** Reviews for a PR (newest first), each with its findings; `agent_name` null. */
  async reviewsForPull(prId: string): Promise<ReviewRecord[]> {
    const rows = await reviewRepo.reviewsForPull(this.db, prId);
    return rows.map(({ review, findings }) => toReviewRecord(review, findings));
  }

  /** In-flight runs for a PR (status='running') — the server-side source of
   *  truth for "which agents are running now". Joined with the agent name. */
  activeRunsForPull(workspaceId: string, prId: string): Promise<ActiveRun[]> {
    return runRepo.activeRunsForPull(this.db, workspaceId, prId);
  }

  /** All runs for a PR (any status), newest first — the PR run history. */
  listRunsForPull(workspaceId: string, prId: string): Promise<RunSummary[]> {
    return runRepo.listRunsForPull(this.db, workspaceId, prId);
  }

  /** Delete one agent run (+ its trace via FK cascade). Workspace-scoped. */
  deleteAgentRun(workspaceId: string, runId: string): Promise<boolean> {
    return runRepo.deleteAgentRun(this.db, workspaceId, runId);
  }

  /** Mark a still-running run as cancelled (no-op if it already finished). */
  cancelRunIfRunning(runId: string): Promise<boolean> {
    return runRepo.cancelRunIfRunning(this.db, runId);
  }

  /** On boot: any run still 'running' is orphaned (its process died / restarted),
   *  so mark it failed. Prevents permanently stuck "running" runs in the UI. */
  reapStaleRunningRuns(): Promise<number> {
    return runRepo.reapStaleRunningRuns(this.db);
  }

  /** Delete a whole review (one agent's run) + its findings (cascade), scoped
   *  to the workspace. Returns false if not found in the workspace. */
  deleteReview(workspaceId: string, reviewId: string): Promise<boolean> {
    return reviewRepo.deleteReview(this.db, workspaceId, reviewId);
  }

  // ---- finding actions ----------------------------------------------------

  /** Workspace owning a finding (via review → PR); undefined when any link is missing. */
  async findingWorkspace(findingId: string): Promise<string | undefined> {
    const ctx = await reviewRepo.findingContext(this.db, findingId);
    return ctx?.pull.workspaceId;
  }

  async setFindingAccepted(findingId: string, at: Date | null): Promise<FindingRecord | undefined> {
    const row = await reviewRepo.setFindingAccepted(this.db, findingId, at);
    return row ? toFindingRecord(row) : undefined;
  }

  async setFindingDismissed(findingId: string, at: Date | null): Promise<FindingRecord | undefined> {
    const row = await reviewRepo.setFindingDismissed(this.db, findingId, at);
    return row ? toFindingRecord(row) : undefined;
  }

  // ---- intent -------------------------------------------------------------

  upsertIntent(prId: string, intent: Intent): Promise<void> {
    return pullRepo.upsertIntent(this.db, prId, intent);
  }

  getIntent(prId: string): Promise<Intent | undefined> {
    return pullRepo.getIntent(this.db, prId);
  }

  // ---- observability: agent_runs + run_traces ----------------------------

  /** Create an agent_runs row in `running` state; returns its id (= the runId). */
  createAgentRun(values: NewAgentRun): Promise<string> {
    return runRepo.createAgentRun(this.db, values);
  }

  completeAgentRun(runId: string, values: RunCompletion): Promise<void> {
    return runRepo.completeAgentRun(this.db, runId, values);
  }

  /** Record the head SHA a review ran against (PR-list freshness derivation). */
  markReviewed(prId: string, sha: string): Promise<void> {
    return pullRepo.markReviewed(this.db, prId, sha);
  }

  /** Persist the WHOLE run log as ONE document. PK = runId → agent_runs. */
  saveRunTrace(runId: string, trace: RunTrace): Promise<void> {
    return runRepo.saveRunTrace(this.db, runId, trace);
  }

  getRunTrace(runId: string): Promise<RunTrace | undefined> {
    return runRepo.getRunTrace(this.db, runId);
  }
}
