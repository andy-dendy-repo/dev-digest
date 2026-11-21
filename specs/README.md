# specs/ — cross-module

**Work to be done.** One spec per feature, written before implementation and read by
Claude before building. Current behaviour belongs in `../docs/`, not here.

Specs here span more than one module (most milestone features do). Specs local to one
module live in `<module>/specs/`.

## Naming
`<milestone>-<feature>.md` — e.g. `M1-run-cost-badge.md`, `M3-smart-diff.md`
(milestones: see the Roadmap in the root README).

## Spec template
```markdown
# <Milestone> — <Feature>
**Status:** draft | ready | in progress | done
**Affected modules:** server · client · reviewer-core · e2e

## Goal
The user-visible outcome, in one or two sentences.

## Scope
- In: …
- Out: …

## Contracts
Zod schemas / API routes added or changed (`@devdigest/shared`).

## Acceptance criteria
- [ ] …

## Notes
Open questions, links to docs/ADRs.
```
