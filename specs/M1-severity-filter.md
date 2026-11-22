# M1 — Severity filter on findings
**Status:** in progress
**Affected modules:** server · client

## Goal
Make the severity mix of a review visible wherever a review appears, and let the
user drill into it: per-severity counters and a filter inside each review run,
and severity icons with a brief findings preview on the Agent runs timeline and
in the Pull Requests list.

## Scope
- In:
  1. **Severity counters in a review run**: in an expanded run (Agent runs tab → Review runs),
     above that run's findings list, a row of three counters: `3 CRITICAL · 5 WARNING · 2 SUGGESTION`.
  2. **Filter**: clicking a counter shows only that run's findings of that severity.
     Clicking the active counter again removes the filter and shows the full list.
  3. **Active state**: while a filter is on, the active counter is highlighted in its
     severity colour and the other two are dimmed. The highlight depends only on the
     filter state, not on hover. Only one severity can be active at a time.
  4. **Works with "Hide low confidence"**: with both on, the list shows only findings
     that pass both conditions. The counters always match what the list would show.
  5. **Timeline severity icons**: each run in the Agent runs timeline that has findings
     shows one icon + count per severity present (e.g. `⓵ 1  ⚠ 4`), in the severity colours.
  6. **PR list Findings column**: the Pull Requests list gets a `FINDINGS` column with the
     same icons for the PR's latest review (the same review the Score comes from).
     A PR without a review, or whose latest review has no findings, shows `—`.
  7. **Brief findings preview**: clicking the icons (in the timeline or the PR list)
     opens a panel anchored to them: a header `N FINDINGS IN THIS RUN`, then one entry
     per finding, most severe first, with the severity icon, title, category, `file:line`,
     confidence and the first lines of the rationale. The panel scrolls when long.
     It closes on a click outside it or on Escape. Opening it does not navigate (a click
     in a PR list row still opens the PR everywhere else in the row).
- Out:
  - Filtering or acting on findings (accept/dismiss) from the preview: it is read-only.
  - A severity filter on the PR list itself.
  - Persisting the in-run filter (URL, storage) or sharing it across runs. Each run filters on its own.
  - The INFO severity (not part of the findings contract).

## Contracts
`@devdigest/shared`, both `vendor/shared` copies. No new routes.

| Schema | Field | Meaning |
|---|---|---|
| `FindingBrief` (new) | `id, severity, category, title, file, start_line, end_line, confidence, rationale` | A finding as shown in the preview. `rationale` may be shortened. |
| `PrMeta` (`GET /repos/:id/pulls`) | `latest_findings?: FindingBrief[] \| null` | Findings of the PR's latest review, most severe first. `null` when the PR has no review. |

The timeline needs no contract change: it uses the findings already loaded for the PR's review runs.

## Acceptance criteria
P1:
- [ ] An expanded run shows counters for all three severities in the form `3 CRITICAL · 5 WARNING · 2 SUGGESTION`.
- [ ] Each number equals the number of findings of that severity in the run's list.
- [ ] Clicking a severity leaves only findings of that severity in the list.
- [ ] The filter can be removed, returning the full list.

P2:
- [ ] Clicking a counter sends no server request and does not run a model.
- [ ] Severity filter and "Hide low confidence" combine: with both on, only findings passing both remain.
- [ ] Severity colours, icons and labels come from the existing severity tokens (`SEV` / `SeverityBadge`).
- [ ] Counting, filtering and the preview are covered by tests; client and server type-check and tests pass.

P3:
- [ ] The active severity is highlighted in its own colour (fill or border), and the other two are dimmed.
- [ ] The highlight stays while the filter is on, independent of hover, so a screenshot shows the filter state.
- [ ] Clicking another severity moves the highlight to it.
- [ ] Clicking the active severity again clears both the filter and the highlight.
- [ ] A severity with no findings shows `0` without breaking the row.
- [ ] If the filter leaves no findings, the list shows the existing "No findings match" empty state.
- [ ] Counter labels are translatable strings (`prReview` messages), not hard-coded.
- [ ] After accepting or dismissing a finding, counters still match the list without a page reload.

Timeline and PR list:
- [ ] Each timeline run with findings shows an icon + count for every severity it has, and none for severities it lacks.
- [ ] The PR list has a `FINDINGS` column with the latest review's icons; unreviewed PRs and reviews without findings show `—`.
- [ ] Clicking the icons opens the brief preview; its header count equals the sum of the icons' counts.
- [ ] The preview lists findings most severe first and closes on outside click and on Escape.
- [ ] Clicking the icons in a PR list row opens the preview and does not navigate to the PR.
- [ ] The preview is not clipped by the table or the page edge.

## Notes
- Accepted and dismissed findings are counted everywhere (in-run counters, timeline icons,
  PR list), matching the run header's "N findings".
- The in-run counters reflect the list after "Hide low confidence" but before the severity
  filter, so a counter's number is always what clicking it will show. The timeline and PR
  list icons are not affected by that toggle.
- "Latest review" on the PR list is the newest review of the PR, the same one its Score uses.
  With several agents per PR, that is the most recent agent's run.
- This reverses an earlier choice in the PR list endpoint not to surface findings on the list.
- Implementation plan: [M1-severity-filter.plan.md](M1-severity-filter.plan.md).
