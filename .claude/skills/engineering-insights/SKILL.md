---
name: engineering-insights
description: >
  Capture non-obvious engineering learnings into the INSIGHTS.md of the module
  being worked on (server/, client/, reviewer-core/, e2e/, or the root file for
  cross-module lessons). Use DURING work the moment something non-obvious is
  confirmed (a fix that took several attempts, an abandoned approach, a recurring
  error, a surprising library/tool behaviour, an architecture decision), and at
  the END of any substantive task as a wrap-up. Also `/engineering-insights review`
  for the monthly cleanup.
when_to_use: >
  "that took a while", "turns out", "doesn't work because", "workaround",
  root cause found, test or CI failure explained, approach abandoned, task
  finished, "wrap up", "remember this", "add to insights", "what did we learn".
argument-hint: "[capture|wrap-up|review] [optional note]"
allowed-tools: Read, Grep, Glob, Edit, Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---

# Engineering Insights

Turn what this session learned into durable, per-module knowledge so the next
session starts already knowing it. Knowledge lives next to its code: each module
has its own `INSIGHTS.md`, and a session working in that module reads only its lessons.

## Session context

Files touched (working tree):
!`git status --porcelain`

Changed vs HEAD:
!`git diff --name-only HEAD`

## 1. Pick the mode

| Argument | Mode | When |
|---|---|---|
| `capture` (default mid-task) | Write 1–2 entries now, then return to the task | A non-obvious fact was just **confirmed** |
| `wrap-up` (default at task end) | Review the whole session against all 7 sections | A substantive task is finished |
| `review` | Propose cleanup; edit only after explicit approval | Monthly, or a file feels noisy |

For `review`, stop here and follow [references/review.md](references/review.md).

## 2. Route: which file

Map each lesson to the module **whose code it is about**, using the first path segment:

| Path | File |
|---|---|
| `server/**` (includes `server/src/modules/repo-intel/`) | `server/INSIGHTS.md` |
| `client/**` | `client/INSIGHTS.md` |
| `reviewer-core/**` | `reviewer-core/INSIGHTS.md` |
| `e2e/**` | `e2e/INSIGHTS.md` |
| anything else, or a lesson that genuinely spans modules | `INSIGHTS.md` (root) |

One lesson → exactly one file. Never copy the same lesson into several files.
If a file is missing, create it from [templates/INSIGHTS.template.md](templates/INSIGHTS.template.md).

## 3. The rubric: 7 fixed sections

Every entry goes under one of these `##` headings — no free text, no new headings.

| Section | Write here when… |
|---|---|
| **What Works** | an approach or solution proved itself (especially after other attempts failed) |
| **What Doesn't Work** | a dead end or antipattern — **always say why**. Most-skipped, most valuable: check it every wrap-up |
| **Codebase Patterns** | a non-default convention or architecture decision someone would otherwise get wrong |
| **Tool & Library Notes** | a dependency quirk — include the library and version |
| **Recurring Errors & Fixes** | an error seen more than once — exact message → fix |
| **Session Notes** | wrap-up only: dated 2–4 line summary of what the session did |
| **Open Questions** | something unresolved or unverified — never record speculation as fact elsewhere |

## 4. Quality gate — every entry must pass ALL

- **Actionable cold:** a reader with no context knows what to do or avoid **and where**
  (file, function, library + version, threshold).
- **Not obvious from the code**, and not already in README, `docs/`, or `CLAUDE.md`.
- **Saves 5+ minutes** the next time this situation comes up.
- **Not generic knowledge** ("be careful with async" is noise).
- **1–3 lines.** If it needs a paragraph, it is documentation → `docs/`, not an insight.
- **No secrets:** no tokens, keys, `.env` values, personal data.

Fails any check → don't write it. Unsure about a fact → **Open Questions**.
Good/bad examples: [references/quality-rubric.md](references/quality-rubric.md).

## 5. Entry format

```
- **YYYY-MM-DD — <short title>.** <Do / avoid X> when <context>, because <why>. (`path/to/file.ts`)
```

Session Notes use a sub-heading:

```
### YYYY-MM-DD — <task in a few words>
<2–4 lines: what changed, what was decided, what is left.>
```

Use today's date. Write in English.

## 6. Append-only procedure

1. **Read** the target `INSIGHTS.md`.
2. **Grep** it for the key terms of the new entry (library, file, error text).
3. Already covered → **skip**. Existing entry wrong or outdated → **append** a new entry
   that starts with `Supersedes "<old title>" (<old date>):` — never edit or delete the old line.
4. **Insert** the entry as the last item of its section with `Edit`
   (anchor on the next `##` heading). Never reorder or rewrite existing lines.

## 7. Capture mode

- Only after the fact is **confirmed** (test passes, error reproduced, behaviour observed).
- 1–2 entries max, then go straight back to the main task.
- Tell the user in one line: `Insight → client/INSIGHTS.md › What Doesn't Work: "<title>"`.

## 8. Wrap-up mode

1. **Trivial session?** (typo, config tweak, pure Q&A, nothing surprising) → say
   "No insights worth recording" and stop. Signal quality beats volume.
2. Walk the session against **each** of the 7 sections in order. Aim for 2–5
   What Works items at most; explicitly ask yourself what did **not** work.
3. Skip anything already captured earlier in this session.
4. Add **one Session Note per module touched**.
5. Report a compact list: `file › section › title`.
6. Remind the user: this is a **draft** — spot-check with `git diff`. **Do not commit.**

## Never

- Rewrite, reorder, or delete existing entries (outside an approved `review`).
- Write a lesson about module A into module B's file.
- Commit or push.
- Record guesses as facts.
