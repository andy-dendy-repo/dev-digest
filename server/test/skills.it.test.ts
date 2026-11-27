import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
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
 * M2 skills over real Postgres: CRUD + body versions, the agent Skills tab
 * (ordered links with per-agent flags, agent version snapshot), the workspace
 * guard, and which skills a run would use.
 */
d('skills API', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
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

  const skill = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    description: `Flag ${name} problems.`,
    type: 'rubric',
    body: `# ${name}\nRule body.`,
    ...extra,
  });

  it('creates, lists, edits (body change → new version) and deletes a skill', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: skill('crud-skill') });
    expect(created.statusCode).toBe(201);
    const s = created.json();
    expect(s).toMatchObject({ name: 'crud-skill', source: 'manual', enabled: true, version: 1, agent_count: 0 });
    expect(s.token_count).toBeGreaterThan(0);

    const dup = await app.inject({ method: 'POST', url: '/skills', payload: skill('crud-skill') });
    expect(dup.statusCode).toBe(409);

    const renamed = await app.inject({ method: 'PUT', url: `/skills/${s.id}`, payload: { description: 'Flag it.' } });
    expect(renamed.json().version).toBe(1);
    const edited = await app.inject({ method: 'PUT', url: `/skills/${s.id}`, payload: { body: 'New body.' } });
    expect(edited.json()).toMatchObject({ version: 2, body: 'New body.' });
    const versions = await pg.handle.db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, s.id));
    expect(versions.map((v) => [v.version, v.body]).sort()).toEqual([
      [1, '# crud-skill\nRule body.'],
      [2, 'New body.'],
    ]);

    const list = await app.inject({ method: 'GET', url: '/skills' });
    expect(list.json().map((x: { name: string }) => x.name)).toContain('crud-skill');

    expect((await app.inject({ method: 'DELETE', url: `/skills/${s.id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/skills/${s.id}` })).statusCode).toBe(404);
    await app.close();
  });

  it('import preview stores nothing; a confirmed import is saved disabled', async () => {
    const app = await makeApp();
    const before = (await pg.handle.db.select().from(t.skills)).length;
    const preview = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: {
        filename: 'flaky.zip',
        entries: [{ path: 'flaky/SKILL.md', content: '---\nname: flaky-it\ndescription: Flag flaky tests.\n---\nBody' }],
        skipped: ['flaky/scripts/run.sh'],
      },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      core_path: 'flaky/SKILL.md',
      draft: { name: 'flaky-it', description: 'Flag flaky tests.', body: 'Body' },
      ignored: [{ path: 'flaky/scripts/run.sh', reason: 'not_text' }],
    });
    expect((await pg.handle.db.select().from(t.skills)).length).toBe(before);

    const saved = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { ...preview.json().draft, source: 'imported_file', enabled: true },
    });
    expect(saved.json()).toMatchObject({ source: 'imported_file', enabled: false });
    await app.close();
  });

  it('agent Skills tab: ordered links with per-agent flags; only enabled-for-both skills run', async () => {
    const app = await makeApp();
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Skills Agent', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'p' },
      })
    ).json();
    const ids: string[] = [];
    for (const name of ['link-a', 'link-b', 'link-c']) {
      ids.push((await app.inject({ method: 'POST', url: '/skills', payload: skill(name) })).json().id);
    }
    // link-c globally disabled.
    await app.inject({ method: 'PUT', url: `/skills/${ids[2]}`, payload: { enabled: false } });

    const put = await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: {
        skills: [
          { skill_id: ids[1], enabled: true },
          { skill_id: ids[0], enabled: false },
          { skill_id: ids[2], enabled: true },
        ],
      },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().map((v: { name: string; order: number; enabled: boolean; skill_enabled: boolean }) => [v.name, v.order, v.enabled, v.skill_enabled])).toEqual([
      ['link-b', 0, true, true],
      ['link-a', 1, false, true],
      ['link-c', 2, true, false],
    ]);

    const effective = await new SkillsRepository(pg.handle.db).effectiveForAgent(agent.id);
    expect(effective.map((s) => s.name)).toEqual(['link-b']);

    const got = (await app.inject({ method: 'GET', url: `/agents/${agent.id}` })).json();
    expect(got).toMatchObject({ version: 2, skill_count: 1 });
    const v2 = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/versions/2` })).json();
    expect(v2.config.skills).toEqual([ids[1], ids[2]]);

    // Deleting a skill drops its links.
    await app.inject({ method: 'DELETE', url: `/skills/${ids[1]}` });
    const links = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(and(eq(t.agentSkills.agentId, agent.id), eq(t.agentSkills.skillId, ids[1]!)));
    expect(links).toEqual([]);
    await app.close();
  });

  it("rejects another workspace's skill and hides another workspace's agent", async () => {
    const app = await makeApp();
    const [fws] = await pg.handle.db.insert(t.workspaces).values({ name: 'Foreign skills' }).returning();
    const [fskill] = await pg.handle.db
      .insert(t.skills)
      .values({ workspaceId: fws!.id, name: 'foreign', description: 'd', type: 'custom', source: 'manual', body: 'b' })
      .returning();
    const [fagent] = await pg.handle.db
      .insert(t.agents)
      .values({ workspaceId: fws!.id, name: 'Foreign', provider: 'openai', model: 'm', systemPrompt: 'p' })
      .returning();
    const agent = (await app.inject({ method: 'GET', url: '/agents' })).json()[0];

    const res = await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { skills: [{ skill_id: fskill!.id, enabled: true }] },
    });
    expect(res.statusCode).toBe(422);
    expect((await app.inject({ method: 'GET', url: `/skills/${fskill!.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/agents/${fagent!.id}/skills` })).statusCode).toBe(404);
    await app.close();
  });
});
