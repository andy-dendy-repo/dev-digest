# docs/ — project-wide

**How things work now.** Design notes and decisions. Planned work goes in `../specs/`;
lessons go in `../INSIGHTS.md`; rules for agents go in `../AGENTS.md`.

Link to the README and code rather than restating them; this folder plus the README
is the single source of truth.

## Contents
- [agent-prompts/](agent-prompts/README.md) — system prompts for the built-in reviewer agents and guidance on choosing a model
- Module-level docs: `server/docs/` · `client/docs/` · `reviewer-core/docs/` · `e2e/docs/`

## Layout
- `architecture.md` — how this part is put together (diagrams welcome; mermaid renders on GitHub)
- `adr/NNNN-<decision>.md` — one file per architectural decision, numbered, never rewritten
  (supersede with a new ADR instead)

## ADR template
```markdown
# NNNN — <decision title>
**Status:** proposed | accepted | superseded by NNNN
**Date:** YYYY-MM-DD

## Context
Why a decision is needed; forces and constraints.

## Decision
What we chose.

## Consequences
What becomes easier, harder, or must be watched.
```
