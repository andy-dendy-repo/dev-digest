# Testing by ring

Onion's payoff is that the core is testable without infrastructure. Each ring has a
natural test style, and a test that needs Docker to check business logic means that
logic sits in the wrong ring.

| Ring | Test style | Lane | Fakes |
|---|---|---|---|
| Domain, Engine | Plain unit tests on pure functions | hermetic (`*.test.ts`) | None needed |
| Application (use cases) | Construct the service with in-memory fakes of its ports | hermetic | Small object literals implementing the port, or `src/adapters/mocks.ts` |
| Infrastructure: repositories | Real Postgres via testcontainers (`test/helpers/pg.ts`) | integration (`*.it.test.ts`, **required** for any DB test) | None: this is the real thing |
| Infrastructure: adapters | Unit tests against recorded or stubbed SDK responses; never live keys | hermetic | Stub the SDK, not the port |
| Presentation | `app.inject()` on an app built with `ContainerOverrides` | hermetic if every port is mocked, else `*.it.test.ts` | `MockGitHubClient`, `MockLLMProvider`, … |

## A use-case test

```ts
const pulls: PullsPort = {
  findRepo: async () => ({ id: 'repo', owner: 'acme', name: 'api' }),
  listForRepo: async () => [prMeta({ number: 1 })],
};
const costs: RunCostsPort = { costByPull: async () => new Map() };
const service = new PullsService({ pulls, costs, github: async () => new MockGitHubClient() });

expect(await service.listForRepo('ws', 'repo')).toHaveLength(1);
```

No container, no Docker, no network. If a use case is hard to construct like this,
its dependencies are too wide. Narrow the deps object instead of reaching for the
container.

## Commands (server/)

- Hermetic: `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- Integration (Docker): `pnpm exec vitest run .it.test`
- Layer check: see the "Layer check" section of `../SKILL.md`
