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
- **2026-11-21 — Findings counters count before their own filter.** Compute per-severity counts from the list after "Hide low confidence" but before the severity filter (`countBySeverity(confidentFindings(...))`), because counting the final list would zero the other chips and counting raw findings would disagree with the list once the toggle is on. (`client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx`)

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->
- **2026-11-21 — `@testing-library/user-event` ^14.6 is installed (added for M1 severity filter).** Use `userEvent.setup()` in new client tests; older tests (FindingCard, RunTraceDrawer, SettingsApiKeys) still use `fireEvent` and were left as is. (`client/package.json`)
- **2026-11-21 — `Toggle` has `role="switch"` but no accessible name.** Query it with `getByRole("switch")` (only one per FindingsPanel); `{ name: /hide low/i }` won't match because the label text is a sibling, not a label. (`client/src/vendor/ui/primitives/Toggle.tsx`)

## Recurring Errors & Fixes
<!-- Exact error message → fix. -->
- **2026-11-21 — Finding status tags are lowercase in the DOM.** Query `accepted`/`dismissed` tags with `/^dismissed$/i`, not `"Dismissed"`, because the messages are lowercase and any uppercase look is styling; `getByText("Dismissed")` fails. (`client/messages/en/prReview.json` › `finding.dismissed`)

## Session Notes
<!-- ### YYYY-MM-DD — <task>, then 2–4 lines. -->
### 2026-11-21 — M1 run cost badge (client side)
Added `RunCostBadge` (compact / total / split) + `format-cost.ts`; shown in the PR list COST column, Agent runs timeline, Run Trace Stats and VerdictBanner (run joined by `run_id` in `FindingsTab`). Not yet checked visually in the browser.
### 2026-11-21 — M1 severity filter (client side)
Added `SeverityFilter` (3 severity pills, `aria-pressed`, colours from `SEV`, labels in `prReview.panel.severityCount.*`) to `FindingsPanel`; filter state is local per run and combines with Hide low confidence. Helpers `confidentFindings` / `countBySeverity` / `visibleFindings(…, severity)` + 3 helper tests and 3 RTL flow tests. Skills `react-best-practices` and `react-testing-library` did NOT auto-trigger during planning — invoked manually after the user asked; `engineering-insights` invoked manually per CLAUDE.md.

## Open Questions
<!-- Unresolved or unverified items. -->
- **2026-11-21 — Severity chips not yet seen in a browser.** Active chip uses `var(--bg-primary)` text on a solid `SEV.c` fill (chosen over white for contrast on `--warn` amber); check both themes visually. `agent-browser` was not installed, so only HTTP 200 of the PR page was verified. (`client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/styles.ts` › `sevChip`)
