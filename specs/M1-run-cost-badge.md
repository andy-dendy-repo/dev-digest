# M1 — Run Cost Badge
**Status:** in progress
**Affected modules:** server · client

## Goal
Show the USD cost and token usage of every agent review run, so the price of a
review is visible at a glance: per PR in the list, and per run on the PR page.

## Scope
- In:
  1. **PR list** — a `COST` column: the total cost of all completed runs of the PR (e.g. `$0.014`).
  2. **Agent runs timeline** (PR detail) — each completed run shows total tokens and cost
     next to its time (e.g. `9,119 tok · $0.0013`).
  3. **Run Trace → Stats** — a `COST` card next to Duration, Tokens and Findings.
  4. **Verdict banner** (Review Runs) — cost and token split for that run
     (e.g. `$0.014 · 8.2K→1.3K`).
  - The run log records the run's token usage and cost, so a shown price can be
    checked against the log.
- Out:
  - Cost for runs made before this feature (shown as "no data").
  - Cost for failed or cancelled runs.
  - CI-runner runs, budgets/alerts, aggregate cost dashboards.

## Contracts
`@devdigest/shared` — new optional/nullable fields, no new routes:

| Schema | Field | Meaning |
|---|---|---|
| `RunSummary` (`GET /pulls/:id/runs`) | `cost_usd: number \| null` | Cost of the run in USD; null when unknown |
| `RunStats` (`GET /runs/:id/trace`, `stats`) | `cost_usd?: number \| null` | Same; absent in older traces |
| `PrMeta` (`GET /repos/:id/pulls`) | `cost_usd?: number \| null` | Sum over the PR's completed runs; null if none has a cost |

## Acceptance criteria
- [ ] Every completed run shows its cost in the timeline, Run Trace Stats and the verdict banner.
- [ ] The PR list shows the sum over the PR's completed runs.
- [ ] Runs without data (running, failed, cancelled, pre-feature, unknown model price)
      show `—`, never `$0.00`. A genuinely free model shows `$0`.
- [ ] Costs keep at least 3 decimals for small values: `$0.012` (not `$0.01`), `$0.0013`.
- [ ] For one real run, the shown cost matches the run log and the OpenRouter dashboard.
- [ ] The feature makes no additional model calls.

## Notes
- The cost is already computed during a run (OpenRouter's reported cost, or a
  price-table estimate) but is not persisted today; this feature persists and
  surfaces it.
- First personal metric of the course — L08 revisits these numbers.
- Implementation plan: [M1-run-cost-badge.plan.md](M1-run-cost-badge.plan.md).
