---
name: onion-architecture
description: >
  Onion Architecture for DevDigest backend code (server/, reviewer-core/): which ring a
  file belongs to, which way imports may point, where ports, repositories, adapters and
  Zod parsing live, and a dependency-cruiser layer check that fails on new violations.
  Use whenever you add or change a route, service or use case, repository or Drizzle
  query, adapter or SDK client (GitHub, git, LLM, ast-grep…), DB-backed feature, or
  reviewer-core engine code; when a backend import crosses modules/, db/, adapters/ or
  platform/; and when reviewing or refactoring backend layering. Use it even when the
  request never says "architecture": every backend feature lands in these rings.
metadata:
  version: "1.2.1"
  updated: "2026-11-27"
  sources: references.md
---

# Onion Architecture: DevDigest backend

**Dependency Rule: source-code imports point inward.** Inner rings define interfaces
(**ports**); outer rings implement them (**adapters**, **repositories**); one
**composition root** wires the two. The core runs without Postgres, GitHub, git, the
filesystem or an LLM.

Why this matters here: the outside world in this app is slow, billed, and swappable
(three LLM providers, GitHub, shallow git clones, ripgrep, ast-grep). If a use case
calls it through a port, a test can swap in a fake and stay in the hermetic lane, and
replacing a provider means writing one adapter. `reviewer-core` is also consumed by a
CI agent runner, so it must stay pure.

## Rings (centre → outside)

Paths are relative to `server/` unless marked.

| Ring | Files | May import |
|---|---|---|
| **Domain** | `src/vendor/shared/**` (Zod contracts + port interfaces in `adapters.ts`), `src/modules/<m>/domain.ts` | `zod` and other domain files only |
| **Engine** | `reviewer-core/src/**` except `src/llm/` | Domain; talks to the LLM only through the `LLMProvider` port |
| **Application** | Everything else in `src/modules/<m>/`: `service.ts`, `ports.ts`, helpers, `pipeline/`, executors | Domain, Engine, its own `ports.ts`, pure platform utilities (`errors`, `resilience`, `run-logger`, `sse`, `price-book`, `model-router`, `local-only`, `grounding`, `prompt`, `structured`, `trace-builder`), pure compute libs (`graphology`, `p-queue`), pure Node builtins (`path`, `url`, `crypto`) |
| **Infrastructure** | `src/db/**`, `src/adapters/**`, `src/modules/<m>/repository.ts` and `repository/**`, `src/platform/{jobs,contained-read,prompts}.ts`, `reviewer-core/src/llm/` | Anything inward, plus Drizzle, postgres.js, SDKs and Node I/O (`fs`, `child_process`, `net`…) |
| **Presentation** | `src/modules/<m>/routes.ts`, `src/modules/index.ts`, `src/modules/_shared/**` | Application and Domain, plus `app.container` to build services |
| **Composition root** | `src/platform/container.ts`, `src/platform/config.ts`, `src/app.ts`, `src/server.ts` | Everything; the only place that does `new ConcreteAdapter()` |

`src/modules/<m>/index.ts` is a module barrel, the public surface for the composition
root. Another module imports the specific file it needs (types, constants, ports), never
a foreign barrel: a barrel may re-export its repository.

The layer check identifies a file's ring by its **file name**. Name a new file after
its role (`ports.ts`, `domain.ts`, `repository.ts`, `routes.ts`) so the check sees it
in the right ring.

## Workflow

1. **Classify.** Put every file you will touch into a ring using the table above. A
   pure function needed by the core (no I/O, no native binary) belongs in Domain or
   Application, even if similar code sits in `src/adapters/` today.
2. **Build inside-out.**
   1. Domain type or Zod contract.
   2. Port interface in `<m>/ports.ts`, or in `vendor/shared/adapters.ts` for an
      external system.
   3. Use case in `service.ts` that receives its ports as constructor arguments.
   4. Infrastructure implementation.
   5. Route.
   6. Wiring in `container.ts`, plus a mock in `src/adapters/mocks.ts`.
3. **Model on the target shape, not on neighbours.** Many existing files are recorded
   debt in `assets/known-violations.json`, e.g. `pulls/routes.ts` querying Drizzle,
   and services taking the whole `Container`. Copy the shapes in
   [examples.md](examples.md) instead.
4. **Run the layer check** (below) and fix what it reports.
5. **Test by ring.** Use cases get in-memory fakes of their ports. Repositories get
   `*.it.test.ts` with testcontainers. Routes get `app.inject()`. See
   [references/testing.md](references/testing.md).

**Done when** all of the following hold:
- The layer check exits 0.
- `pnpm typecheck` passes in `server/`. If `reviewer-core` changed, `npm run typecheck`
  passes there too.
- Tests type-check: `pnpm exec tsc --noEmit -p tsconfig.test.json` (`pnpm typecheck`
  skips `test/`; see [references/testing.md](references/testing.md#type-check-your-tests-yourself)).
- Every new port has a real implementation wired in `container.ts` and a fake or mock
  used by a test.

## Recipes

- **New endpoint.**
  1. Write a Zod schema for params and body (route), and a response contract in
     `vendor/shared` (copy it to `client/src/vendor/shared` if the UI reads it).
  2. Add a use-case method on the module's service.
  3. Add a port method in `ports.ts`, implement it in `repository.ts`, and wire it in
     the container through a getter typed as the port.
  4. The route stays thin: `parse → service.method(...) → return`.
- **New external system** (API, CLI, SDK).
  1. Add a port interface in `vendor/shared/adapters.ts` that uses domain types only.
  2. Implement it in `src/adapters/<name>/`, translating SDK errors into
     `ExternalServiceError`.
  3. Construct it lazily in `container.ts`, with an `overrides` slot.
  4. Add a mock in `mocks.ts`.

  See [references/adapters-di.md](references/adapters-di.md).
- **New input for the review engine** (repo docs, config, extra context).
  1. Add an optional field to `ReviewInput` in `reviewer-core`.
  2. The server resolves the value through a port, e.g. `GitClient.readFile` for a
     file in the clone, and passes the string in.
  3. Untrusted text goes through the engine's `wrapUntrusted` fencing.

  See [references/reviewer-core.md](references/reviewer-core.md).
- **New table or query.** Write the schema in `src/db/schema/`, then run
  `pnpm db:generate` for a new migration. The repository maps rows to domain types,
  and the port signature never mentions Drizzle. See
  [references/drizzle.md](references/drizzle.md).
- **Several writes that must be atomic.** The use case opens the unit of work, and
  repositories accept the transaction handle. See
  [references/drizzle.md](references/drizzle.md#transactions).
- **Editing a file listed as known debt.** Leave it no worse. When you remove a
  violation, regenerate the baseline (below) so the fixed import cannot come back
  unnoticed.

## Per-tool rules

Read the file for each tool you touch:

- Fastify routes, plugins, errors → [references/fastify.md](references/fastify.md)
- Drizzle, postgres.js, repositories, transactions → [references/drizzle.md](references/drizzle.md)
- Zod, where to parse, contracts → [references/zod.md](references/zod.md)
- Ports, adapters, container, mocks, SDK clients → [references/adapters-di.md](references/adapters-di.md)
- reviewer-core engine → [references/reviewer-core.md](references/reviewer-core.md)
- Tests per ring → [references/testing.md](references/testing.md)
- Good/bad pairs from this codebase → [examples.md](examples.md)
- Sources behind these rules → [references.md](references.md)

These rules say **where** code lives. For **how** to write it, use the sibling skills
`fastify-best-practices`, `drizzle-orm-patterns`, `zod`, and `postgresql-table-design`.

## Layer check

Run from `server/`, since dependency-cruiser is a server dependency. Install
dependencies first: `pnpm install` in `server/` and `npm ci` in `reviewer-core/`. The
package rules match resolved `node_modules/<pkg>/` paths, and the `resolvable` rule
fails the check when they are missing.

```bash
pnpm exec depcruise src ../reviewer-core/src \
  --config ../.claude/skills/onion-architecture/assets/depcruise.cjs \
  --ignore-known ../.claude/skills/onion-architecture/assets/known-violations.json
```

Exit code 0 means no new violations. Existing debt is recorded in
`known-violations.json` and ignored. The rules are in
[assets/depcruise.cjs](assets/depcruise.cjs); each one carries a `comment` saying why
it exists.

| Rule | What it stops |
|---|---|
| `routes-no-infra` | Routes importing `db/`, adapters, repositories, Drizzle, SDKs or Node I/O |
| `core-no-infra` | Application code importing `db/`, adapters, repositories, Drizzle, SDKs, Fastify or Node I/O |
| `core-platform-pure-only` | Application code importing an outer-ring platform file (`jobs`, `contained-read`, `prompts`, `config`) |
| `core-no-container` | Application code importing `Container` (service locator) |
| `no-foreign-repository` | One module importing another module's repository |
| `no-foreign-barrel` | One module importing another module's `index.ts` |
| `domain-is-pure` | Domain files importing anything except `zod` and domain files |
| `engine-no-io` | `reviewer-core` importing Node I/O builtins or server code |
| `engine-sdk-only-in-llm` | An LLM SDK used outside `reviewer-core/src/llm/` |
| `resolvable` | Unresolved imports (dependencies not installed) |
| `no-circular` (warn) | Import cycles inside `src/modules/` |

The check sees imports only. Globals such as `fetch(...)`, `process.env` and
`setInterval` slip past it. In the Engine and Application rings, review them by hand.

After you **remove** debt, regenerate the baseline with the same command, replacing
`--ignore-known …` with `--output-type baseline --output-to
../.claude/skills/onion-architecture/assets/known-violations.json`. Commit the shorter
file. Regenerate only to remove entries. If new code produces a violation, fix the
code.
