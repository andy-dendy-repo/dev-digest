import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';
import { SkillsRepository } from '../src/modules/skills/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * M2 seed over real Postgres: the Test Quality Reviewer agent, the built-in
 * skills with their v1 snapshots, the agents' ordered skill links (Security
 * Reviewer 3 of 6 effective, Test Quality Reviewer 3 of 3), the unlinked
 * api-breaking-changes skill, and idempotency (a re-seed changes nothing and
 * never overwrites a user's link choices).
 */
d('seed: built-in skills and agent links', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient(), tokenizer: { count: (s) => s.length } },
    });
  }

  async function agentId(name: string): Promise<string> {
    const [a] = await pg.handle.db
      .select({ id: t.agents.id })
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, name)));
    expect(a, `seeded agent ${name}`).toBeDefined();
    return a!.id;
  }

  async function counts() {
    const db = pg.handle.db;
    return {
      agents: (await db.select().from(t.agents)).length,
      skills: (await db.select().from(t.skills)).length,
      versions: (await db.select().from(t.skillVersions)).length,
      links: (await db.select().from(t.agentSkills)).length,
    };
  }

  it('seeds the four built-in agents, including Test Quality Reviewer', async () => {
    const agents = await pg.handle.db
      .select()
      .from(t.agents)
      .where(eq(t.agents.workspaceId, workspaceId))
      .orderBy(asc(t.agents.name));
    expect(agents.map((a) => a.name)).toEqual([
      'General Reviewer',
      'Performance Reviewer',
      'Security Reviewer',
      'Test Quality Reviewer',
    ]);
    const tq = agents.find((a) => a.name === 'Test Quality Reviewer')!;
    expect(tq).toMatchObject({ provider: 'openrouter', model: 'deepseek/deepseek-v4-flash', enabled: true });
    expect(tq.systemPrompt).toContain('# Verdict');
  });

  it('seeds ten skills, each with a v1 body snapshot', async () => {
    const skills = await pg.handle.db.select().from(t.skills).where(eq(t.skills.workspaceId, workspaceId));
    expect(skills).toHaveLength(10);
    const versions = await pg.handle.db.select().from(t.skillVersions);
    for (const s of skills) {
      expect(s.version).toBe(1);
      expect(versions.filter((v) => v.skillId === s.id)).toEqual([
        expect.objectContaining({ version: 1, body: s.body }),
      ]);
    }
    const phantom = skills.find((s) => s.name === 'phantom-api-gate');
    expect(phantom).toMatchObject({ enabled: false, source: 'imported_file', type: 'security' });
  });

  it('Security Reviewer: 6 ordered links, exactly 3 effective', async () => {
    const app = await makeApp();
    const id = await agentId('Security Reviewer');

    const view = (await app.inject({ method: 'GET', url: `/agents/${id}/skills` })).json();
    expect(
      view.map((v: { name: string; order: number; enabled: boolean; skill_enabled: boolean }) => [
        v.name,
        v.order,
        v.enabled,
        v.skill_enabled,
      ]),
    ).toEqual([
      ['pr-quality-rubric', 0, true, true],
      ['no-then-chains', 1, false, true],
      ['secret-leakage-gate', 2, true, true],
      ['lethal-trifecta', 3, true, true],
      ['phantom-api-gate', 4, false, false],
      ['test-coverage-nudge', 5, false, true],
    ]);

    const agent = (await app.inject({ method: 'GET', url: `/agents/${id}` })).json();
    expect(agent.skill_count).toBe(3);
    const effective = await new SkillsRepository(pg.handle.db).effectiveForAgent(id);
    expect(effective.map((s) => s.name)).toEqual(['pr-quality-rubric', 'secret-leakage-gate', 'lethal-trifecta']);
    await app.close();
  });

  it('Test Quality Reviewer: 3 effective skills in order', async () => {
    const app = await makeApp();
    const id = await agentId('Test Quality Reviewer');
    const agent = (await app.inject({ method: 'GET', url: `/agents/${id}` })).json();
    expect(agent.skill_count).toBe(3);
    const effective = await new SkillsRepository(pg.handle.db).effectiveForAgent(id);
    expect(effective.map((s) => [s.name, s.type])).toEqual([
      ['test-branch-coverage', 'rubric'],
      ['test-corner-cases', 'rubric'],
      ['test-mock-discipline', 'convention'],
    ]);
    await app.close();
  });

  it('api-breaking-changes is enabled and linked to no agent', async () => {
    const app = await makeApp();
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    const skill = list.find((s: { name: string }) => s.name === 'api-breaking-changes');
    expect(skill).toMatchObject({ type: 'rubric', source: 'manual', enabled: true, agent_count: 0 });
    const links = await pg.handle.db.select().from(t.agentSkills).where(eq(t.agentSkills.skillId, skill.id));
    expect(links).toEqual([]);
    // General Reviewer starts with no skills (the experiment links it by hand).
    const general = (await app.inject({ method: 'GET', url: `/agents/${await agentId('General Reviewer')}` })).json();
    expect(general.skill_count).toBe(0);
    await app.close();
  });

  it('seeding again keeps every count and never overwrites user link choices', async () => {
    const before = await counts();
    await seed(pg.handle.db);
    expect(await counts()).toEqual(before);

    // A user re-orders and toggles Security Reviewer's skills; a re-seed keeps it.
    const app = await makeApp();
    const id = await agentId('Security Reviewer');
    const view = (await app.inject({ method: 'GET', url: `/agents/${id}/skills` })).json() as Array<{
      skill_id: string;
      enabled: boolean;
    }>;
    const reordered = [...view].reverse().map((v) => ({ skill_id: v.skill_id, enabled: !v.enabled }));
    expect(
      (await app.inject({ method: 'PUT', url: `/agents/${id}/skills`, payload: { skills: reordered } })).statusCode,
    ).toBe(200);

    await seed(pg.handle.db);
    const after = (await app.inject({ method: 'GET', url: `/agents/${id}/skills` })).json() as Array<{
      skill_id: string;
      enabled: boolean;
    }>;
    expect(after.map((v) => ({ skill_id: v.skill_id, enabled: v.enabled }))).toEqual(reordered);
    expect(await counts()).toEqual(before);
    await app.close();
  });
});
