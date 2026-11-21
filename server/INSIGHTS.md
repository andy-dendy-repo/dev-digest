# INSIGHTS — server/

Non-obvious lessons for this module, read before non-trivial work here.
**Append-only:** add entries at the end of a section; never rewrite or delete (corrections → `Supersedes "<title>" (<date>): …`).
Entry format: `- **YYYY-MM-DD — <title>.** <Do/avoid X> when <context>, because <why>. (\`path\`)`
Record with `/engineering-insights` (capture · wrap-up · review). Rules belong in `CLAUDE.md`, design in `docs/`.

## What Works
<!-- Approaches and solutions that proved themselves. -->

## What Doesn't Work
<!-- Dead ends and antipatterns — always with WHY. Most-skipped, most valuable. -->

## Codebase Patterns
<!-- Non-default conventions and architecture decisions. -->
- **2026-11-21 — File rank is PageRank only; `hotness` is always 0 ("Option B").** Don't treat `hotness` as a signal or make it non-zero without first deepening clones, because clones are shallow (`CLONE_DEPTH = 1`) so there is no churn history. (`server/src/modules/repo-intel/pipeline/rank.ts`)
- **2026-11-21 — Run cost comes from the engine, never recompute it.** Use `outcome.costUsd` from `reviewPullRequest` (OpenRouter's real `usage.cost`, else the PriceBook estimate) when persisting `agent_runs.cost_usd`, because recomputing tokens × price would diverge from the OpenRouter dashboard; failed/cancelled runs write `null`, not 0. (`server/src/modules/reviews/run-executor.ts`)
- **2026-11-21 — `setupRepoAndPr` always creates PR #482 in a fresh repo.** Change the second PR's `number` before moving it into the same repo in a test, because `pull_requests` is unique on (repo_id, number). (`server/test/reviews.it.test.ts`)

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->
- **2026-11-21 — Use `doublePrecision` for USD columns, not `numeric`.** drizzle-orm 0.45 maps Postgres `numeric` to a JS `string` by default, which would leak strings into `z.number()` contracts; `agent_runs.cost_usd` is `doublePrecision` for that reason. (`server/src/db/schema/runs.ts`)

## Recurring Errors & Fixes
<!-- Exact error message → fix. -->

## Session Notes
<!-- ### YYYY-MM-DD — <task>, then 2–4 lines. -->
### 2026-11-21 — M1 run cost badge (server side)
Re-added `agent_runs.cost_usd` (migration 0010, `doublePrecision`), persisted from `outcome.costUsd`, exposed on `RunSummary`, `RunStats` and `PrMeta` (PR list = SUM over `done` runs via `costByPull`). Run log now has a `Usage: in→out tokens · $X` line. Not yet verified against a live OpenRouter run.

## Open Questions
<!-- Unresolved or unverified items. -->
