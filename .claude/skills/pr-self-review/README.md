# pr-self-review

**Version:** 1.0.0 · **Updated:** 2026-11-27 · **Scope:** every local change before a PR is opened

This skill reviews everything that differs from `origin/main` (branch commits plus staged,
unstaged and untracked files). It runs only the skills that apply to each changed file and
blocks `gh pr create` / `gh pr merge` while a confirmed critical finding remains.

The agent-facing workflow is in [SKILL.md](SKILL.md). This README is for people: how it works,
what each file is for, and how to maintain it.

## How it works

```
plan.mjs ──► checks.mjs ──► reviewer subagents ──► verdict.mjs merge ──► verifier subagents ──► verdict.mjs finalize
 diff +        layer check,     one per (skill,          normalise, cap,       one per skill         verdict.json
 routing       typecheck,       ≤15 files)               dedupe                critical               + report.md
               mirror
                                                                                                        ▲
                                         .claude/settings.json PreToolUse hook ── gate.mjs ─────────────┘
                                         (gh pr create / gh pr merge blocked unless verdict = pass
                                          and its fingerprint matches the current changes)
```

- **Routing.** [skill-map.json](skill-map.json) maps globs to skills. UI skills cover `client/`;
  `onion-architecture`, Fastify, Drizzle and Postgres cover `server/` and `reviewer-core/`;
  `security`, `zod` and `typescript-expert` cover both.
- **Severity.** One scale in [references/severity.md](references/severity.md). Only an
  introduced critical blocks. `zod`, `typescript-expert` and `react-testing-library` are capped
  at major.
- **Verification.** Every LLM-reported critical is re-checked by an independent subagent; a
  rejected one drops to major. Check findings (layer check, typecheck) are deterministic and
  skip verification.
- **Fingerprint.** A sha256 over each reviewable file's path, status, base blob and working-tree
  blob. Committing or a clean rebase keeps it; editing a reviewed file invalidates the verdict.
  Docs, lockfiles and `.claude/**` are ignored, so a branch that changes only those passes the
  gate without a review.
- **State.** `<git-dir>/pr-self-review/` (`run/`, `verdict.json`, `report.md`). It lives inside
  `.git`, is never committed, and is per-worktree.

## Files

| File | For |
|---|---|
| [SKILL.md](SKILL.md) | The workflow the agent follows |
| [skill-map.json](skill-map.json) | Routing (skill → globs, severity cap), ignored paths, excluded skills, deterministic checks |
| [references/severity.md](references/severity.md) | The severity scale and what counts as critical per skill |
| [references/briefs.md](references/briefs.md) | Reviewer and verifier subagent briefs |
| [references/finding.schema.json](references/finding.schema.json) | Shape of a reviewer's result file |
| [scripts/plan.mjs](scripts/plan.mjs) | Collects the diff, routes files, picks checks, coverage guard |
| [scripts/checks.mjs](scripts/checks.mjs) | Runs the layer check, typecheck and vendor/shared mirror check |
| [scripts/verdict.mjs](scripts/verdict.mjs) | `merge` and `finalize`: aggregates findings into the verdict |
| [scripts/gate.mjs](scripts/gate.mjs) | The `PreToolUse` hook that blocks `gh pr create` / `gh pr merge` |
| [scripts/lib.mjs](scripts/lib.mjs) | Shared: git, glob matching, diff collection, fingerprint |

The scripts are plain Node ≥ 22 with no dependencies.

## Maintaining the skill

- **New skill in `.claude/skills/`.** `plan.mjs` refuses to run until the skill is either added
  under `skills` in `skill-map.json` (with `include`/`exclude` globs and `maxSeverity`) or listed
  in `excluded`. If it can block, add its critical definition to `references/severity.md`.
- **New deterministic check.** Add it under `checks` (`type`: `tsc`, `depcruise`, `mirror`, or
  any command whose non-zero exit becomes one finding).
- **Version.** `metadata.version` in SKILL.md follows semver. Major: the gate or the blocking rule
  changes. Minor: a new skill route, check or critical definition. Patch: wording or globs. Bump
  `metadata.updated`, the line at the top of this file, and add a row below.

## Limits

- The gate is local to Claude Code. A PR opened with `gh` in a plain terminal, or merged from the
  GitHub UI, is not blocked.
- `gh pr merge <n>` is judged against the checked-out branch, not PR `<n>`.
- LLM reviewers can still miss problems. The verdict shows that the team's skills were applied;
  it is not a proof of correctness.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-11-27 | First version: skill routing for 11 skills, layer check + typecheck + vendor/shared mirror check, critical verification, local `PreToolUse` gate |
