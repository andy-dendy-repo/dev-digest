# M1 — Severity filter on findings: implementation plan

Spec: [M1-severity-filter.md](M1-severity-filter.md)

## Context
Roadmap M1 (root README): "Run cost badge · **severity filter on findings**". The cost badge is already on `main` (PR #2). This is the second half, in two parts:

- **Part A (done, PR #3):** in an expanded run (Agent runs → Review runs → `ReviewRunAccordion`), a row of counters `N CRITICAL · N WARNING · N SUGGESTION` appears above the finding cards. Clicking a severity filters that run's list; clicking it again clears the filter. Client-only.
- **Part B (added after review of Part A):** severity icons on every Agent runs timeline row and in a new `FINDINGS` column of the Pull Requests list; clicking the icons opens a brief, read-only findings preview. The timeline reuses data already on the page; the PR list needs one new contract field and a server query.

The spec and this plan moved from `client/specs/` to root `specs/`, because Part B spans server and client.

What already exists:
- `FindingsPanel` (`client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/`) keeps its own per-run state: `hideLow`, `focusIdx`, and j/k navigation. It filters and sorts via `visibleFindings(findings, hideLow)` in `helpers.ts`. The empty state (`EmptyState`, `panel.noMatchTitle`) is already there.
- `ReviewRunAccordion` passes `review.findings` to `FindingsPanel`. Each run has its own instance, so the filter naturally applies to that run only.
- `SEV` (`@devdigest/ui`, `vendor/ui/primitives/tokens.ts`) holds the colour `c`, background `bg` and icon for each severity. `Severity` (`@devdigest/shared`, `contracts/findings.ts`) is `CRITICAL | WARNING | SUGGESTION`.
- After accept/dismiss, `useFindingAction` invalidates `["reviews", prId]`. Fresh findings arrive in props, so counters derived from props stay in sync without extra work (P3).
- The UI kit's `Chip` uses the accent colour, not the severity colour, and highlights only on hover. It doesn't fit this feature.

## Decisions (Part A)
- **What is counted:** counters use the list **after** "Hide low confidence" and **before** the severity filter, so a counter's number always matches what clicking it will show (P1, P2). Accepted and dismissed findings stay in the list (dimmed), so they are counted, the same way the run header's "N findings" counts them.
- **Always three chips**, even at zero (P3). A zero chip is still clickable and shows the existing empty state.
- **State:** `severity: Severity | null` in `FindingsPanel`. Clicking an inactive severity selects it; clicking the active one resets to `null`. Only one severity can be active at a time. When the filter changes, `focusIdx` is reset to 0 inside the click handler; otherwise j/k could point past the end of the list.
- **Look (per the mock):** a pill with a border in `SEV[sev].c`. The active chip is filled with `SEV[sev].c`. While a filter is on, the inactive chips are dimmed (`opacity ~0.45`). The highlight depends only on state, never on hover. `aria-pressed`, plus `role="group"` with an `aria-label`.
- **Labels** live in `messages/en/prReview.json` under `panel` (ICU): `severityCount.CRITICAL: "{count} CRITICAL"` and so on, plus `severityFilterLabel: "Filter by severity"`. No "·" separators between the chips, because the mock doesn't show any.

## Skills check
During planning, this plan was checked against the `react-best-practices` and `react-testing-library` skills. Reload them during implementation and run `engineering-insights` at the end.
- **Derive, don't store:** `counts` and `shown` are computed during render. The only state is `severity`. No `useEffect` for syncing. `focusIdx` is reset in the click handler, not in an effect. Keep `useMemo` only where it already exists (`shown`); `counts` doesn't need it.
- **Filter state is local, not in the URL:** the skill recommends URL params for filters, but this page has several independent runs, each with its own filter. So the state stays colocated in `FindingsPanel`. This is a deliberate exception.
- **Styles:** this module uses style objects in `styles.ts`, not Tailwind classes (the skill recommends classes). Follow the codebase convention.
- **A11y:** `<button aria-pressed>` inside a group with an `aria-label`. Colour is never the only signal; each chip also has the severity label and the number.
- **Component:** `SeverityFilter` gets its own file so `FindingsPanel` stays short and readable (under 200 lines). It's a real component, not a render factory.

## Part A — in-run counters and filter (done)

### Step 0. Spec and branch (done)
- Branch `feat/m1-severity-filter` from `main`.
- Spec [M1-severity-filter.md](M1-severity-filter.md).

### Step 1. Logic (done) (`FindingsPanel/helpers.ts`, `constants.ts`)
- `constants.ts`: `FILTER_SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[]`.
- `helpers.ts`:
  - `confidentFindings(findings, hideLow)`: the existing confidence filter, extracted.
  - `countBySeverity(findings): Record<Severity, number>`: every key initialised to zero.
  - `visibleFindings(findings, hideLow, severity: Severity | null = null)`: confidence → severity → the existing sort. The default parameter keeps the current signature working.

### Step 2. UI (done)
- New `FindingsPanel/SeverityFilter.tsx`: `{ counts, active, onToggle }` → three `<button aria-pressed>`, colours from `SEV`, text from `t("panel.severityCount.<SEV>", { count })`. Styles go in `FindingsPanel/styles.ts` (`sevChip(color, active, dimmed)`).
- `FindingsPanel.tsx`: add the `severity` state. Compute `confident = confidentFindings(...)` and `counts = countBySeverity(confident)` during render; keep `shown = useMemo(visibleFindings(...))` as it is. Put `<SeverityFilter>` on the left of the existing `s.toolbar`; the toggle stays on the right (`marginLeft: auto` already does this). Reuse the existing empty state.
- `messages/en/prReview.json`: the new `panel.*` keys.

### Step 3. Tests (done; Vitest + RTL, `react-testing-library` skill)
- `cd client && pnpm add -D @testing-library/user-event` (agreed). Write the new tests with `userEvent.setup()`, not `fireEvent`. Query with `getByRole("button", { name: /3 warning/i })` and `aria-pressed`, never `container.querySelector`.
- `FindingsPanel/helpers.test.ts` (2–3 pure-logic tests): `countBySeverity` returns zeros for missing severities; `visibleFindings` filters by severity together with hideLow (a CRITICAL finding with confidence 0.5 is excluded); the sort order is preserved.
- `FindingsPanel.test.tsx`: 2–3 long flow tests rather than many small ones (extend FINDINGS to cover different severities and confidences):
  1. **Filter:** the numbers are correct (a severity with no findings shows "0 …") → clicking WARNING leaves only warning cards (`aria-pressed`) → clicking CRITICAL moves the highlight → clicking again restores the full list. At the end, assert the mocked `useFindingAction().mutate` was not called and `fetch` was not called (network boundary).
  2. **With Hide low:** turn on the toggle → the counters update → pick a severity → only findings passing both conditions remain → a severity with 0 shows "No findings match".
  3. **After accept/dismiss:** `rerender` with updated `findings` (simulating a refetch) updates the numbers and keeps the filter.

## Part B — timeline icons, PR list column, findings preview

### Decisions (Part B)
- **One shared component** `FindingsPreview` in `client/src/components/findings-preview/` (app-specific shared UI, like `run-cost-badge`). Input: `findings: FindingPreviewItem[]` where `FindingPreviewItem = Pick<FindingRecord, "id" | "severity" | "category" | "title" | "file" | "start_line" | "end_line" | "confidence" | "rationale">`, so both `FindingRecord` (timeline) and `FindingBrief` (PR list) fit without mapping.
- **Trigger:** one `<button>` holding an icon + count per severity present (`SEV[sev].icon`, `SEV[sev].c`), dotted underline like the mock. `aria-haspopup="dialog"`, `aria-expanded`, an i18n `aria-label` ("1 critical, 4 warnings: show findings"). Nothing is rendered when there are no findings; the caller shows its own fallback.
- **Panel, not a centred modal:** the mocks show a panel anchored under the icons, so it is a non-modal `role="dialog"` popover. It is rendered in a **portal with `position: fixed`** computed from the trigger's `getBoundingClientRect()`, because the PR table has `overflow: hidden` and would clip an absolutely positioned panel. It is clamped to the viewport, flips above the trigger when there's no room below, and is repositioned on scroll/resize while open. It closes on outside `mousedown` and on Escape, with focus returning to the trigger.
- **Clicks must not leak:** React portal events still bubble through the React tree, so the trigger and the panel `stopPropagation()` on click; otherwise the PR row's `onClick` navigates.
- **Content:** header `N FINDINGS IN THIS RUN`; entries sorted CRITICAL → WARNING → SUGGESTION, then by confidence (highest first). Each entry: severity icon, title (one line, ellipsis), `CategoryTag`, `file:start-end` (mono, accent), `ConfidenceNum`, rationale clamped to 2 lines (plain text). Max height ~420px, scrolls. Read-only.
- **i18n** under `prReview.findingsPreview.*` (header, aria-label with ICU plurals), because components and their tests load only the `prReview` namespace (see `client/INSIGHTS.md`).
- **Timeline:** `FindingsTab` builds `findingsByRun: Map<run_id, FindingRecord[]>` from the loaded reviews and passes it to `RunHistory`. A settled run with findings shows `FindingsPreview` in place of the "N findings · M blockers" text; with no findings it keeps the existing text.
- **PR list data:** `PrMeta.latest_findings` = findings of the newest `kind='review'` review of the PR (the review its Score already comes from). Computed in `GET /repos/:id/pulls` with one extra `IN` query on `findings` for those review ids. Rationale is shortened server-side to 240 chars to keep the list payload small (the UI clamps to 2 lines anyway). `null` for a PR without a review; `[]` for a review with no findings.

### Step 4. Contracts (both `vendor/shared` copies)
- `contracts/findings.ts` is identical in both copies, and so is `contracts/platform.ts` (checked with `diff`). Make the same edits in both.
- `contracts/findings.ts`: `FindingBrief = Finding.pick({ id, severity, category, title, file, start_line, end_line, confidence, rationale })`.
- `contracts/platform.ts`: `PrMeta.latest_findings: z.array(FindingBrief).nullish()` with a "list endpoint only" comment.
- `server/test/contracts.test.ts`: `PrMeta` parses with and without `latest_findings`.

### Step 5. Server (`server/`)
- `src/modules/pulls/status.ts` (the existing pure "PR-list rollup helpers" module; reused instead of a new file): `toFindingBrief(row)` (shortens rationale to `BRIEF_RATIONALE_MAX = 240` with "…") and `sortBriefs` (severity, then confidence desc). Tests in `test/pulls-status.test.ts`. The older `rollupSeverities` helper there stays unused: the client derives counts from the briefs.
- `src/modules/pulls/routes.ts`: select `id` along with `score` in the latest-review query; one `findings` query `WHERE review_id IN (latest ids)`; group by review → `latest_findings`. Update the stale comment that said findings are intentionally not on the list.
- `test/reviews.it.test.ts`: the list returns the latest review's findings sorted and shortened; an older review's findings are not included; an unreviewed PR has `latest_findings: null`.

### Step 6. Client
- `src/lib/findings-severity.ts` (new): `SEVERITIES`, `countBySeverity`, `bySeverityThenConfidence`, shared by `FindingsPanel`/`SeverityFilter` (moved from `FindingsPanel`) and the preview, because a `src/components` module must not import from a route folder.
- `src/components/findings-preview/{FindingsPreview.tsx,helpers.ts,styles.ts,index.ts}` per the decisions above; `helpers.ts` holds the pure `panelPosition` placement.
- `RunHistory.tsx`: new optional prop `findingsByRun`; render `FindingsPreview` for settled runs with findings.
- `FindingsTab.tsx`: build `findingsByRun` from `runs` (reviews) with `useMemo`, next to `runsById`.
- PR list: add `findings` to `COLUMN_KEYS` (between Score and Status) and a column to `GRID`; `PRRow` renders `FindingsPreview` for `pr.latest_findings`, or `—`. i18n `list.columns.findings`.

### Step 7. Tests
- `findings-severity.test.ts` and `findings-preview/helpers.test.ts` (placement: below, clamped, flips up, narrow viewport).
- `FindingsPreview.test.tsx` (flow): icons only for present severities with the right counts → click opens the dialog with `5 findings in this run`, entries most severe first → Escape closes → reopen, outside click closes → a parent `onClick` spy is never called.
- `RunHistory.test.tsx`: a run with findings shows the icons and opens the preview; a run without keeps the text.
- `PRRow.test.tsx`: the Findings cell shows icons for `latest_findings`, `—` for `null`/`[]`; clicking the icons opens the preview and does not call `router.push`.

## Step 8. Verification (both parts)
- Run all suites:
  - `client/`: `pnpm typecheck`, `pnpm test`.
  - `server/`: `pnpm typecheck`, unit (`pnpm exec vitest run --exclude '**/*.it.test.ts'`), integration (`pnpm exec vitest run .it.test`, Docker).
  - `reviewer-core/`: `npm test` and typecheck (unchanged, but CI pairs it with `server-unit`).
  - `e2e/`: `npm test` needs the `agent-browser` CLI; if it isn't installed, say so rather than skip silently.
- Run `./scripts/dev.sh`, open a PR → Agent runs → expand a run. Check: the numbers, a click, a second click, the combination with the toggle, a zero severity, accept/dismiss without a reload, and no network requests on click (DevTools Network). For Part B: timeline icons, the PR list Findings column, the preview opening without navigating, closing on outside click/Escape, and not being clipped near the right edge. Record the demo video.
- No e2e test: P1–P3 don't require one.

## Step 9. Wrap-up
- `/engineering-insights wrap-up` → entries in `client/INSIGHTS.md` and `server/INSIGHTS.md` (Session Notes plus any lessons). Record whether the skill triggered on its own or was invoked manually. For the PR, be honest: during planning, `react-best-practices` and `react-testing-library` **did not trigger on their own**; they were invoked manually after the user asked.
- Spec: Status → done.
- Commits (feat(client) / test(client) / docs) and the PR only after the user confirms. Draft PR description: the implementation; the five phases (plan → what was dropped → how it was verified); a report on the reviewer runs (the user supplies the data: base agent vs Claude Code, effect of the prompt change); a link to the demo.

## Critical files
- `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/{FindingsPanel.tsx,helpers.ts,constants.ts,styles.ts,SeverityFilter.tsx,*.test.ts(x)}`
- `client/messages/en/prReview.json`
- `client/src/components/findings-preview/*`, `.../RunHistory/RunHistory.tsx`, `.../FindingsTab/FindingsTab.tsx`, `client/src/app/repos/[repoId]/pulls/{constants.ts,_components/PRRow/PRRow.tsx}`
- `{server,client}/src/vendor/shared/contracts/{findings.ts,platform.ts}`
- `server/src/modules/pulls/{routes.ts,status.ts}`, `server/test/{contracts.test.ts,reviews.it.test.ts,pulls-status.test.ts}`
- `client/src/lib/findings-severity.ts`
- `specs/M1-severity-filter.md`, `client/INSIGHTS.md`, `server/INSIGHTS.md`
