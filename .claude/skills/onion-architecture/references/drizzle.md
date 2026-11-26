# Drizzle + postgres.js: the Infrastructure ring

Drizzle tables, query builders, `SQL` fragments, `$inferSelect` row types and the
postgres.js client are persistence details. They live in `src/db/**` and in each
module's `repository.ts` / `repository/**`. Nothing inward knows they exist. The core
asks a **port** for domain data.

## Port in the core, implementation outside

```ts
// src/modules/pulls/ports.ts: Application ring, domain types only
import type { PrMeta, RepoRef } from '@devdigest/shared';

export interface PullsRepoRef extends RepoRef { id: string }
export interface PullsPort {
  findRepo(workspaceId: string, repoId: string): Promise<PullsRepoRef | null>;
  listForRepo(repoId: string): Promise<PrMeta[]>;
}
```

```ts
// src/modules/pulls/repository.ts: Infrastructure ring
import { and, eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';
import type { Db } from '../../db/client.js';
import type { PullsPort } from './ports.js';

export class DrizzlePullsRepository implements PullsPort {
  constructor(private db: Db) {}
  async findRepo(workspaceId: string, repoId: string) {
    const [row] = await this.db.select().from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row ? { id: row.id, owner: row.owner, name: row.name } : null;
  }
  async listForRepo(repoId: string) {
    const rows = await this.db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repoId));
    return rows.map(toPrMeta);          // map row → domain here, never in the service
  }
}
```

Rules:
- **Port signatures use domain types** (`@devdigest/shared` contracts or `<m>/domain.ts`
  types). They never use `typeof t.x.$inferSelect`, `db/rows.ts` types, `SQL`, `Db`,
  or a transaction type. Row → domain mapping happens inside the repository.
- **Only repositories and `src/db/**` import `db/schema`.** A route or service that
  needs data adds a port method.
- **A module owns its tables' repository.** To read another module's data, depend on
  that module's port, exposed through the container (`container.reviewRepo`,
  `container.agentsRepo`). Importing `../reviews/repository/*.ts` from `pulls/` is
  what `no-foreign-repository` blocks.
- **Watch the type mapping.** drizzle-orm 0.45 returns Postgres `numeric` as a JS
  `string`. Use `doublePrecision` for numbers that cross into `z.number()` contracts,
  or convert in the repository (see `server/INSIGHTS.md`).
- **Migrations are infrastructure history.** Change `src/db/schema/*`, run
  `pnpm db:generate`, and add a new file. Existing migrations are never edited.

## Transactions

Atomicity is a use-case decision: "accept the review *and* record the run, or
neither". So the use case opens the transaction, through a port, without seeing
Drizzle.

```ts
// ports.ts (Application)
export interface UnitOfWork {
  run<T>(work: (repos: { reviews: ReviewsPort; runs: RunsPort }) => Promise<T>): Promise<T>;
}

// src/db/unit-of-work.ts (Infrastructure)
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private db: Db) {}
  run<T>(work: (repos: { reviews: ReviewsPort; runs: RunsPort }) => Promise<T>) {
    return this.db.transaction((tx) =>
      work({ reviews: new ReviewRepository(tx), runs: new RunRepository(tx) }),
    );
  }
}
```

- Repositories take `Db | Tx` in their constructor so the same class serves both
  paths.
- A repository never opens its own transaction around another repository's writes.
- The in-memory fake `UnitOfWork` for tests just calls `work(fakes)`.

## postgres.js

The client is created once in `src/db/client.ts` (`createDb`). Only `db/` imports
`postgres`. Raw SQL (`sql\`…\``) goes in a repository, like any other query.
