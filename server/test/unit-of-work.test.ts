import { describe, it, expect } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm';
import { DrizzleUnitOfWork } from '../src/db/unit-of-work.js';
import { PersistenceError } from '../src/platform/errors.js';
import type { Db } from '../src/db/client.js';

/** A Db stand-in whose transaction just runs the callback (no Postgres). */
const fakeDb = { transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn({}) } as unknown as Db;

describe('DrizzleUnitOfWork error translation', () => {
  it('turns a failed query into a PersistenceError with a short message; the driver error stays on cause', async () => {
    const uow = new DrizzleUnitOfWork(fakeDb, () => ({}));
    const driver = new DrizzleQueryError('insert into "run_traces" values ($1, $2)', ['id', '{"huge":"trace"}'], new Error('boom'));
    const err = await uow
      .run(async () => {
        throw driver;
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PersistenceError);
    expect((err as Error).message).not.toMatch(/Failed query|params|trace/);
    expect((err as Error).cause).toBe(driver);
  });

  it('passes other errors through unchanged', async () => {
    const uow = new DrizzleUnitOfWork(fakeDb, () => ({}));
    const own = new Error('business rule');
    await expect(
      uow.run(async () => {
        throw own;
      }),
    ).rejects.toBe(own);
  });
});
