import type {
  ActiveRun,
  Agent,
  FindingActionKind,
  FindingRecord,
  ReviewRecord,
  ReviewRunTarget,
  RunEventKind,
  RunSummary,
  RunTrace,
} from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { Logger, ReviewServiceDeps, RunJob } from './ports.js';
import { actOnFinding as actOnFindingImpl } from './findings.js';

/**
 * Review service (the core). Orchestrates:
 *   diff → assemblePrompt(system + repo-map + diff)
 *        → llm.completeStructured({ schema: Review }) (single-pass)
 *        → groundFindings(...) (citation gate — drops findings off the diff)
 *        → persist reviews + kept findings (+ grounding summary)
 *   while streaming RunEvents over the run bus, and on completion writing
 *   the whole log as ONE RunTrace doc + an agent_runs row.
 *
 * Also: the finding accept/dismiss actions. The bulky run execution lives in
 * the injected `RunExecutor` (run-executor.ts); this class keeps the public
 * method surface. All dependencies are ports (see `ReviewServiceDeps`).
 */
export class ReviewService {
  constructor(private readonly deps: ReviewServiceDeps) {}

  // ===========================================================================
  // Run a review for one or all enabled agents on a PR.
  // ===========================================================================

  /**
   * Resolve which agents to run. `all` → all enabled agents; else a single agent.
   */
  async resolveTargets(
    workspaceId: string,
    opts: { agentId?: string; all?: boolean },
  ): Promise<Agent[]> {
    if (opts.all) return this.deps.agents.listEnabled(workspaceId);
    if (opts.agentId) {
      const agent = await this.deps.agents.getById(workspaceId, opts.agentId);
      if (!agent) throw new NotFoundError('Agent not found');
      return [agent];
    }
    throw new AppError('invalid_run_request', 'Provide agentId or all:true', 400);
  }

  /** Delete a whole review run (one agent's pass) + its findings (cascade). */
  async deleteReview(workspaceId: string, reviewId: string): Promise<boolean> {
    return this.deps.reviews.deleteReview(workspaceId, reviewId);
  }

  /** In-flight runs for a PR (server-side source of truth, survives reload). */
  async activeRuns(workspaceId: string, prId: string): Promise<ActiveRun[]> {
    return this.deps.runs.activeRunsForPull(workspaceId, prId);
  }

  /** All runs for a PR (any status), newest first — the run history (incl. failures). */
  async listRuns(workspaceId: string, prId: string): Promise<RunSummary[]> {
    return this.deps.runs.listRunsForPull(workspaceId, prId);
  }

  /** Delete one run from the history (+ its trace). */
  async deleteRun(workspaceId: string, runId: string): Promise<boolean> {
    return this.deps.runs.deleteAgentRun(workspaceId, runId);
  }

  /** 404 unless the run belongs to the workspace (guards every `/runs/:id/*` route). */
  async assertRunInWorkspace(workspaceId: string, runId: string): Promise<void> {
    if (!(await this.deps.runs.isRunInWorkspace(workspaceId, runId))) {
      throw new NotFoundError('Run not found');
    }
  }

  /**
   * Cancel an in-flight run. Signals a live runner to stop at its next
   * checkpoint AND marks the DB row cancelled + completes the bus immediately —
   * so cancel also works for ORPHANED runs (whose background process died on a
   * server restart) where signalling alone would do nothing.
   */
  async cancelRun(workspaceId: string, runId: string): Promise<void> {
    await this.assertRunInWorkspace(workspaceId, runId);
    this.publish(runId, 'info', 'Cancellation requested — stopping…');
    this.deps.runBus.cancel(runId);
    await this.deps.runs.cancelRunIfRunning(runId);
    this.deps.runBus.complete(runId);
  }

  /** Reap runs left 'running' by a previous (now-dead) process. Called on boot. */
  async reapStaleRuns(): Promise<number> {
    return this.deps.runs.reapStaleRunningRuns();
  }

  /**
   * Run a review for each target agent. Each agent gets its own runId
   * (= agent_runs.id) created up-front so the SSE route can be subscribed
   * before/while the run progresses. A partial failure in one agent does not
   * abort the others.
   */
  async runReview(
    workspaceId: string,
    prId: string,
    targets: Agent[],
    logger?: Logger,
  ): Promise<{ runs: ReviewRunTarget[]; reviews: ReviewRecord[] }> {
    const pull = await this.deps.pulls.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const repo = await this.deps.pulls.getRepo(pull.repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    // Create the agent_run rows up front so a runId is available IMMEDIATELY —
    // the client persists these in global state and subscribes to the SSE
    // stream. The actual (slow) review runs in the background below.
    const runs: ReviewRunTarget[] = [];
    const jobs: RunJob[] = [];
    for (const agent of targets) {
      const runId = await this.deps.runs.createAgentRun({
        workspaceId,
        agentId: agent.id,
        prId,
        provider: agent.provider,
        model: agent.model,
      });
      runs.push({ run_id: runId, agent_id: agent.id, agent_name: agent.name });
      jobs.push({ agent, runId });
    }

    // Fire-and-forget: the HTTP response returns now with the runIds; reviews
    // are persisted as each agent finishes and the client refetches on SSE done.
    void this.deps.executor.executeRuns(workspaceId, pull, repo, jobs, logger).catch((err) => {
      logger?.error({ prId, err: (err as Error).message }, 'review: background execution crashed');
    });

    return { runs, reviews: [] };
  }

  private publish(runId: string, kind: RunEventKind, msg: string, data?: unknown) {
    return this.deps.runBus.publish(runId, kind, msg, data);
  }

  // ===========================================================================
  // Finding actions
  // ===========================================================================

  async actOnFinding(
    workspaceId: string,
    findingId: string,
    action: FindingActionKind,
  ): Promise<{ finding: FindingRecord }> {
    return actOnFindingImpl(this.deps.reviews, workspaceId, findingId, action);
  }

  // ===========================================================================
  // Reads
  // ===========================================================================

  async reviewsForPull(workspaceId: string, prId: string): Promise<ReviewRecord[]> {
    const pull = await this.deps.pulls.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const reviews = await this.deps.reviews.reviewsForPull(prId);
    const names = new Map<string, string>();
    for (const review of reviews) {
      if (review.agent_id && !names.has(review.agent_id)) {
        const a = await this.deps.agents.getById(workspaceId, review.agent_id);
        if (a) names.set(review.agent_id, a.name);
      }
    }
    return reviews.map((review) => ({
      ...review,
      agent_name: review.agent_id ? (names.get(review.agent_id) ?? null) : null,
    }));
  }

  /** The run's trace document; 404 when the run is not in the workspace or has no trace yet. */
  async getRunTrace(workspaceId: string, runId: string): Promise<RunTrace> {
    await this.assertRunInWorkspace(workspaceId, runId);
    const trace = await this.deps.runs.getRunTrace(runId);
    if (!trace) throw new NotFoundError('Run trace not found');
    return trace;
  }
}
