# INSIGHTS — project-wide (cross-module)

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
- **2026-11-21 — The two `vendor/shared` contract copies have drifted.** Before changing or relying on a Zod contract, `diff -r server/src/vendor/shared client/src/vendor/shared` and update both deliberately, because each package resolves `@devdigest/shared` to its own unlinked copy. (`server/src/vendor/shared`, `client/src/vendor/shared`)

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->

## Recurring Errors & Fixes
<!-- Exact error message → fix. -->

## Session Notes
<!-- ### YYYY-MM-DD — <task>, then 2–4 lines. -->

### 2026-11-26 — AGENTS.md as the source of truth
Moved the root and per-module `CLAUDE.md` content into `AGENTS.md`, so every agent tool reads the same rules. Each `CLAUDE.md` is now a `@AGENTS.md` import shim. The root shim keeps the slash-command syntax, which only Claude Code has.
The INSIGHTS/docs headers and the engineering-insights skill now point at `AGENTS.md`. The old mention in the `client/INSIGHTS.md` session note is left as is (append-only).
Still to do: check in a live Claude Code session (`/memory`) that the nested module imports load.

## Open Questions
<!-- Unresolved or unverified items. -->
