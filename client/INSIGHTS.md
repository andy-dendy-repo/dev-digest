# INSIGHTS — client/

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
- **2026-11-21 — Component tests load ONE next-intl namespace.** Take a shared component's strings from the namespace of the screens that render it (e.g. `RunCostBadge` → `prReview.cost.*`), because tests like `RunHistory.test.tsx` wrap with `messages={{ prReview: messages }}` only and a key from another namespace fails to render. (`client/src/components/run-cost-badge/RunCostBadge.tsx`)
- **2026-11-21 — Cost "no data" is "—", never "$0.00".** Format USD only via `formatCost` (null → "—", genuine 0 → "$0", ≥ 3 decimals under $1), because an unfinished/failed/pre-M1 run must not look free. (`client/src/lib/format-cost.ts`)

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->

## Recurring Errors & Fixes
<!-- Exact error message → fix. -->

## Session Notes
<!-- ### YYYY-MM-DD — <task>, then 2–4 lines. -->
### 2026-11-21 — M1 run cost badge (client side)
Added `RunCostBadge` (compact / total / split) + `format-cost.ts`; shown in the PR list COST column, Agent runs timeline, Run Trace Stats and VerdictBanner (run joined by `run_id` in `FindingsTab`). Not yet checked visually in the browser.

## Open Questions
<!-- Unresolved or unverified items. -->
