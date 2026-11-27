# INSIGHTS — project-wide (cross-module)

Non-obvious lessons for this module, read before non-trivial work here.
**Append-only:** add entries at the end of a section; never rewrite or delete (corrections → `Supersedes "<title>" (<date>): …`).
Entry format: `- **YYYY-MM-DD — <title>.** <Do/avoid X> when <context>, because <why>. (\`path\`)`
Record with `/engineering-insights` (capture · wrap-up · review). Rules belong in `AGENTS.md`, design in `docs/`.

## What Works
<!-- Approaches and solutions that proved themselves. -->
- **2026-11-26 — Skill evals: test the rules the code can't show.** When evaluating a repo-specific skill in `.claude/skills/`, assert on rules not visible in existing code (don't extend an `export *` barrel, stay inside the module, `queryOptions`), because baseline agents copy visible conventions (`_components/` nesting, promotion to `src/lib/`) and those assertions passed 13/15 with and without the skill. (`.claude/skills/frontend-ui-architecture/evals/`)

## What Doesn't Work
<!-- Dead ends and antipatterns — always with WHY. Most-skipped, most valuable. -->
- **2026-11-26 — Client-only tasks drift into `server/` and contracts.** Avoid letting an agent fill a missing API field by editing `server/` + both `vendor/shared` copies during a client task, because a no-skill eval run did exactly that for a UI chip; the skill now says to make the prop optional and report the field. (`.claude/skills/frontend-ui-architecture/SKILL.md`)
- **2026-11-26 — Symlinking `node_modules` into a git worktree is not ignored.** Remove a `server/node_modules` / `reviewer-core/node_modules` symlink before `git add` in a `.claude/worktrees/*` checkout, because `.gitignore`'s `node_modules/` (trailing slash) matches directories only, so the symlink shows as untracked and `git add -A` would commit it. (`.gitignore`)

## Codebase Patterns
<!-- Non-default conventions and architecture decisions. -->
- **2026-11-21 — The two `vendor/shared` contract copies have drifted.** Before changing or relying on a Zod contract, `diff -r server/src/vendor/shared client/src/vendor/shared` and update both deliberately, because each package resolves `@devdigest/shared` to its own unlinked copy. (`server/src/vendor/shared`, `client/src/vendor/shared`)

## Tool & Library Notes
<!-- Dependency quirks, with library + version. -->
- **2026-11-26 — skill-creator scripts need Python ≥ 3.10.** `generate_review.py` fails with `TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'` under `/usr/bin/python3` (3.9.6); run it with `/opt/homebrew/bin/python3` (3.14). Version a skill under `metadata.version`, because `quick_validate.py` rejects unknown top-level frontmatter keys. (skill-creator `eval-viewer/generate_review.py`)
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

### 2026-11-26 — frontend-ui-architecture skill
Researched 40 sources and wrote `.claude/skills/frontend-ui-architecture/` (SKILL.md v1.0.1, README with all sources, research notes, 3 eval cases). `react-best-practices` lost its container/presentational rule and numeric limits. Evals: iteration 1 was 93% with the skill and 93% without; iteration 2 was 100% vs 83% after the i18n-units and scope fixes. Description-trigger optimization was not run.

### 2026-11-26 — onion-architecture skill
Added `.claude/skills/onion-architecture/` with rings, per-tool references and a dependency-cruiser layer check. Existing debt (58 violations) is baselined in `assets/known-violations.json`, so the check fails only on new ones. In a skill-creator eval, rule adherence was 100% with the skill and 57% without; the biggest gain was new endpoints, which otherwise copy the Drizzle-in-route debt.
Not done: layer check in CI, and refactoring the baselined debt.
### 2026-11-26 — Whole-project architecture audit + phase 0/1
Audit against onion-architecture, frontend-ui-architecture, React/Next skills produced a phased plan (bugs → guardrails → backend ports/UoW → frontend data layer/Next). Done: phase 0 bugs, `vendor/shared` copies made identical with CI `shared-contracts.yml`, CI layer check + test type-check. Deferred: ESLint (needs a debt policy; `server/package.json` must not be committed), dead-code removal (milestones may re-add features).

## Open Questions
<!-- Unresolved or unverified items. -->
- **2026-11-26 — Should the onion layer check gate CI?** It is not in `server-unit.yml` / `reviewer-core.yml` yet. CI would need `npm ci` in reviewer-core before depcruise runs from `server/`, or the `resolvable` rule fails.
