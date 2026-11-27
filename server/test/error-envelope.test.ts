/**
 * Error envelope hygiene (no DB):
 *  - unexpected errors return a generic 500 — their message (SQL, paths, SDK
 *    payloads) is logged, never sent to the client;
 *  - Fastify's own 4xx errors keep their useful message;
 *  - GitHub/Octokit failures are translated into `external_service_error` (502).
 */
import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { translateGitHubError } from '../src/adapters/github/errors.js';
import { ExternalServiceError, NotFoundError } from '../src/platform/errors.js';
import { TimeoutError } from '../src/platform/resilience.js';
import { SecretsStatus } from '@devdigest/shared';

const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

async function appWith(route: () => never) {
  const app = await buildApp({ config });
  app.get('/__boom', async () => route());
  return app;
}

describe('global error handler', () => {
  it('hides the message of an unexpected error', async () => {
    const app = await appWith(() => {
      throw new Error('relation "secret_table" does not exist at /srv/app/db.ts');
    });
    const res = await app.inject({ method: 'GET', url: '/__boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal_error', message: 'Internal error' } });
    await app.close();
  });

  it('hides the message of a non-AppError carrying a 5xx statusCode', async () => {
    const app = await appWith(() => {
      throw Object.assign(new Error('upstream token sk-xyz rejected'), { statusCode: 503 });
    });
    const res = await app.inject({ method: 'GET', url: '/__boom' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.message).toBe('Internal error');
    await app.close();
  });

  it('keeps the message of a Fastify client error (malformed JSON)', async () => {
    const app = await buildApp({ config });
    const res = await app.inject({
      method: 'POST',
      url: '/settings/test-connection',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).not.toBe('Internal error');
    await app.close();
  });

  it('returns a translated GitHub failure as 502 external_service_error', async () => {
    const app = await appWith(() =>
      translateGitHubError(Object.assign(new Error('Bad credentials'), { status: 401 })),
    );
    const res = await app.inject({ method: 'GET', url: '/__boom' });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toMatchObject({
      code: 'external_service_error',
      message: 'GitHub request failed (401): Bad credentials',
    });
    await app.close();
  });

  it('catches a body that breaks its response schema: generic 500, the raw object is not sent', async () => {
    const app = await buildApp({ config });
    app.get(
      '/__shape',
      { schema: { response: { 200: SecretsStatus } } },
      async () => ({ openai: 'sk-live-should-not-leak', anthropic: true, openrouter: true, github: true }),
    );
    const res = await app.inject({ method: 'GET', url: '/__shape' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal_error', message: 'Internal error' } });
    expect(res.body).not.toContain('sk-live');
    await app.close();
  });

  it('a response schema serializes only the contract keys (extra fields are dropped)', async () => {
    const app = await buildApp({ config });
    app.get(
      '/__extra',
      { schema: { response: { 200: SecretsStatus } } },
      async () => ({ openai: true, anthropic: false, openrouter: false, github: true, OPENAI_API_KEY: 'sk-x' }),
    );
    const res = await app.inject({ method: 'GET', url: '/__extra' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ openai: true, anthropic: false, openrouter: false, github: true });
    await app.close();
  });
});

describe('translateGitHubError', () => {
  const translate = (err: unknown) => {
    try {
      translateGitHubError(err);
    } catch (e) {
      return e;
    }
    throw new Error('expected a throw');
  };

  it('strips the Octokit docs link and keeps the status', () => {
    const e = translate(
      Object.assign(new Error('Not Found - https://docs.github.com/rest/pulls/pulls#get'), {
        status: 404,
      }),
    );
    expect(e).toBeInstanceOf(ExternalServiceError);
    expect((e as ExternalServiceError).message).toBe('GitHub request failed (404): Not Found');
    expect((e as ExternalServiceError).details).toEqual({ provider: 'github', status: 404 });
  });

  it('maps a timeout to a readable message', () => {
    const e = translate(new TimeoutError(30_000));
    expect((e as ExternalServiceError).message).toBe('GitHub did not respond in time');
  });

  it('passes AppErrors through untouched', () => {
    const original = new NotFoundError('no such repo');
    expect(translate(original)).toBe(original);
  });

  it('handles a network error without a status', () => {
    const e = translate(Object.assign(new Error('getaddrinfo ENOTFOUND api.github.com'), { code: 'ENOTFOUND' }));
    expect(e).toBeInstanceOf(ExternalServiceError);
    expect((e as ExternalServiceError).message).toContain('ENOTFOUND');
  });
});
