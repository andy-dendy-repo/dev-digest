import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockEmbedder, MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import { AgentsRepository } from '../src/modules/agents/repository.js';
import { ReviewRepository } from '../src/modules/reviews/repository.js';
import { RepoIntelRepository } from '../src/modules/repo-intel/repository.js';
import { runFullIndex } from '../src/modules/repo-intel/pipeline/full.js';
import type { Container } from '../src/platform/container.js';
import type { Review } from '@devdigest/shared';

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
 * Atomicity of the multi-write flows (B1). Each test injects a real Postgres
 * failure part-way through a flow with a `BEFORE <op>` trigger that raises,
 * then checks that nothing of the flow was left behind.
 */
d('transactions: multi-write flows are atomic (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let seq = 0;
  const dropTriggers: Array<() => Promise<unknown>> = [];

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
    await pg.handle.db.execute(
      sql.raw(`CREATE OR REPLACE FUNCTION dd_injected_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'injected failure on %', TG_TABLE_NAME; END $$`),
    );
  });
  afterEach(async () => {
    while (dropTriggers.length) await dropTriggers.pop()!();
  });
  afterAll(async () => {
    await pg?.stop();
  });

  /** Make every `op` on `table` fail until the end of the test. */
  async function failOn(table: string, op: 'INSERT' | 'UPDATE' | 'DELETE' | 'INSERT OR UPDATE') {
    const name = `dd_fail_${table}_${seq++}`;
    await pg.handle.db.execute(
      sql.raw(
        `CREATE TRIGGER ${name} BEFORE ${op} ON "${table}" FOR EACH ROW EXECUTE FUNCTION dd_injected_failure()`,
      ),
    );
    dropTriggers.push(() => pg.handle.db.execute(sql.raw(`DROP TRIGGER ${name} ON "${table}"`)));
  }

  async function makeRepoAndPr() {
    const name = `tx-repo-${seq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 7,
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
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
    });
    return { repo: repo!, pr: pr! };
  }

  function makeApp(github = new MockGitHubClient()) {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        github,
        llm: { openai: new MockLLMProvider('openai', { structured: REVIEW }) },
      },
    });
  }

  it('review persistence: a failing trace write leaves no review, findings or reviewed-sha; the run is failed', async () => {
    const app = await makeApp();
    const { pr } = await makeRepoAndPr();
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: `tx-agent-${seq++}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'p' },
      })
    ).json();

    // The trace is the LAST write of the persistence unit.
    await failOn('run_traces', 'INSERT');
    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${pr.id}/review`,
      payload: { agentId: agent.id },
    });
    expect(res.statusCode).toBe(200);
    const [run] = await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });

    expect(run!.status).toBe('failed');
    expect(run!.error).toBeTruthy();
    const reviews = await pg.handle.db.select().from(t.reviews).where(eq(t.reviews.prId, pr.id));
    expect(reviews).toHaveLength(0);
    const [prAfter] = await pg.handle.db
      .select()
      .from(t.pullRequests)
      .where(eq(t.pullRequests.id, pr.id));
    expect(prAfter!.lastReviewedSha).toBeNull();
    await app.close();
  });

  it('agent versioning: concurrent config edits each get their own version and snapshot', async () => {
    const repo = new AgentsRepository(pg.handle.db);
    const agent = await repo.insert({
      workspaceId,
      name: `tx-versioned-${seq++}`,
      provider: 'openai',
      model: 'gpt-4.1',
      systemPrompt: 'v1',
    });

    const edits = 4;
    await Promise.all(
      Array.from({ length: edits }, (_, i) =>
        repo.update(workspaceId, agent.id, { systemPrompt: `edit-${i}` }),
      ),
    );

    const after = await repo.getById(workspaceId, agent.id);
    expect(after!.version).toBe(1 + edits);
    const versions = await repo.listVersions(agent.id);
    expect(versions.map((v) => v.version)).toEqual([5, 4, 3, 2, 1]);
    // The newest snapshot is the config the agent row actually holds.
    const newest = versions[0]!.configJson as { system_prompt: string };
    expect(newest.system_prompt).toBe(after!.systemPrompt);
  });

  it('agent insert: a failing v1 snapshot leaves no agent behind', async () => {
    const repo = new AgentsRepository(pg.handle.db);
    const name = `tx-orphan-${seq++}`;
    await failOn('agent_versions', 'INSERT');
    await expect(
      repo.insert({ workspaceId, name, provider: 'openai', model: 'gpt-4.1', systemPrompt: 'x' }),
    ).rejects.toThrow();
    const rows = await pg.handle.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, name)));
    expect(rows).toHaveLength(0);
  });

  it('agent skills: a failing replace keeps the previous links', async () => {
    const repo = new AgentsRepository(pg.handle.db);
    const agent = await repo.insert({
      workspaceId,
      name: `tx-skills-${seq++}`,
      provider: 'openai',
      model: 'gpt-4.1',
      systemPrompt: 'x',
    });
    const [skill] = await pg.handle.db
      .insert(t.skills)
      .values({ workspaceId, name: 'S', description: 'd', type: 'custom', source: 'manual', body: 'b' })
      .returning();
    await repo.setSkills(agent.id, [skill!.id]);

    // Unknown skill id → FK violation on the insert after the delete.
    await expect(
      repo.setSkills(agent.id, ['00000000-0000-0000-0000-000000000000']),
    ).rejects.toThrow();
    expect(await repo.skillIdsForAgent(agent.id)).toEqual([skill!.id]);
  });

  it('deleteAgentRun: a failing run delete keeps the review it produced', async () => {
    const { pr } = await makeRepoAndPr();
    const reviews = new ReviewRepository(pg.handle.db);
    const runId = await reviews.createAgentRun({
      workspaceId,
      agentId: null,
      prId: pr.id,
      provider: 'openai',
      model: 'gpt-4.1',
    });
    await reviews.insertReview({
      workspaceId,
      prId: pr.id,
      agentId: null,
      runId,
      kind: 'review',
      verdict: 'approve',
      summary: 's',
      score: 90,
      model: 'gpt-4.1',
    });

    await failOn('agent_runs', 'DELETE');
    await expect(reviews.deleteAgentRun(workspaceId, runId)).rejects.toThrow();
    const left = await pg.handle.db.select().from(t.reviews).where(eq(t.reviews.runId, runId));
    expect(left).toHaveLength(1);
  });

  it('PR detail refresh: a failing commits write keeps the previously stored files', async () => {
    // GitHub now reports a different file set + stats than what is stored.
    const app = await makeApp(
      new MockGitHubClient({
        detail: {
          additions: 999,
          files: [{ path: 'src/renamed.ts', additions: 999, deletions: 0, patch: null }],
        },
      }),
    );
    const { pr } = await makeRepoAndPr();

    await failOn('pr_commits', 'INSERT');
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}` });
    // Falls back to the persisted detail, which is still the old snapshot.
    expect(res.statusCode).toBe(200);
    expect(res.json().files.map((f: { path: string }) => f.path)).toEqual(['src/config.ts']);
    const files = await pg.handle.db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id));
    expect(files.map((f) => f.path)).toEqual(['src/config.ts']);
    const [prAfter] = await pg.handle.db
      .select()
      .from(t.pullRequests)
      .where(eq(t.pullRequests.id, pr.id));
    expect(prAfter!.additions).toBe(1);
    await app.close();
  });

  it('full reindex: a failing final write keeps the previous index readable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tx-reindex-'));
    try {
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src/a.ts'), 'export function alpha() { return 1; }\n');
      const name = `tx-index-${seq++}`;
      const [repo] = await pg.handle.db
        .insert(t.repos)
        .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}`, clonePath: root })
        .returning();
      const repository = new RepoIntelRepository(pg.handle.db);
      const container = {
        git: { currentHead: async () => 'sha-1' },
        depgraph: { buildEdges: async () => [] },
        tokenizer: { count: (text: string) => Math.ceil(text.length / 4) },
      } as unknown as Container;

      const first = await runFullIndex(container, repository, { repoId: repo!.id });
      expect(first.status).toBe('full');
      const symbolNames = async () =>
        (
          await pg.handle.db.select().from(t.symbols).where(eq(t.symbols.repoId, repo!.id))
        ).map((s) => s.name);
      expect(await symbolNames()).toEqual(['alpha']);

      // Second pass sees a new file, but its last write (index state) fails.
      await writeFile(join(root, 'src/b.ts'), 'export function beta() { return 2; }\n');
      await failOn('repo_index_state', 'INSERT OR UPDATE');
      await expect(runFullIndex(container, repository, { repoId: repo!.id })).rejects.toThrow();

      expect(await symbolNames()).toEqual(['alpha']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
