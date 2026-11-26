import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockEmbedder, MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import {
  ActiveRun,
  Agent,
  AgentSkillLink,
  ModelInfo,
  ReviewRecord,
  type Review,
  type ModelInfo as ModelInfoT,
} from '@devdigest/shared';
import { z } from 'zod';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded secret.',
  score: 40,
  findings: [
    {
      id: 'f1',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'A live key is committed.',
      confidence: 0.9,
      kind: 'finding',
    },
  ],
};

/**
 * B6 — workspace ownership on `/runs/:id/*` and `/repos/:id/index-state|resync`
 * (a foreign id is 404, the own workspace behaves as before), and the 2xx
 * response schemas of routes the other suites don't reach.
 */
d('contracts + workspace access (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let foreign: { workspaceId: string; repoId: string; prId: string; runId: string };
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;

    // A second workspace with its own repo, PR and in-flight run.
    const [fws] = await pg.handle.db.insert(t.workspaces).values({ name: 'Foreign' }).returning();
    const [frepo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: fws!.id, owner: 'other', name: 'secret', fullName: 'other/secret' })
      .returning();
    const [fpr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId: fws!.id,
        repoId: frepo!.id,
        number: 1,
        title: 't',
        author: 'a',
        branch: 'b',
        base: 'main',
        headSha: 'h',
        additions: 0,
        deletions: 0,
        filesCount: 0,
      })
      .returning();
    const [frun] = await pg.handle.db
      .insert(t.agentRuns)
      .values({ workspaceId: fws!.id, prId: fpr!.id, status: 'running', source: 'local' })
      .returning();
    await pg.handle.db.insert(t.runTraces).values({ runId: frun!.id, trace: { secret: true } });
    foreign = { workspaceId: fws!.id, repoId: frepo!.id, prId: fpr!.id, runId: frun!.id };
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp(models?: ModelInfoT[]) {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: { openai: new MockLLMProvider('openai', { structured: REVIEW, ...(models ? { models } : {}) }) },
      },
    });
  }

  async function makeRepoAndPr() {
    const name = `ca-repo-${seq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 9,
        title: 'Add config',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'abc123',
        additions: 1,
        deletions: 0,
        filesCount: 1,
      })
      .returning();
    return { repo: repo!, pr: pr! };
  }

  async function makeAgent(app: Awaited<ReturnType<typeof makeApp>>) {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name: `ca-agent-${seq++}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'p' },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as Agent;
  }

  const runStatus = async (runId: string) =>
    (await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId)))[0]!.status;

  // ---------------------------------------------------------------- ownership

  it('GET /runs/:id/trace of another workspace is 404; the own run trace is served', async () => {
    const app = await makeApp();
    const foreignRes = await app.inject({ method: 'GET', url: `/runs/${foreign.runId}/trace` });
    expect(foreignRes.statusCode).toBe(404);
    expect(foreignRes.json().error.code).toBe('not_found');
    expect(foreignRes.body).not.toContain('secret');

    const { pr } = await makeRepoAndPr();
    const agent = await makeAgent(app);
    const run = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    const runId = run.json().runs[0].run_id as string;
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const own = await app.inject({ method: 'GET', url: `/runs/${runId}/trace` });
    expect(own.statusCode).toBe(200);
    expect(own.json().config.agent).toBe(agent.name);
    await app.close();
  });

  it('GET /runs/:id/events of another workspace is 404 (no stream is opened)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: `/runs/${foreign.runId}/events` });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json().error.code).toBe('not_found');
    await app.close();
  });

  it('POST /runs/:id/cancel of another workspace is 404 and leaves the run running; the own run is cancelled', async () => {
    const app = await makeApp();
    // buildApp reaps every 'running' row on boot; put the foreign run back in flight.
    await pg.handle.db.update(t.agentRuns).set({ status: 'running' }).where(eq(t.agentRuns.id, foreign.runId));
    const res = await app.inject({ method: 'POST', url: `/runs/${foreign.runId}/cancel` });
    expect(res.statusCode).toBe(404);
    expect(await runStatus(foreign.runId)).toBe('running');

    const { pr } = await makeRepoAndPr();
    const [own] = await pg.handle.db
      .insert(t.agentRuns)
      .values({ workspaceId, prId: pr.id, status: 'running', source: 'local' })
      .returning();
    const active = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/runs/active` });
    expect(active.statusCode).toBe(200);
    expect(z.array(ActiveRun).parse(active.json()).map((r) => r.run_id)).toEqual([own!.id]);

    const ok = await app.inject({ method: 'POST', url: `/runs/${own!.id}/cancel` });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ok: true });
    expect(await runStatus(own!.id)).toBe('cancelled');
    await app.close();
  });

  it('GET /repos/:id/index-state and POST /repos/:id/resync of another workspace are 404', async () => {
    const app = await makeApp();
    const state = await app.inject({ method: 'GET', url: `/repos/${foreign.repoId}/index-state` });
    expect(state.statusCode).toBe(404);
    const resync = await app.inject({ method: 'POST', url: `/repos/${foreign.repoId}/resync` });
    expect(resync.statusCode).toBe(404);
    const jobs = await pg.handle.db.select().from(t.jobs);
    expect(jobs.some((j) => JSON.stringify(j.payload).includes(foreign.repoId))).toBe(false);

    // Own repo: unchanged behaviour.
    const { repo } = await makeRepoAndPr();
    const ownState = await app.inject({ method: 'GET', url: `/repos/${repo.id}/index-state` });
    expect(ownState.statusCode).toBe(200);
    expect(ownState.json().repoId).toBe(repo.id);
    const ownResync = await app.inject({ method: 'POST', url: `/repos/${repo.id}/resync` });
    expect(ownResync.statusCode).toBe(202);
    expect(ownResync.json().status).toBe('accepted');
    await app.close();
  });

  // ---------------------------------------------------------------- response schemas

  it('serves agents, skills, models, workspace, repos and deletes through their response schemas unchanged', async () => {
    const models: ModelInfoT[] = [
      { id: 'gpt-4.1', provider: 'openai', label: 'GPT-4.1', created: 1, pricing: { promptPerM: 2, completionPerM: 8 }, contextLength: 1000 },
    ];
    const app = await makeApp(models);
    const agent = await makeAgent(app);

    const one = await app.inject({ method: 'GET', url: `/agents/${agent.id}` });
    expect(one.statusCode).toBe(200);
    expect(one.json()).toEqual(agent);
    expect(Agent.parse(one.json())).toEqual(agent);

    const skills = await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` });
    expect(skills.statusCode).toBe(200);
    expect(z.array(AgentSkillLink).parse(skills.json())).toEqual([]);

    for (const url of [`/agents/${agent.id}/models`, '/providers/openai/models']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(models);
      expect(z.array(ModelInfo).parse(res.json())).toEqual(models);
    }

    const { repo, pr } = await makeRepoAndPr();
    const ws = await app.inject({ method: 'GET', url: '/workspace' });
    expect(ws.statusCode).toBe(200);
    expect(ws.json().repos).toContainEqual({
      id: repo.id,
      full_name: repo.fullName,
      clone_path: null,
      last_polled_at: null,
      cloned: false,
    });

    const refresh = await app.inject({ method: 'POST', url: `/repos/${repo.id}/refresh` });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json()).toEqual({ status: 'refreshing' });

    // Review → delete the review, then the run.
    const run = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    expect(run.statusCode).toBe(200);
    const runId = run.json().runs[0].run_id as string;
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = z.array(ReviewRecord).parse(
      (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })).json(),
    );
    expect(reviews).toHaveLength(1);
    const delReview = await app.inject({ method: 'DELETE', url: `/reviews/${reviews[0]!.id}` });
    expect(delReview.json()).toEqual({ ok: true });
    const delRun = await app.inject({ method: 'DELETE', url: `/runs/${runId}` });
    expect(delRun.json()).toEqual({ ok: true });
    const delAgain = await app.inject({ method: 'DELETE', url: `/runs/${runId}` });
    expect(delAgain.json()).toEqual({ ok: false });

    const delAgent = await app.inject({ method: 'DELETE', url: `/agents/${agent.id}` });
    expect(delAgent.json()).toEqual({ ok: true });
    const delRepo = await app.inject({ method: 'DELETE', url: `/repos/${repo.id}` });
    expect(delRepo.json()).toEqual({ deleted: repo.id });
    await app.close();
  });

  it('POST /pulls/:id/review: an empty body is still accepted, a malformed one is 422', async () => {
    const app = await makeApp();
    const { pr } = await makeRepoAndPr();
    const empty = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review` });
    // No agentId / all → the service's 400, not a validation error.
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error.code).toBe('invalid_run_request');
    const bad = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: 42 } });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe('validation_error');
    await app.close();
  });

  it('a body that breaks its response schema is a generic 500, never the raw object', async () => {
    // The provider adapter returns a model with an unknown provider id.
    const app = await makeApp([{ id: 'leaky-model', provider: 'bogus' } as unknown as ModelInfoT]);
    const res = await app.inject({ method: 'GET', url: '/providers/openai/models' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal_error', message: 'Internal error' } });
    expect(res.body).not.toContain('leaky-model');
    await app.close();
  });
});
