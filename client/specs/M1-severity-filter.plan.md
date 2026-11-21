# M1 — Severity filter on findings: implementation plan

Spec: [M1-severity-filter.md](M1-severity-filter.md)

## Context
Roadmap M1 (root README): "Run cost badge · **severity filter on findings**". The cost badge is already on `main` (PR #2). This is the second half: in an expanded run (Agent runs → Review runs → `ReviewRunAccordion`), a row of counters `N CRITICAL · N WARNING · N SUGGESTION` appears above the finding cards. Clicking a severity filters that run's list. Clicking it again clears the filter. Everything happens on the client with no server requests. Server, contracts and reviewer-core are unchanged.

What already exists:
- `FindingsPanel` (`client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/`) keeps its own per-run state: `hideLow`, `focusIdx`, and j/k navigation. It filters and sorts via `visibleFindings(findings, hideLow)` in `helpers.ts`. The empty state (`EmptyState`, `panel.noMatchTitle`) is already there.
- `ReviewRunAccordion` passes `review.findings` to `FindingsPanel`. Each run has its own instance, so the filter naturally applies to that run only.
- `SEV` (`@devdigest/ui`, `vendor/ui/primitives/tokens.ts`) holds the colour `c`, background `bg` and icon for each severity. `Severity` (`@devdigest/shared`, `contracts/findings.ts`) is `CRITICAL | WARNING | SUGGESTION`.
- After accept/dismiss, `useFindingAction` invalidates `["reviews", prId]`. Fresh findings arrive in props, so counters derived from props stay in sync without extra work (P3).
- The UI kit's `Chip` uses the accent colour, not the severity colour, and highlights only on hover. It doesn't fit this feature.

## Decisions
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

## Step 0. Spec and branch (done)
- Branch `feat/m1-severity-filter` from `main`.
- Spec [M1-severity-filter.md](M1-severity-filter.md) (Status: ready). Set Status → in progress when implementation starts.

## Step 1. Logic (`FindingsPanel/helpers.ts`, `constants.ts`)
- `constants.ts`: `FILTER_SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[]`.
- `helpers.ts`:
  - `confidentFindings(findings, hideLow)`: the existing confidence filter, extracted.
  - `countBySeverity(findings): Record<Severity, number>`: every key initialised to zero.
  - `visibleFindings(findings, hideLow, severity: Severity | null = null)`: confidence → severity → the existing sort. The default parameter keeps the current signature working.

## Step 2. UI
- New `FindingsPanel/SeverityFilter.tsx`: `{ counts, active, onToggle }` → three `<button aria-pressed>`, colours from `SEV`, text from `t("panel.severityCount.<SEV>", { count })`. Styles go in `FindingsPanel/styles.ts` (`sevChip(color, active, dimmed)`).
- `FindingsPanel.tsx`: add the `severity` state. Compute `confident = confidentFindings(...)` and `counts = countBySeverity(confident)` during render; keep `shown = useMemo(visibleFindings(...))` as it is. Put `<SeverityFilter>` on the left of the existing `s.toolbar`; the toggle stays on the right (`marginLeft: auto` already does this). Reuse the existing empty state.
- `messages/en/prReview.json`: the new `panel.*` keys.

## Step 3. Tests (Vitest + RTL, `react-testing-library` skill)
- `cd client && pnpm add -D @testing-library/user-event` (agreed). Write the new tests with `userEvent.setup()`, not `fireEvent`. Query with `getByRole("button", { name: /3 warning/i })` and `aria-pressed`, never `container.querySelector`.
- `FindingsPanel/helpers.test.ts` (2–3 pure-logic tests): `countBySeverity` returns zeros for missing severities; `visibleFindings` filters by severity together with hideLow (a CRITICAL finding with confidence 0.5 is excluded); the sort order is preserved.
- `FindingsPanel.test.tsx`: 2–3 long flow tests rather than many small ones (extend FINDINGS to cover different severities and confidences):
  1. **Filter:** the numbers are correct (a severity with no findings shows "0 …") → clicking WARNING leaves only warning cards (`aria-pressed`) → clicking CRITICAL moves the highlight → clicking again restores the full list. At the end, assert the mocked `useFindingAction().mutate` was not called and `fetch` was not called (network boundary).
  2. **With Hide low:** turn on the toggle → the counters update → pick a severity → only findings passing both conditions remain → a severity with 0 shows "No findings match".
  3. **After accept/dismiss:** `rerender` with updated `findings` (simulating a refetch) updates the numbers and keeps the filter.

## Step 4. Verification
- `cd client && pnpm typecheck && pnpm test` must pass.
- Run `./scripts/dev.sh`, open a PR → Agent runs → expand a run. Check: the numbers, a click, a second click, the combination with the toggle, a zero severity, accept/dismiss without a reload, and no network requests on click (DevTools Network). Record the demo video.
- No e2e test: P1–P3 don't require one.

## Step 5. Wrap-up
- `/engineering-insights wrap-up` → entry in `client/INSIGHTS.md` (Session Notes plus any lessons). Record whether the skill triggered on its own or was invoked manually. For the PR, be honest: during planning, `react-best-practices` and `react-testing-library` **did not trigger on their own**; they were invoked manually after the user asked.
- Spec: Status → done.
- Commits (feat(client) / test(client) / docs) and the PR only after the user confirms. Draft PR description: the implementation; the five phases (plan → what was dropped → how it was verified); a report on the reviewer runs (the user supplies the data: base agent vs Claude Code, effect of the prompt change); a link to the demo.

## Critical files
- `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/{FindingsPanel.tsx,helpers.ts,constants.ts,styles.ts,SeverityFilter.tsx,*.test.ts(x)}`
- `client/messages/en/prReview.json`
- `client/specs/M1-severity-filter.md`, `client/INSIGHTS.md`
