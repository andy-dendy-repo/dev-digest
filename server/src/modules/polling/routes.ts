import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { PullsService } from '../pulls/service.js';

/**
 * F1 — polling module. MANUAL refresh that ONLY syncs the PR list
 * (new/updated PRs appear, head_sha updates). It does NOT trigger any review —
 * review is manual (user presses Run Review, owned by the reviews module).
 *
 *   POST /repos/:id/poll  → sync PR list from GitHub, bump last_polled_at
 *
 * The sync itself is `PullsService.sync` (same upsert as the PR list read).
 */
export default async function pollingRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const pulls = new PullsService({
    pulls: container.pullsRepo,
    reviews: container.reviewRepo,
    costs: container.reviewRepo,
    github: () => container.github(),
    log: app.log,
  });

  const PollResponse = z.object({ synced: z.number().int(), reviewTriggered: z.literal(false) });
  app.post('/repos/:id/poll', { schema: { params: IdParams, response: { 200: PollResponse } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return pulls.sync(workspaceId, req.params.id);
  });
}
