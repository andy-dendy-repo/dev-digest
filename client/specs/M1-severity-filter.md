# M1 — Severity filter on findings
**Status:** in progress
**Affected modules:** client

## Goal
On the PR page, each expanded review run shows how many findings it has at each
severity, and lets the user narrow that run's findings list to one severity with
a single click.

## Scope
- In:
  1. **Severity counters**: in an expanded run (Agent runs tab → Review runs), above
     that run's findings list, a row of three counters: `3 CRITICAL · 5 WARNING · 2 SUGGESTION`.
  2. **Filter**: clicking a counter shows only that run's findings of that severity.
     Clicking the active counter again removes the filter and shows the full list.
  3. **Active state**: while a filter is on, the active counter is highlighted in its
     severity colour and the other two are dimmed. The highlight depends only on the
     filter state, not on hover. Only one severity can be active at a time.
  4. **Works with "Hide low confidence"**: with both on, the list shows only findings
     that pass both conditions. The counters always match what the list would show.
- Out:
  - The Findings column and its hover popover in the Pull Requests list (already exist).
  - The severity icons in the Agent runs Timeline (already exist).
  - Persisting the filter (URL, storage) or sharing it across runs. Each run filters on its own.
  - The INFO severity (not part of the findings contract).

## Contracts
None. Counts and filtering use the findings already loaded for the run. No API,
schema or model changes.

## Acceptance criteria
P1:
- [ ] An expanded run shows counters for all three severities in the form `3 CRITICAL · 5 WARNING · 2 SUGGESTION`.
- [ ] Each number equals the number of findings of that severity in the run's list.
- [ ] Clicking a severity leaves only findings of that severity in the list.
- [ ] The filter can be removed, returning the full list.

P2:
- [ ] Clicking a counter sends no server request and does not run a model.
- [ ] Severity filter and "Hide low confidence" combine: with both on, only findings passing both remain.
- [ ] Severity colours and labels come from the existing severity tokens (`SEV` / `SeverityBadge`).
- [ ] Counting and filtering are covered by tests; client tests and type-check pass.

P3:
- [ ] The active severity is highlighted in its own colour (fill or border), and the other two are dimmed.
- [ ] The highlight stays while the filter is on, independent of hover, so a screenshot shows the filter state.
- [ ] Clicking another severity moves the highlight to it.
- [ ] Clicking the active severity again clears both the filter and the highlight.
- [ ] A severity with no findings shows `0` without breaking the row.
- [ ] If the filter leaves no findings, the list shows the existing "No findings match" empty state.
- [ ] Counter labels are translatable strings (`prReview` messages), not hard-coded.
- [ ] After accepting or dismissing a finding, counters still match the list without a page reload.

## Notes
- Accepted and dismissed findings stay in the run's list (dimmed), so they are counted.
  This matches the run header's "N findings".
- The counters reflect the list after "Hide low confidence" but before the severity
  filter, so a counter's number is always what clicking it will show.
- Implementation plan: [M1-severity-filter.plan.md](M1-severity-filter.plan.md).
