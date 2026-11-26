# INSIGHTS — project-wide (cross-module)

Non-obvious lessons for this module, read before non-trivial work here.
**Append-only:** add entries at the end of a section; never rewrite or delete (corrections → `Supersedes "<title>" (<date>): …`).
Entry format: `- **YYYY-MM-DD — <title>.** <Do/avoid X> when <context>, because <why>. (\`path\`)`
Record with `/engineering-insights` (capture · wrap-up · review). Rules belong in `AGENTS.md`, design in `docs/`.

## What Works
<!-- Approaches and solutions that proved themselves. -->

## What Doesn't Work
<!-- Dead ends and antipatterns — always with WHY. Most-skipped, most valuable. -->
- **2026-11-26 — Symlinking `node_modules` into a git worktree is not ignored.** Remove a `server/node_modules` / `reviewer-core/node_modules` symlink before `git add` in a `.claude/worktrees/*` checkout, because `.gitignore`'s `node_modules/` (trailing slash) matches directories only, so the symlink shows as untracked and `git add -A` would commit it. (`.gitignore`)

## Codebase Patterns
<!-- Non-default conventions and architecture decisions. -->
- **2026-11-21 — The two `vendor/shared` contract copies have drifted.** Before changing or relying on a Zod contract, `diff -r server/src/vendor/shared client/src/vendor/shared` and update both deliberately, because each package resolves `@devdigest/shared` to its own unlinked copy. (`server/src/vendor/shared`, `client/src/vendor/shared`)

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->
- **2026-11-26 — dependency-cruiser 17 under pnpm needs `preserveSymlinks: true` for a stable baseline.** Keep it set in the onion layer-check config, because otherwise packages resolve to `node_modules/.pnpm/<pkg>@<ver>/…` and every version bump invalidates `known-violations.json`. (`.claude/skills/onion-architecture/assets/depcruise.cjs`)
- **2026-11-26 — dependency-cruiser path rules only see resolved package paths.** Keep the `resolvable` (`couldNotResolve`) rule and run the layer check only with deps installed, because without `node_modules` an import stays a bare `drizzle-orm` and every `node_modules/<pkg>/` rule silently passes. (`.claude/skills/onion-architecture/assets/depcruise.cjs`)

## Recurring Errors & Fixes
<!-- Exact error message → fix. -->

## Session Notes
<!-- ### YYYY-MM-DD — <task>, then 2–4 lines. -->

### 2026-11-26 — AGENTS.md as the source of truth
Moved the root and per-module `CLAUDE.md` content into `AGENTS.md`, so every agent tool reads the same rules. Each `CLAUDE.md` is now a `@AGENTS.md` import shim. The root shim keeps the slash-command syntax, which only Claude Code has.
The INSIGHTS/docs headers and the engineering-insights skill now point at `AGENTS.md`. The old mention in the `client/INSIGHTS.md` session note is left as is (append-only).
Still to do: check in a live Claude Code session (`/memory`) that the nested module imports load.

### 2026-11-26 — onion-architecture skill
Added `.claude/skills/onion-architecture/` with rings, per-tool references and a dependency-cruiser layer check. Existing debt (58 violations) is baselined in `assets/known-violations.json`, so the check fails only on new ones. In a skill-creator eval, rule adherence was 100% with the skill and 57% without; the biggest gain was new endpoints, which otherwise copy the Drizzle-in-route debt.
Not done: layer check in CI, and refactoring the baselined debt.

## Open Questions
<!-- Unresolved or unverified items. -->
- **2026-11-26 — Should the onion layer check gate CI?** It is not in `server-unit.yml` / `reviewer-core.yml` yet. CI would need `npm ci` in reviewer-core before depcruise runs from `server/`, or the `resolvable` rule fails.
