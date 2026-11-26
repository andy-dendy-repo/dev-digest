# INSIGHTS — server/

Non-obvious lessons for this module, read before non-trivial work here.
**Append-only:** add entries at the end of a section; never rewrite or delete (corrections → `Supersedes "<title>" (<date>): …`).
Entry format: `- **YYYY-MM-DD — <title>.** <Do/avoid X> when <context>, because <why>. (\`path\`)`
Record with `/engineering-insights` (capture · wrap-up · review). Rules belong in `AGENTS.md`, design in `docs/`.

## What Works
<!-- Approaches and solutions that proved themselves. -->
- **2026-11-27 — Prove atomicity with a raising `BEFORE` trigger, not a mock.** In an `*.it.test.ts`, `CREATE TRIGGER … BEFORE INSERT ON <last table of the flow> … EXECUTE FUNCTION <raise>` makes a real Postgres write fail part-way; assert nothing of the flow is left, then drop the trigger in `afterEach`. Works through the real route/executor with no code seams. (`server/test/transactions.it.test.ts`)

## What Doesn't Work
<!-- Dead ends and antipatterns — always with WHY. Most-skipped, most valuable. -->

## Codebase Patterns
<!-- Non-default conventions and architecture decisions. -->
- **2026-11-21 — File rank is PageRank only; `hotness` is always 0 ("Option B").** Don't treat `hotness` as a signal or make it non-zero without first deepening clones, because clones are shallow (`CLONE_DEPTH = 1`) so there is no churn history. (`server/src/modules/repo-intel/pipeline/rank.ts`)
- **2026-11-21 — Run cost comes from the engine, never recompute it.** Use `outcome.costUsd` from `reviewPullRequest` (OpenRouter's real `usage.cost`, else the PriceBook estimate) when persisting `agent_runs.cost_usd`, because recomputing tokens × price would diverge from the OpenRouter dashboard; failed/cancelled runs write `null`, not 0. (`server/src/modules/reviews/run-executor.ts`)
- **2026-11-21 — `setupRepoAndPr` always creates PR #482 in a fresh repo.** Change the second PR's `number` before moving it into the same repo in a test, because `pull_requests` is unique on (repo_id, number). (`server/test/reviews.it.test.ts`)
- **2026-11-21 — PR list findings = briefs of the latest `kind='review'` review.** Take `latest_findings` from the same newest review that gives the list its score (one extra `IN` query on `findings`), shaped by `toFindingBrief`/`sortBriefs`; `rollupSeverities` in the same file is an unused leftover, because counts are derived client-side from the briefs. (`server/src/modules/pulls/status.ts`, `server/src/modules/pulls/routes.ts`)
- **2026-11-26 — A job that times out is failed, not retried.** Don't assume `JobRunner` retries overlap after a timeout: `withRetry`'s default `isRetryable` only retries 429/5xx/`ECONNRESET`-style errors and `TimeoutError` has neither, while `withTimeout` only races (the handler keeps running). Add an `AbortSignal` if a job must really stop. (`server/src/platform/resilience.ts`, `server/src/platform/jobs.ts`)
- **2026-11-27 — Repositories take `DbOrTx`; cross-repository atomicity goes through a per-module `UnitOfWork` port.** The port lives in `<m>/ports.ts`, the generic `DrizzleUnitOfWork` in `db/unit-of-work.ts`, the getter in the container (`reviewsUow`). A repository may still wrap its own aggregate's writes in `this.db.transaction` (becomes a savepoint inside a UoW), e.g. agent version bumps lock the row with `.for('update')`. (`server/src/db/unit-of-work.ts`, `server/src/modules/agents/repository.ts`)

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->
- **2026-11-21 — Use `doublePrecision` for USD columns, not `numeric`.** drizzle-orm 0.45 maps Postgres `numeric` to a JS `string` by default, which would leak strings into `z.number()` contracts; `agent_runs.cost_usd` is `doublePrecision` for that reason. (`server/src/db/schema/runs.ts`)

- **2026-11-26 — Tests are never type-checked.** Type-check new test files with a temporary `tsconfig` in `server/` that extends `tsconfig.json` and includes your test file, because `pnpm typecheck` includes only `src/**/*.ts`, Vitest strips types, and `test/` already has 15 latent TS errors (so including all of `test/` fails). (`server/tsconfig.json`)
- **2026-11-26 — Supersedes "Tests are never type-checked" (2026-11-26):** `test/` now has 0 type errors; run `pnpm exec tsc --noEmit -p tsconfig.test.json` (src + test). CI `server-unit` runs it, so no temporary tsconfig is needed. (`server/tsconfig.test.json`)
- **2026-11-27 — drizzle-orm 0.45 wraps driver errors: `err.message` is `Failed query: <sql>\nparams: <all params>`.** The Postgres message is on `err.cause`. Don't persist or show `err.message` of a failed write as-is: `run-executor` stores it in `agent_runs.error`, so a failed trace write saves the whole prompt/trace JSON there. (`server/src/modules/reviews/run-executor.ts`)

## Recurring Errors & Fixes
<!-- Exact error message → fix. -->
- **2026-11-27 — `Error: Expected Reaper to map exposed port 8080` fails every `*.it.test.ts` at once.** Testcontainers' Ryuk reaper loses a start race when several suites (or other agents' runs) share the Docker daemon; a single file passes. Run `TESTCONTAINERS_RYUK_DISABLED=true pnpm test` (the helpers stop their containers in `afterAll`). (`server/test/helpers/pg.ts`)

## Session Notes
<!-- ### YYYY-MM-DD — <task>, then 2–4 lines. -->
### 2026-11-21 — M1 run cost badge (server side)
Re-added `agent_runs.cost_usd` (migration 0010, `doublePrecision`), persisted from `outcome.costUsd`, exposed on `RunSummary`, `RunStats` and `PrMeta` (PR list = SUM over `done` runs via `costByPull`). Run log now has a `Usage: in→out tokens · $X` line. Not yet verified against a live OpenRouter run.
### 2026-11-21 — M1 findings preview (server side)
Added `FindingBrief` and `PrMeta.latest_findings` (both `vendor/shared` copies); `GET /repos/:id/pulls` returns the latest review's findings, most severe first, rationale cut to 240 chars; `null` when unreviewed. Covered by contract, unit and integration tests.
### 2026-11-26 — Phase 0/1 fixes from the architecture audit
Failed jobs no longer crash the API (`done` gets a handler), Octokit failures become `ExternalServiceError` (502) after retries, the generic 500 branch hides unexpected messages, polling stores `openedAt`. Test types fixed + CI runs `tsconfig.test.json` and the layer check. Next: phase 2 (UnitOfWork, ports) from the plan.
### 2026-11-27 — B1: transactions + indexes
`DrizzleUnitOfWork` + `DbOrTx`; atomic review persistence (`reviewsUow`), agent insert/update (row lock)/`setSkills`, `deleteAgentRun`, PR detail replace, full reindex (graph built before the tx). Migration 0011 adds FK/lookup indexes. 7 atomicity IT tests, all red on the old code.

## Open Questions
<!-- Unresolved or unverified items. -->
