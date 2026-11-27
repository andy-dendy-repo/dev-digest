import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { schema } from './schema.js';

export type Db = PostgresJsDatabase<typeof schema>;

/** An open transaction on {@link Db} (what `db.transaction(cb)` hands to `cb`). */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * What a repository runs its queries on: the shared client, or the transaction
 * of a unit of work (see `unit-of-work.ts`). Taking this instead of `Db` lets
 * the same repository class serve both paths. `db.transaction()` on a `Tx`
 * opens a savepoint, so a repository may still make its own multi-statement
 * writes atomic when it is already inside a unit of work.
 */
export type DbOrTx = Db | Tx;

export interface DbHandle {
  db: Db;
  sql: postgres.Sql;
  close: () => Promise<void>;
}

/**
 * Create a Drizzle client over postgres-js. Used by the app (one shared handle)
 * and by the Testcontainers harness (per-test handle).
 */
export function createDb(databaseUrl: string, opts?: { max?: number }): DbHandle {
  const sql = postgres(databaseUrl, { max: opts?.max ?? 10 });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
