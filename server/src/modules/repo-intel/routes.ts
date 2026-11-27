/**
 * repo-intel HTTP module.
 *
 *   GET  /repos/:id/index-state  → IndexState (always works; degraded on missing data)
 *   POST /repos/:id/resync       → enqueues a RESYNC_JOB_KIND job (202 + job id):
 *                                  fetch latest from origin + incremental reindex.
 *
 * Both 404 unless the repo belongs to the caller's workspace (the facade itself
 * is tenant-agnostic). `index-state` has no response schema: `IndexState` is a
 * server-side interface (Date fields), not a shared contract.
 *
 * The INDEX / REFRESH / RESYNC job handlers are registered in the composition
 * root (`app.ts` → `registerRepoIntelJobHandlers`), not here.
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { assertRepoInWorkspace } from '../_shared/ownership.js';
import { IdParams } from '../_shared/schemas.js';
import { RESYNC_JOB_KIND } from './constants.js';
import type { IndexState } from './types.js';

/** 202 body of `POST /repos/:id/resync` (degraded when the job could not be enqueued). */
const ResyncResponse = z.object({
  status: z.literal('accepted'),
  jobId: z.string().optional(),
  degraded: z.literal(true).optional(),
  reason: z.string().optional(),
});

export default async function repoIntelRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/repos/:id/index-state',
    { schema: { params: IdParams } },
    async (req): Promise<IndexState> => {
      // The facade is tenant-agnostic, so scope the repo id here.
      const { workspaceId } = await getContext(container, req);
      await assertRepoInWorkspace(container, workspaceId, req.params.id);
      return container.repoIntel.getIndexState(req.params.id);
    },
  );

  app.post(
    '/repos/:id/resync',
    { schema: { params: IdParams, response: { 202: ResyncResponse } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      await assertRepoInWorkspace(container, workspaceId, req.params.id);
      // 202 even when enqueue fails (no handler / DB hiccup) so the UI can
      // still poll /index-state without an inline error path. The actual
      // outcome shows up in `repo_index_state` once the worker runs.
      let jobId: string | null = null;
      try {
        const job = await container.jobs.enqueue(workspaceId, RESYNC_JOB_KIND, {
          repoId: req.params.id,
        });
        jobId = job.id;
      } catch {
        // swallow — degraded path
      }
      reply.code(202);
      return jobId
        ? { status: 'accepted' as const, jobId }
        : { status: 'accepted' as const, degraded: true as const, reason: 'no_handler' };
    },
  );
}
