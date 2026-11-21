# specs/ — server/

**Work to be done.** One spec per feature, written before implementation and read by
Claude before building. Current behaviour belongs in `../docs/`, not here.

Specs for features local to this module. Cross-module features → [../../specs/](../../specs/README.md).

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
