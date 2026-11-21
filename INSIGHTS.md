# INSIGHTS — project-wide (cross-module)

Lessons learned here: what we tried, what broke, and why. Read before a non-trivial
change; append when you learn something the code doesn't make obvious.

- **Belongs here:** failed approaches, surprising behaviour, the reason behind a non-obvious choice.
- **Not here:** rules (→ `CLAUDE.md`), how things work (→ `docs/`), planned work (→ `specs/`).
- Newest entry first. When a lesson hardens into a rule, add the rule to `CLAUDE.md` and link back here.

Template:

```
### YYYY-MM-DD — <short title>
**What happened:** …
**Why:** …
**How to apply:** …
```

---

### 2026-11-21 — The two `vendor/shared` contract copies have drifted
**What happened:** `server/src/vendor/shared` and `client/src/vendor/shared` were meant to be identical, but several contract files now differ.
**Why:** the copies are not linked; each package resolves `@devdigest/shared` to its own folder, so edits to one never reach the other.
**How to apply:** before changing or relying on a contract, `diff -r server/src/vendor/shared client/src/vendor/shared` and update both deliberately.
