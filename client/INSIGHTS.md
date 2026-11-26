# INSIGHTS — client/

Non-obvious lessons for this module, read before non-trivial work here.
**Append-only:** add entries at the end of a section; never rewrite or delete (corrections → `Supersedes "<title>" (<date>): …`).
Entry format: `- **YYYY-MM-DD — <title>.** <Do/avoid X> when <context>, because <why>. (\`path\`)`
Record with `/engineering-insights` (capture · wrap-up · review). Rules belong in `AGENTS.md`, design in `docs/`.

## What Works
<!-- Approaches and solutions that proved themselves. -->

## What Doesn't Work
<!-- Dead ends and antipatterns — always with WHY. Most-skipped, most valuable. -->

## Codebase Patterns
<!-- Non-default conventions and architecture decisions. -->
- **2026-11-21 — Component tests load ONE next-intl namespace.** Take a shared component's strings from the namespace of the screens that render it (e.g. `RunCostBadge` → `prReview.cost.*`), because tests like `RunHistory.test.tsx` wrap with `messages={{ prReview: messages }}` only and a key from another namespace fails to render. (`client/src/components/run-cost-badge/RunCostBadge.tsx`)
- **2026-11-21 — Cost "no data" is "—", never "$0.00".** Format USD only via `formatCost` (null → "—", genuine 0 → "$0", ≥ 3 decimals under $1), because an unfinished/failed/pre-M1 run must not look free. (`client/src/lib/format-cost.ts`)
- **2026-11-21 — Findings counters count before their own filter.** Compute per-severity counts from the list after "Hide low confidence" but before the severity filter (`countBySeverity(confidentFindings(...))`), because counting the final list would zero the other chips and counting raw findings would disagree with the list once the toggle is on. (`client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx`)
- **2026-11-21 — Popovers in the PR list need a portal + `stopPropagation`.** Render them with `createPortal` + `position: fixed` (see `panelPosition`), because the PR table has `overflow: hidden` and clips absolute panels; and stop click propagation on trigger and panel, because React portal events still bubble through the React tree to `PRRow`'s navigating `onClick`. (`client/src/components/findings-preview/FindingsPreview.tsx`)
- **2026-11-21 — Severity order/counting lives in `src/lib/findings-severity.ts`.** Use `SEVERITIES`, `countBySeverity`, `bySeverityThenConfidence` from there, because `src/components/*` must not import from route folders and the in-run filter, timeline icons and PR list column must agree. (`client/src/lib/findings-severity.ts`)
- **2026-11-26 — Mutations that show their error inline set `meta: { errorToast: false }`.** The global `MutationCache.onError` toasts every failed mutation, so a local `notify.error` in a catch, or an inline form error without the opt-out, reports the failure twice. (`client/src/lib/providers.tsx`, `useAddRepo` in `client/src/lib/hooks/core.ts`)
- **2026-11-27 — Query keys of one PR are siblings, not parent/child.** Keep `runKeys.history(prId)` and `runKeys.active(prId)` as `["runs","history",id]` / `["runs","active",id]`, because TanStack invalidation matches by prefix: nesting `active` under `history` makes "delete run" also refetch the 4 s active-run poll. Check `lib/hooks/query-keys.test.tsx` when adding keys. (`client/src/lib/hooks/reviews.ts`)
- **2026-11-27 — New component tests use `renderWithProviders` from `@/test/render`.** It loads every `messages/en` namespace (as production does), a retry-less QueryClient and ToastProvider, and returns `user` (userEvent). Mock data hooks per module path (`vi.mock("@/lib/hooks/pulls")`) — there is no hooks barrel any more. (`client/src/test/render.tsx`)
- **2026-11-27 — `global-error.tsx` has no next-intl provider.** It replaces the root layout, so `useTranslations` throws there; import `messages/en/common.json` directly and re-import `globals.css`. `error.tsx` / `not-found.tsx` sit inside the layout and can use `useTranslations`. (`client/src/app/global-error.tsx`)

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->
- **2026-11-21 — `@testing-library/user-event` ^14.6 is installed (added for M1 severity filter).** Use `userEvent.setup()` in new client tests; older tests (FindingCard, RunTraceDrawer, SettingsApiKeys) still use `fireEvent` and were left as is. (`client/package.json`)
- **2026-11-21 — `Toggle` has `role="switch"` but no accessible name.** Query it with `getByRole("switch")` (only one per FindingsPanel); `{ name: /hide low/i }` won't match because the label text is a sibling, not a label. (`client/src/vendor/ui/primitives/Toggle.tsx`)

## Recurring Errors & Fixes
<!-- Exact error message → fix. -->
- **2026-11-21 — Finding status tags are lowercase in the DOM.** Query `accepted`/`dismissed` tags with `/^dismissed$/i`, not `"Dismissed"`, because the messages are lowercase and any uppercase look is styling; `getByText("Dismissed")` fails. (`client/messages/en/prReview.json` › `finding.dismissed`)
- **2026-11-27 — `Error: Not implemented: window.confirm` in a passing test.** jsdom has no `confirm`; a test reached a confirm it did not stub (e.g. Enter on a focused button inside a `role="button"` header). Stub with `vi.spyOn(window, "confirm").mockReturnValue(…)` and check which element has focus. (`client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.test.tsx`)

## Session Notes
<!-- ### YYYY-MM-DD — <task>, then 2–4 lines. -->
### 2026-11-21 — M1 run cost badge (client side)
Added `RunCostBadge` (compact / total / split) + `format-cost.ts`; shown in the PR list COST column, Agent runs timeline, Run Trace Stats and VerdictBanner (run joined by `run_id` in `FindingsTab`). Not yet checked visually in the browser.
### 2026-11-21 — M1 severity filter (client side)
Added `SeverityFilter` (3 severity pills, `aria-pressed`, colours from `SEV`, labels in `prReview.panel.severityCount.*`) to `FindingsPanel`; filter state is local per run and combines with Hide low confidence. Helpers `confidentFindings` / `countBySeverity` / `visibleFindings(…, severity)` + 3 helper tests and 3 RTL flow tests. Skills `react-best-practices` and `react-testing-library` did NOT auto-trigger during planning — invoked manually after the user asked; `engineering-insights` invoked manually per CLAUDE.md.
### 2026-11-21 — M1 findings preview (timeline + PR list)
Added `FindingsPreview` (severity icons → portalled read-only panel) to the Agent runs timeline (`findingsByRun` built in `FindingsTab`) and a new FINDINGS column in the PR list (`PrMeta.latest_findings`). Moved severity helpers to `src/lib/findings-severity.ts`. Spec/plan moved to root `specs/` (now server + client).
### 2026-11-26 — Phase 0 client bug fixes
Finding shortcuts act in one panel only (`useFindingShortcuts` owner stack) and ignore Cmd/Ctrl chords; no double error toasts; trace drawer streams live runs (`running` + `key`); `ConfigTab` reset via `key={agent.id}` instead of an effect. `vendor/shared` synced from the server copy.
### 2026-11-27 — Refactor F1–F3 (imports, data layer, thin pages)
`@/` aliases + named exports (F1); key factories + `queryOptions` per domain, `core.ts` split into settings/repos/pulls (F2); PR detail, PR list and agent detail pages became thin entries over `_components/<View>`; `FindingsTab`/`RunHistory` split; `pr-context` replaces 5-level prop drilling (F3). Characterisation tests written first.

## Open Questions
<!-- Unresolved or unverified items. -->
- **2026-11-21 — Severity chips not yet seen in a browser.** Active chip uses `var(--bg-primary)` text on a solid `SEV.c` fill (chosen over white for contrast on `--warn` amber); check both themes visually. `agent-browser` was not installed, so only HTTP 200 of the PR page was verified. (`client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/styles.ts` › `sevChip`)
- **2026-11-21 — Findings preview not yet seen in a browser; e2e not runnable here.** Check timeline icons, the PR list FINDINGS column and the panel near the right edge in both themes. `e2e/` has no `node_modules` and `agent-browser` is not installed, so flows were not run. (`client/src/components/findings-preview/`)
- **2026-11-21 — Supersedes "Findings preview not yet seen in a browser; e2e not runnable here" (2026-11-21):** e2e now runs (agent-browser installed) and flow 02 exercises the FINDINGS column and preview in headless Chrome, 7/7 pass. A visual check of styling in both themes is still open. (`e2e/specs/02-repo-pulls-detail.flow.json`)
- **2026-11-26 — Does `optimizePackageImports` cover the internal `@devdigest/ui` barrel?** Next docs describe it only for npm packages (experimental), and `@devdigest/ui` is a tsconfig alias to `src/vendor/ui/index.ts`; measure the module count in `next dev` before relying on it or splitting the barrel. (`client/tsconfig.json`, `client/src/vendor/ui/index.ts`)
