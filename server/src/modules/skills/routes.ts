import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Skill, SkillImportPreview } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams, OkResponse } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { CreateSkillBody, SkillImportBody, UpdateSkillBody } from './domain.js';
import { SkillsService } from './service.js';

/**
 * M2 — skills module.
 *   GET    /skills                 → list (workspace-scoped, by name)
 *   GET    /skills/:id             → one skill
 *   POST   /skills                 → create (manual, or a confirmed import)
 *   PUT    /skills/:id             → update / toggle enabled (body change → new version)
 *   DELETE /skills/:id             → delete (agent links cascade)
 *   POST   /skills/import/preview  → parse an uploaded .md / archive entries; stores nothing
 */
export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new SkillsService({
    skills: container.skillsRepo,
    countTokens: (text) => container.tokenizer.count(text),
  });

  app.get('/skills', { schema: { response: { 200: z.array(Skill) } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams, response: { 200: Skill } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post(
    '/skills',
    { schema: { body: CreateSkillBody, response: { 201: Skill } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.create(workspaceId, req.body);
      reply.status(201);
      return skill;
    },
  );

  app.put(
    '/skills/:id',
    { schema: { params: IdParams, body: UpdateSkillBody, response: { 200: Skill } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.update(workspaceId, req.params.id, req.body);
      if (!skill) throw new NotFoundError('Skill not found');
      return skill;
    },
  );

  app.delete('/skills/:id', { schema: { params: IdParams, response: { 200: OkResponse } } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true as const };
  });

  app.post(
    '/skills/import/preview',
    {
      // An archive's text entries can exceed the global 1 MiB limit.
      bodyLimit: 4 * 1_048_576,
      schema: { body: SkillImportBody, response: { 200: SkillImportPreview } },
    },
    async (req) => {
      await getContext(app.container, req);
      return service.previewImport(req.body);
    },
  );
}
