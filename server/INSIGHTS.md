# INSIGHTS — server/

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

### 2026-11-21 — File rank is PageRank only; `hotness` is always 0 ("Option B")
**What happened:** repo-intel ranks files by PageRank over the import graph only; the `hotness` (git churn) column is kept but always 0.
**Why:** clones are shallow (`CLONE_DEPTH = 1`), so there is no history to measure churn; rather than deepen the clone, hotness was dropped from v1.
**How to apply:** don't treat `hotness` as a signal or "fix" it to non-zero without first changing the clone depth. See `src/modules/repo-intel/pipeline/rank.ts`.
