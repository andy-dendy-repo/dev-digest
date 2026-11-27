# onion-architecture

**Version:** 1.1.0 · **Updated:** 2026-11-26 · **Scope:** `server/` (Fastify, Drizzle, Zod) and `reviewer-core/`

This skill says which ring each backend file belongs to, which way imports may point, and
where ports, repositories, adapters and Zod parsing live. It also ships a dependency-cruiser
layer check that fails only on new violations.

The agent-facing rules are in [SKILL.md](SKILL.md). This README is for people: what each file
is for, how to maintain the skill, and its version history.

## Files

| File | For |
|---|---|
| [SKILL.md](SKILL.md) | The rules the agent loads: rings, import direction, recipes, layer check |
| [references/](references/) | Per-tool rules: Fastify, Drizzle, Zod, adapters/DI, reviewer-core, tests |
| [examples.md](examples.md) | Good/bad pairs from this codebase |
| [references.md](references.md) | The sources behind the rules |
| [assets/depcruise.cjs](assets/depcruise.cjs) | The dependency-cruiser layer rules |
| [assets/known-violations.json](assets/known-violations.json) | Baseline of existing violations the check ignores |
| [evals/](evals/) | skill-creator eval cases |
| `README.md` | This file: files, maintenance, version history |

## Maintaining the skill

- **Version:** `metadata.version` in [SKILL.md](SKILL.md) follows semver.
  - **Major:** a ring boundary or import-direction rule changes, e.g. letting routes call
    repositories directly.
  - **Minor:** a new rule, recipe, reference file or layer-check rule.
  - **Patch:** wording, a source fix, or a baseline refresh in `known-violations.json`.

  Bump `metadata.updated` and the line at the top of this file, and add a row below.
- **New sources:** add them to [references.md](references.md) next to the rule they back.
- **Code changes:** when existing debt is cleaned up in code, regenerate
  `known-violations.json` (command under "Layer check" in [SKILL.md](SKILL.md)) so the
  baseline shrinks and the debt can't come back.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-11-26 | First version: rings, recipes and per-tool rules for `server/` and `reviewer-core/`; dependency-cruiser layer check with 58 baselined violations; three eval cases |
| 1.1.0 | 2026-11-26 | After the first eval review: container getters for new repositories/adapters are typed as the port; server-only ports go in the server copy of `vendor/shared/adapters.ts` only; type-check new test files (`pnpm typecheck` skips `test/`); new recipe for adding an input to the review engine; new `engine-readme-context` eval case |
| 1.2.0 | 2026-11-26 | The layer check and `tsconfig.test.json` (tests type-check, 0 errors) run in CI `server-unit`; the client `vendor/shared` copy is synced and CI keeps it identical, so ports are added to the server copy and synced |
