# Review mode — monthly cleanup

Insights rot: a library upgrade turns an old quirk into misleading advice, and
contradictory entries make the agent pick at random. Review is the **only** mode
allowed to change existing entries, and only with explicit user approval.

## Procedure

1. **Scope.** All `INSIGHTS.md` files (root + modules), or only the one the user names.
2. **Analyse each file**:
   - **Stale** — the referenced file, symbol, command, or library version no longer
     exists. Verify with `Glob` / `Grep` / `package.json`; don't guess.
   - **Fixed** — a workaround for a bug that has since been fixed.
   - **Duplicates** — two entries that say the same thing → propose one merged line.
   - **Contradictions** — "always do X" vs "X fails here" (including `Supersedes` chains)
     → propose which one wins, or ask the user.
   - **Resolved Open Questions** → propose moving the answer to the right section.
   - **Misplaced** — entry about another module, or in the wrong section.
   - **Promote** — a lesson that has become a hard rule → propose a one-line rule
     for that module's `CLAUDE.md` (Gotchas / Do not touch) and keep the insight.
   - **Size** — more than ~200 entries in a file → propose splitting by domain
     (e.g. `server/INSIGHTS-database.md`, `server/INSIGHTS-repo-intel.md`) and linking
     them from the module `CLAUDE.md`.
   - **Session Notes** older than ~3 months → propose collapsing them into one line each.
3. **Present a proposal** grouped by file, each item as:
   `[delete|merge|move|rewrite|promote] <section> › "<title>" — <reason>`
   Show the exact replacement text for merges/rewrites.
4. **Wait for explicit approval** ("yes", "apply 1, 3, 4"). No approval → change nothing.
5. **Apply** only the approved items with `Edit`. Keep the 7 sections and their order.
6. **Report** what changed; remind the user to review `git diff`. Do not commit.
