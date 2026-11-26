---
name: pr-self-review
description: >
  Self-review of all local changes (branch commits, staged, unstaged, untracked) against the
  project's own skills before a pull request is opened: routes each changed file to the skills
  that govern it (UI skills on client/, onion-architecture and other backend skills on server/ and
  reviewer-core/), runs the layer check and typecheck, and records a verdict. A critical finding
  blocks the PR. Use before `gh pr create` or `gh pr merge`, when the pr-self-review gate blocks one,
  or when asked to self-review, pre-review, or check a branch before opening a PR.
argument-hint: "[--base <ref>]"
metadata:
  version: "1.0.0"
  updated: "2026-11-27"
  sources: README.md
---

# PR self-review

Review the local changes the way the team's skills would, **before** anyone else sees them.
The verdict is binding: the `PreToolUse` hook (`scripts/gate.mjs`) refuses `gh pr create` and
`gh pr merge` until the latest verdict is `pass` for exactly the current changes. Any edit to a
reviewed file after the review makes the verdict stale.

Run every command from the repo root. `S` below means `node .claude/skills/pr-self-review/scripts`.

## Workflow

1. **Plan.** Run `$S/plan.mjs` (add `--base <ref>` if the user gave one). It fetches
   `origin/main`, collects every change since the merge-base, routes files to skills by
   [skill-map.json](skill-map.json), picks the checks, and prints a table plus the `plan.json`
   path. The folder holding `plan.json` is **RUN**.
   - "Nothing to review" → go straight to step 4 (merge) and step 6 (finalize). The verdict
     passes.
   - Exit 3 (coverage guard) → a skill in `.claude/skills/` is neither routed nor excluded.
     Stop and ask the user where it belongs, then add it to `skill-map.json`.

   Done when `plan.json` exists. Show the user the routing table.

2. **Checks.** Run `$S/checks.mjs`. It runs the layer check, typecheck and the `vendor/shared`
   mirror check for the touched modules and records their findings in `RUN/checks.json`.
   A `skipped` check means dependencies are missing. Install them with the command it prints,
   then re-run `$S/checks.mjs`. A skipped check leaves the verdict `incomplete`.

   Done when every selected check is `passed` or `failed`.

3. **Skill review.** For every batch in `plan.json` (`routes[].batches[]`), launch one
   general-purpose subagent with the **reviewer brief** from
   [references/briefs.md](references/briefs.md). Launch all of them in a single message so they
   run in parallel. Each one writes `RUN/findings/<batch-id>.json`.

   Done when every batch id has its file. If a subagent fails, relaunch it for that batch only.

4. **Merge.** Run `$S/verdict.mjs merge`. It normalises, caps (per `maxSeverity`) and dedupes
   all findings into `RUN/merged.json` and prints the skill criticals that need verification.

5. **Verify criticals.** For each id it printed, launch one general-purpose subagent with the
   **verifier brief** from [references/briefs.md](references/briefs.md), all in one message. A
   verifier sees the code and the rule, never the reviewer's reasoning. Write their answers to
   `RUN/verifications.json` as `[{"id": "F1", "verdict": "CONFIRMED"|"REJECTED", "reason": "…"}]`.
   Check findings are deterministic and skip this step. No ids printed → write `[]`.

   Done when every printed id has a verdict.

6. **Finalize.** Run `$S/verdict.mjs finalize`. It writes `verdict.json` and `report.md` next to
   `RUN` (inside `.git/`, never committed) and prints the report. Exit 0 = pass, 1 = fail,
   2 = incomplete.

7. **Report.** Relay the result to the user. Lead with the status, then the table, then each
   blocking finding as a `file:line` link with its fix.
   - **fail**: say the PR is blocked, list the criticals, and offer to fix them. After any fix,
     the whole workflow runs again from step 1.
   - **incomplete**: name what is missing and finish it, so the run ends as pass or fail.
   - **pass**: list majors and minors as advisory. The PR flow (`gh pr create`) may continue.

## Rules of the review

- **Severity comes from [references/severity.md](references/severity.md)**, not from the skill's
  own labels. Critical requires `introduced: true`. Pre-existing problems are reported and never
  block.
- **The verdict is fail-closed.** A missing batch result, a skipped check, a critical without a
  verifier answer, or files edited mid-run all keep the PR blocked. Finish the run instead of
  working around it.
- **Fix code, never the gate.** Clear a critical by changing the code or by a verifier
  `REJECTED`. Leave the gate, `skill-map.json` caps and the layer-check baseline as they are. If
  the user wants to override a finding, tell them it is their call and that the gate will keep
  blocking until it is resolved.
