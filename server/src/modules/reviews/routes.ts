import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ActiveRun,
  FindingRecord,
  ReviewRecord,
  ReviewRunResponse,
  RunRequest,
  RunSummary,
} from '@devdigest/shared';
import type { RunEvent } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams, OkFlagResponse, OkResponse } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import type { Container } from '../../platform/container.js';
import { ReviewService } from './service.js';
import { ReviewRunExecutor } from './run-executor.js';
import { DiffLoader } from './diff-loader.js';

/**
 * Wire a ReviewService from the container's ports (also used by `app.ts` for
 * the boot-time reaper). Adapters stay lazy: git and the repo-intel facade are
 * resolved on first use, as before.
 */
export function createReviewService(container: Container): ReviewService {
  const executor = new ReviewRunExecutor({
    runs: container.reviewRepo,
    uow: container.reviewsUow,
    diffs: new DiffLoader({ git: () => container.git, pulls: container.reviewRepo }),
    llm: (id) => container.llm(id),
    repoIntel: () => container.repoIntel,
    runBus: container.runBus,
  });
  return new ReviewService({
    reviews: container.reviewRepo,
    runs: container.reviewRepo,
    pulls: container.reviewRepo,
    agents: container.agentsRepo,
    runBus: container.runBus,
    executor,
  });
}

/**
 * reviews module.
 *   POST   /pulls/:id/review  {agentId} | {all:true}  → run review(s); returns runs
 *   GET    /runs/:id/events                            → SSE stream of RunEvent (replay-first)
 *   GET    /runs/:id/trace                             → the single-document RunTrace
 *   GET    /pulls/:id/reviews                          → persisted reviews + findings for a PR
 *   POST   /findings/:id/(accept|dismiss)              → finding actions
 *
 * Every `/runs/:id/*` route 404s unless the run belongs to the caller's
 * workspace. 2xx bodies are serialized through the shared contracts
 * (`schema.response`); `/runs/:id/trace` is not, because stored trace
 * documents predate parts of `RunTrace` and the serializer would rewrite them.
 */
const FINDING_ACTIONS = ['accept', 'dismiss'] as const;
const FindingActionResponse = z.object({ finding: FindingRecord });
export default async function reviewsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = createReviewService(container);

  // ---- Run a review (manual trigger) -------------------------------
  // Tight per-route limit: each call can fan out to expensive LLM runs.
  // Body is optional (both fields optional; an empty body is OK).
  app.post(
    '/pulls/:id/review',
    {
      schema: { params: IdParams, body: RunRequest.nullish(), response: { 200: ReviewRunResponse } },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      const body = req.body ?? {};
      const targets = await service.resolveTargets(workspaceId, {
        ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
        ...(body.all !== undefined ? { all: body.all } : {}),
      });
      const { runs, reviews } = await service.runReview(
        workspaceId,
        req.params.id,
        targets,
        req.log,
      );
      return { pr_id: req.params.id, runs, reviews };
    });

    // ---- SSE: live run events (replay buffer first, then live; ends on done) -
    // No rate limit: SSE is one long-lived connection, not burst traffic.
    app.get(
      '/runs/:id/events',
      { schema: { params: IdParams }, config: { rateLimit: false } },
      async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      const runId = req.params.id;
      // Before the stream opens, so a foreign run gets a normal 404 envelope.
      await service.assertRunInWorkspace(workspaceId, runId);

      reply.sse(
        (async function* () {
          // Bridge the in-memory RunBus to an async iterator the SSE plugin drains.
          const queue: RunEvent[] = [];
          let resolve: (() => void) | null = null;
          let done = false;

          const unsubscribe = container.runBus.subscribe(runId, (e) => {
            queue.push(e);
            resolve?.();
          });
          const offDone = container.runBus.onDone(runId, () => {
            done = true;
            resolve?.();
          });

          try {
            while (true) {
              if (queue.length === 0) {
                if (done) break;
                await new Promise<void>((r) => (resolve = r));
                resolve = null;
                continue;
              }
              const e = queue.shift()!;
              yield {
                id: String(e.seq),
                event: e.kind,
                data: JSON.stringify(e),
              };
            }
          } finally {
            unsubscribe();
            offDone();
          }
        })(),
      );
    });

    // ---- Active (in-flight) runs for a PR (server source of truth) ----------
    app.get(
      '/pulls/:id/runs/active',
      { schema: { params: IdParams, response: { 200: z.array(ActiveRun) } } },
      async (req) => {
        const { workspaceId } = await getContext(container, req);
        return service.activeRuns(workspaceId, req.params.id);
    },
  );

  // ---- All runs for a PR (any status; the run history, incl. failures) -----
  app.get(
    '/pulls/:id/runs',
    { schema: { params: IdParams, response: { 200: z.array(RunSummary) } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.listRuns(workspaceId, req.params.id);
    },
  );

  // ---- Delete one run from the history (+ its trace) ----------------------
  app.delete(
    '/runs/:id',
    { schema: { params: IdParams, response: { 200: OkFlagResponse } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      const ok = await service.deleteRun(workspaceId, req.params.id);
      return { ok };
    },
  );

  // ---- Cancel an in-flight run --------------------------------------------
  app.post(
    '/runs/:id/cancel',
    { schema: { params: IdParams, response: { 200: OkResponse } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      await service.cancelRun(workspaceId, req.params.id);
      return { ok: true as const };
    },
  );

  // ---- Run trace (single document; A5 enriches with multi-agent/stats) ----
  app.get('/runs/:id/trace', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.getRunTrace(workspaceId, req.params.id);
  });

  // ---- Reads --------------------------------------------------------------
  app.get(
    '/pulls/:id/reviews',
    { schema: { params: IdParams, response: { 200: z.array(ReviewRecord) } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.reviewsForPull(workspaceId, req.params.id);
    },
  );

  // ---- Delete a whole review run (one agent's pass) + its findings --------
  app.delete(
    '/reviews/:id',
    { schema: { params: IdParams, response: { 200: OkResponse } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      const ok = await service.deleteReview(workspaceId, req.params.id);
      if (!ok) throw new NotFoundError('Review not found');
      return { ok: true as const };
    },
  );

  // ---- Finding actions (accept / dismiss) ---------------------------------
  for (const action of FINDING_ACTIONS) {
    app.post(
      `/findings/:id/${action}`,
      { schema: { params: IdParams, response: { 200: FindingActionResponse } } },
      async (req) => {
        const { workspaceId } = await getContext(container, req);
        return service.actOnFinding(workspaceId, req.params.id, action);
      },
    );
  }
}
