import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { PrMeta } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { DrizzlePullsRepository } from '../src/modules/pulls/repository.js';
import { DrizzleSettingsRepository } from '../src/modules/settings/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

function prMeta(number: number, over: Partial<PrMeta> = {}): PrMeta {
  return {
    number,
    title: `PR ${number}`,
    author: 'dev',
    branch: `feat/${number}`,
    base: 'main',
    head_sha: `sha-${number}`,
    additions: 0,
    deletions: 0,
    files_count: 0,
    status: 'open',
    opened_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  };
}

/** The one-statement upserts that replaced the per-row loops (B2). */
d('batched upserts (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let userId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    const [user] = await pg.handle.db.select().from(t.users);
    workspaceId = ws!.id;
    userId = user!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('PullsPort.upsertMany inserts new PRs and refreshes only list-owned fields of known ones', async () => {
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'batch', fullName: 'acme/batch' })
      .returning();
    const pulls = new DrizzlePullsRepository(pg.handle.db);

    await pulls.upsertMany(workspaceId, repo!.id, [prMeta(1), prMeta(2)]);
    const [first] = await pulls.listForRepo(repo!.id).then((r) => r.filter((p) => p.number === 1));
    await pulls.updateStats(first!.id, { additions: 5, deletions: 2, filesCount: 1 });

    // Re-sync: PR 1 moved (title/head/state/updated_at), PR 3 is new; the list
    // payload's zero diff stats must not wipe the backfilled ones.
    await pulls.upsertMany(workspaceId, repo!.id, [
      prMeta(1, { title: 'Renamed', head_sha: 'sha-1b', status: 'merged', updated_at: '2026-06-02T00:00:00Z' }),
      prMeta(3),
    ]);

    const rows = await pg.handle.db
      .select()
      .from(t.pullRequests)
      .where(eq(t.pullRequests.repoId, repo!.id));
    expect(rows.map((r) => r.number).sort()).toEqual([1, 2, 3]);
    const one = rows.find((r) => r.number === 1)!;
    expect(one).toMatchObject({
      title: 'Renamed',
      headSha: 'sha-1b',
      status: 'merged',
      additions: 5,
      deletions: 2,
      filesCount: 1,
    });
    expect(one.updatedAt!.toISOString()).toBe('2026-06-02T00:00:00.000Z');
    expect(one.openedAt!.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('SettingsPort.upsertMany overwrites existing keys and adds new ones', async () => {
    const settings = new DrizzleSettingsRepository(pg.handle.db);
    await settings.upsertMany(workspaceId, userId, [
      { key: 'theme', value: 'light' },
      { key: 'batch_test', value: { a: 1 } },
    ]);
    const prefs = Object.fromEntries((await settings.list(workspaceId)).map((r) => [r.key, r.value]));
    expect(prefs.theme).toBe('light');
    expect(prefs.batch_test).toEqual({ a: 1 });
  });
});
