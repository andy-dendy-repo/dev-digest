import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { SettingsUpdate, ConnTestRequest, ConnTestResult, SecretsStatus } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { SettingsService } from './service.js';

/**
 * F1 — settings module. Transport only; the use cases live in SettingsService.
 *   GET  /settings                 → current non-secret prefs
 *   GET  /settings/secrets-status  → which provider keys are configured (booleans)
 *   PUT  /settings                 → upsert prefs (key/value rows)
 *   POST /settings/test-connection → test a provider key (OpenAI/Anthropic/OpenRouter/GitHub)
 *
 * GET/PUT /settings have no response schema: the body is the raw key/value
 * bag, while the `Settings` contract carries defaults the serializer would add.
 */
export default async function settingsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const settings = new SettingsService({
    settings: container.settingsRepo,
    secrets: container.secrets,
    tester: container.connectionTester,
    onSecretsChanged: () => container.invalidateSecretCaches(),
  });

  app.get('/settings', async (req) => {
    const { workspaceId } = await getContext(container, req);
    return settings.get(workspaceId);
  });

  // Booleans only — the key values are NEVER returned. Drives the
  // "Configured / Not set" badges in the API Keys panel.
  app.get('/settings/secrets-status', { schema: { response: { 200: SecretsStatus } } }, async (req) => {
    await getContext(container, req);
    return settings.secretsStatus();
  });

  app.put('/settings', { schema: { body: SettingsUpdate } }, async (req) => {
    const { workspaceId, userId } = await getContext(container, req);
    return settings.update(workspaceId, userId, req.body);
  });

  app.post(
    '/settings/test-connection',
    {
      schema: { body: ConnTestRequest, response: { 200: ConnTestResult } },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req) => settings.testConnection(req.body.provider, req.body.key),
  );
}
