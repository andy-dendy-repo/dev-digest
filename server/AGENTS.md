# server/ (`@devdigest/api`) — AGENTS.md

Fastify API + Postgres; also hosts the repo-intel indexer. Project map: [../AGENTS.md](../AGENTS.md)

## Stack
Fastify 5 · Drizzle ORM 0.45 + drizzle-kit 0.31 · postgres.js 3 · Zod 3.25 · Vitest 2 +
testcontainers 10 · octokit 4 · @ast-grep/napi 0.43 · dependency-cruiser 17 · graphology 0.26 ·
js-tiktoken · openai 4 / @anthropic-ai/sdk 0.33

## Commands (pnpm)
- `pnpm dev` — API on :3001 (tsx watch)
- `pnpm typecheck` — run before declaring work done
- Unit (hermetic): `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- Integration (needs Docker): `pnpm exec vitest run .it.test`
- `pnpm db:generate` → new migration from `src/db/schema/*`
- `pnpm db:migrate` · `pnpm db:seed` (seed is idempotent)

## Map
- `src/modules/<name>/` — feature modules: `routes` → `service` → `repository`
- `src/adapters/` — external world (GitHub, git, LLM, embedder, ast-grep, depgraph…) behind interfaces
- `src/platform/` — DI container, SSE run bus, jobs, config, errors
- `src/db/` — Drizzle schema (`schema/`), migrations, seed
- `src/vendor/shared/` — **source of truth** for `@devdigest/shared` Zod contracts
- `test/` — tests; `test/helpers/pg.ts` = testcontainers Postgres

## Conventions
- New external dependency = adapter + interface, wired only in `src/platform/container.ts`,
  with a mock in `src/adapters/mocks.ts`. Services depend on interfaces, never concrete classes.
- Review logic belongs in `reviewer-core`; the server only resolves context, persists, and streams.
- A test that touches the DB **must** be named `*.it.test.ts`, or it leaks into the hermetic lane.
- Prefer `MockLLMProvider` / `MockGitClient` over real keys or network in tests.

## Gotchas
- Migrations are **not** applied on boot — run `pnpm db:migrate` after pulling schema changes.
- The schema already has tables for later milestones (eval, ci, skills, knowledge…). Unused ≠ dead.
- Repo intel is ON by default (`REPO_INTEL_ENABLED=false` opts out) and can be switched off per agent.
  An unindexed repo silently degrades to a diff-only prompt.

## Do not touch
- `package.json` is `skip-worktree` locally — do not commit changes to it.
- `clones/**` — runtime git clones (git-ignored); never read as source or include in tests.
- Existing files in `src/db/migrations/` — add a new migration instead.

## Read when…
- **Read [onion-architecture](../.claude/skills/onion-architecture/SKILL.md) before** adding or moving a route, service, repository, adapter, or any import that crosses `modules/`, `db/`, `adapters/`, `platform/`; finish with its layer check.
- **Read [README.md](README.md) when** adding a route, an env var, or changing what goes into the review prompt.
- **Read [src/modules/repo-intel/README.md](src/modules/repo-intel/README.md) when** touching indexing, ranking, the repo map, or the `repoIntel` facade.
- **Read [specs/](specs/README.md) before** building a server feature; **[docs/](docs/README.md)** for design decisions.
- **Read [INSIGHTS.md](INSIGHTS.md) before** a non-trivial change here; record new lessons via the [engineering-insights](../.claude/skills/engineering-insights/SKILL.md) skill.
