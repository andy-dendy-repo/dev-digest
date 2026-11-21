# specs/ — e2e/

**Work to be done.** One spec per feature, written before implementation and read by
Claude before building. Current behaviour belongs in `../docs/`, not here.

**This folder also holds the runnable flows** (`NN-name.flow.json`). `run.ts` only executes
files ending in `.flow.json`, so Markdown specs and this README are ignored by the runner.
A spec here describes which user journey a new flow must cover; the flow itself is the JSON file.
Cross-module features → [../../specs/](../../specs/README.md).

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
