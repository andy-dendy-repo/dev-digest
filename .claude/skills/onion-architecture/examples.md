# Examples: current code → target shape

Each "before" below was real code from this repo. All of it has since been fixed
(each example says where) and is kept as the worked example. Write new code in the
"after" shape.

## 1. Route queries the database (`routes-no-infra`)

**Before:** `server/src/modules/pulls/routes.ts` (fixed in the B2 refactor: the
"after" shape below is now the real `pulls/{ports,service,repository,routes}.ts`)

```ts
import { and, eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';
import { costByPull } from '../reviews/repository/run.repo.js';   // also no-foreign-repository

app.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(container, req);
  const [repo] = await container.db.select().from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, req.params.id)));
  if (!repo) throw new NotFoundError('Repo not found');
  // …GitHub sync, more queries, rollups, cost lookups…
});
```

The route decides business rules, owns the GitHub fallback, and knows the schema of
four tables. None of it can be tested without Postgres.

**After**

```ts
// pulls/ports.ts (Application)
import type { GitHubClient, PrMeta, RepoRef } from '@devdigest/shared';
export interface PullsRepoRef extends RepoRef { id: string }
export interface PullsPort {
  findRepo(workspaceId: string, repoId: string): Promise<PullsRepoRef | null>;
  listForRepo(repoId: string): Promise<PrMeta[]>;
}
export interface RunCostsPort { costByPull(pullIds: string[]): Promise<Map<string, number>>; }
export interface PullsServiceDeps {
  pulls: PullsPort;
  costs: RunCostsPort;
  github: () => Promise<GitHubClient>;
}

// pulls/service.ts (Application)
export class PullsService {
  constructor(private deps: PullsServiceDeps) {}
  async listForRepo(workspaceId: string, repoId: string): Promise<PrMeta[]> {
    const repo = await this.deps.pulls.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    // sync + rollup logic, all through ports
  }
}

// pulls/routes.ts (Presentation)
const pulls = new PullsService({
  pulls: container.pullsRepo, costs: container.reviewRepo, github: () => container.github(),
});
app.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(container, req);
  return pulls.listForRepo(workspaceId, req.params.id);
});
```

The run-cost query reaches `pulls` as a port implemented by the reviews repository and
exposed through the container. `pulls` no longer imports a file under `reviews/`.

## 2. Service takes the whole container (`core-no-container`)

**Before:** `server/src/modules/agents/service.ts` (fixed in the B3 refactor; `agents/` and
`repos/` now have this shape)

```ts
import type { Container } from '../../platform/container.js';
export class AgentsService {
  constructor(private container: Container) {}
}
```

**After**

```ts
export interface AgentsServiceDeps {
  agents: AgentsPort;                                     // from agents/ports.ts
  llm: (id: Provider) => Promise<LLMProvider>;            // lazy, keys resolved by the container
}
export class AgentsService {
  constructor(private deps: AgentsServiceDeps) {}
}
// routes.ts
const service = new AgentsService({ agents: app.container.agentsRepo, llm: (id) => app.container.llm(id) });
```

The constructor now lists every dependency, and a test passes two small fakes.

## 3. Port leaks Drizzle row types (`core-no-infra` on `db/rows.ts`)

**Before** (fixed in the B4 refactor: `reviews/ports.ts` returns `ReviewRecord`,
`FindingRecord`, `ReviewPull`; the mapping is in `reviews/repository/mappers.ts`)

```ts
// reviews/service.ts
import type { FindingRow } from '../../db/rows.js';   // = typeof t.findings.$inferSelect
```

**After**

```ts
// reviews/ports.ts
import type { Finding } from '@devdigest/shared';
export interface ReviewsPort { findingsFor(reviewId: string): Promise<Finding[]>; }
// reviews/repository.ts maps FindingRow → Finding inside the implementation
```

Renaming a column now changes one repository instead of every consumer of the row
type.

## 4. Use case imports a pure helper from `adapters/` (`core-no-infra`)

**Before:** `reviews/diff-loader.ts` → `../../adapters/git/diff-parser.js` (fixed in
the B4 refactor: the parser is now `reviews/diff.ts`)

`parseUnifiedDiff` is a pure string → structure function with no I/O. It sits in
`adapters/` only by history.

**After:** move it to `reviews/domain.ts` (or a `diff.ts` in the module) and import it
from there. A helper that **does** wrap I/O or a native binding (`@ast-grep/napi`,
`simple-git`) stays in `adapters/`, and the use case receives it through a port.

## 5. Engine reaching outward (`engine-no-io`, `engine-sdk-only-in-llm`)

**Wrong:** inside `reviewer-core/src/review/run.ts`

```ts
import { readFile } from 'node:fs/promises';
const skills = await readFile(skillPath, 'utf8');
```

**Right:** the server resolves the text and passes it in.

```ts
await reviewPullRequest({ systemPrompt, model, diff, llm, skills: resolvedSkillBodies /* string[] */ });
```
