/**
 * JobRunner — a job that ultimately fails must be recorded as `failed` and must
 * NOT surface as an unhandled promise rejection. Nobody awaits `EnqueuedJob.done`
 * in production, so an unhandled rejection there would crash the API process
 * (Node ≥ 15 exits on unhandled rejections).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { JobRunner } from '../src/platform/jobs.js';
import type { Db } from '../src/db/client.js';

/** Minimal Drizzle-shaped fake: records every `.set(...)` the runner issues. */
function fakeDb() {
  const updates: Record<string, unknown>[] = [];
  const db = {
    insert: () => ({
      values: () => ({ returning: async () => [{ id: 'job-1' }] }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values);
        return { where: async () => undefined };
      },
    }),
  };
  return { db: db as unknown as Db, updates };
}

describe('JobRunner', () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);

  afterEach(() => {
    process.off('unhandledRejection', onRejection);
    rejections.length = 0;
  });

  it('records a failed job without an unhandled rejection', async () => {
    process.on('unhandledRejection', onRejection);
    const { db, updates } = fakeDb();
    const runner = new JobRunner(db, { retries: 0, timeoutMs: 1000 });
    runner.register('boom', async () => {
      throw new Error('clone failed');
    });

    const job = await runner.enqueue('ws-1', 'boom', {});
    await runner.onIdle();
    // give Node a macrotask to report any unhandled rejection
    await new Promise((r) => setTimeout(r, 20));

    expect(rejections).toEqual([]);
    expect(updates.at(-1)).toMatchObject({ status: 'failed', error: 'clone failed' });
    // callers that DO await `done` still observe the failure
    await expect(job.done).rejects.toThrow('clone failed');
  });

  it('marks a successful job done', async () => {
    const { db, updates } = fakeDb();
    const runner = new JobRunner(db, { retries: 0 });
    runner.register('ok', async () => undefined);

    const job = await runner.enqueue('ws-1', 'ok', {});
    await job.done;

    expect(updates.at(-1)).toMatchObject({ status: 'done' });
  });
});
