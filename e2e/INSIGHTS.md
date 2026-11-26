# INSIGHTS — e2e/

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

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->
- **2026-11-21 — `wait --text` matches the RENDERED text, after CSS `text-transform`.** Assert uppercased headers as shown (`COST`, `FINDINGS`, `2 FINDINGS IN THIS RUN`), because agent-browser 0.43 does not find `Cost` when CSS renders it as `COST` (verified on a static page). (`e2e/specs/02-repo-pulls-detail.flow.json`)
- **2026-11-21 — agent-browser ignores `e2e/agent-browser.json` unless selected.** Run with `AGENT_BROWSER_CONFIG=$PWD/agent-browser.json`, because 0.43 treats auto-discovered project config as untrusted and warns "ignoring 1 unsupported settings". (`e2e/agent-browser.json`)
- **2026-11-21 — `npm i -g agent-browser` fails with EACCES on Homebrew Node.** Install to a user prefix (`npm i -g --prefix ~/.npm-global agent-browser`) and set `AGENT_BROWSER_BIN=~/.npm-global/bin/agent-browser` (plus PATH for `scripts/e2e.sh`), instead of using sudo. (`e2e/run.ts`)

## Recurring Errors & Fixes
<!-- Exact error message → fix. -->
- **2026-11-21 — Wait for a row's text before `find text … click`.** Add `wait --text <row title>` after `wait --url /pulls`, because the URL changes before the PR list fetch renders (the API first tries a GitHub sync, ~250 ms) and `find` fails immediately: `No element found by text`. (`e2e/specs/04-pr-findings.flow.json`, `05-pr-diff.flow.json`)

## Session Notes
<!-- ### YYYY-MM-DD — <task>, then 2–4 lines. -->
### 2026-11-21 — M1 run cost badge
Added a `wait --text "Cost"` step (PR list COST column) to `02-repo-pulls-detail.flow.json`. Flow not run in this session.
### 2026-11-21 — M1 severity filter / findings preview
First real run of the suite on this machine: fixed flow 02's `Cost` → `COST` (broken since the cost-badge commit, never run), added FINDINGS column + preview steps, and fixed the row-click race in flows 04/05. `npm run e2e:hermetic`: 7/7 pass.

## Open Questions
<!-- Unresolved or unverified items. -->
