import type { Db, DbOrTx } from './client.js';

/**
 * Drizzle implementation of the per-module `UnitOfWork` ports (e.g.
 * `ReviewsUnitOfWork` in `modules/reviews/ports.ts`).
 *
 * `run(work)` opens ONE Postgres transaction, builds the repositories the
 * use case asked for on that transaction (`makeRepos(tx)`), and commits when
 * `work` resolves — or rolls everything back when it throws. The use case
 * decides what must be atomic; it never sees Drizzle or the `Tx` type, only
 * the ports it gets from `makeRepos`.
 *
 * Keep slow I/O (LLM calls, GitHub, parsing) OUTSIDE `work`: the transaction
 * holds a pooled connection and row locks for as long as `work` runs.
 *
 * Wired in the composition root:
 *   new DrizzleUnitOfWork(db, (tx) => ({ reviews: new ReviewRepository(tx) }))
 */
export class DrizzleUnitOfWork<Repos> {
  constructor(
    private readonly db: Db,
    private readonly makeRepos: (tx: DbOrTx) => Repos,
  ) {}

  run<T>(work: (repos: Repos) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(this.makeRepos(tx)));
  }
}
