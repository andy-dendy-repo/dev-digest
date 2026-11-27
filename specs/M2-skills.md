# M2 — Skills in the product
**Status:** in progress
**Affected modules:** server · client · reviewer-core (tests only) · e2e

## Goal
Let a user write reusable review rules once — **skills** — and attach them to any
agent. A skill is **text only** (name · description · type · markdown body): it
cannot run code, call tools or read files. Enabled skills are injected into the
agent's prompt as their own block, in the order chosen for that agent, and are
visible in the run trace with the tokens they add.

## Scope
- In:
  1. **Storage + list.** A `skills` server module with CRUD over the `skills` table
     (the DB is the source of truth). UI page `/skills`: a grid of cards (name, type,
     source, description, enabled toggle), search, and **Add Skill ▾** with
     *Create* / *Import from file*. Clicking a card opens `/skills/:id` (side list + editor).
  2. **Editor.** Tabs *Config* (name, description, type, markdown body with line
     numbers and an approximate token count) and *Preview* (rendered body). The
     description is the skill's **interface** and is written as a directive
     ("Flag…", "Use when…") — the field hint says so. Changing the body bumps the
     version and snapshots it in `skill_versions`.
  3. **Binding to agents.** Agent editor tab *Skills*: every workspace skill listed,
     a checkbox to enable it for this agent, drag (or Alt+↑/↓) to reorder, an
     `N of M enabled` badge and a filter. Order = order of blocks in the prompt.
     A skill takes part in a run only if it is enabled **globally and** for the agent.
  4. **Import.** Upload a `.md` file or a `.zip`/`.skill` archive. The product extracts
     the skill core (`SKILL.md`, else the single `.md`) and its frontmatter
     (`name`, `description`, optional `type`), shows a preview, and saves only after
     confirmation. Archives are unpacked in the browser; executable/binary entries are
     never read or sent — only their paths are listed as *skipped*. Other text files
     are listed as *ignored (not core)*.
  5. **Trust.** An imported skill is someone else's instructions in the agent's prompt.
     It is saved **disabled** with a *needs vetting* badge; enabling it asks for an
     explicit confirmation. Once enabled it is injected as plain instructions
     (not wrapped as untrusted data — that would neutralise it).
  6. **Prompt + trace.** The run executor loads the agent's effective skills and passes
     them to the engine (`## Skills / rules`). The run log gets a `Skills: …` line;
     the trace gets per-section token counts and a per-skill breakdown
     (name · version · tokens). A disabled skill appears in neither.
  7. **New agent: Test Quality Reviewer** — untested branches, missing corner cases,
     over-mocking, flaky tests. Three skills seeded and linked; a fourth
     (`flaky-test-patterns`) is added through import of `examples/skills/flaky-test-patterns.zip`.
  8. **Seed.** The six design skills (pr-quality-rubric, no-then-chains,
     secret-leakage-gate, lethal-trifecta, phantom-api-gate, test-coverage-nudge) linked to
     Security Reviewer with three enabled; `api-breaking-changes` (unlinked) for the
     API-contract experiment on General Reviewer.
  9. **pr-self-review** (Claude Code skill) has model auto-invocation disabled and is run
     by hand (`/pr-self-review`).
- Out:
  - Skill evals, stats, a versions UI, import from URL, the community catalog.
  - Running anything from an archive (scripts, binaries) — ever.
  - Server-side archive parsing (no new server dependencies).

## Contracts
`@devdigest/shared`, both `vendor/shared` copies.

| Schema / route | Field | Meaning |
|---|---|---|
| `SkillSource` | `'imported_file'` | New source for file/archive imports. |
| `Skill` | `token_count?`, `agent_count?`, `created_at?` | Tokens of the rendered block; number of agents linking it. |
| `CreateSkillRequest` (`POST /skills`) | `name, description, type, body, source?, enabled?` | Imported sources are always stored `enabled=false`. |
| `UpdateSkillRequest` (`PUT /skills/:id`) | partial of the above | Body change → `version+1` + `skill_versions` row. |
| `GET /skills`, `GET /skills/:id`, `DELETE /skills/:id` | — | CRUD. Name is unique per workspace (409). |
| `SkillImportRequest` (`POST /skills/import/preview`) | `filename, entries[{path, content}], skipped[]` | Text entries only; nothing is stored. |
| `SkillImportPreview` | `draft{name, description, type, body}, core_path, ignored[{path, reason}]` | What will be saved after confirmation. |
| `AgentSkillLink` | `enabled` | Per-agent on/off; order kept for disabled links too. |
| `AgentSkillView` (`GET /agents/:id/skills`) | link + `name, type, description, skill_enabled, token_count` | Ordered. |
| `SetAgentSkillsRequest` (`PUT /agents/:id/skills`) | `skills[{skill_id, enabled}]` | Full ordered list; skills must belong to the workspace; snapshots an agent version. |
| `Agent` | `skill_count?` | Effective enabled skills (card badge). |
| `PromptAssembly` (trace) | `section_tokens?`, `skills_detail?[{id, name, version, tokens}]` | Per-slot tokens; skills block breakdown. |

DB: migration adds `agent_skills.enabled boolean not null default true` and a unique
index on `skills(workspace_id, name)`.

## Acceptance criteria
P1:
- [ ] A skill can be created and edited in the UI; a body change bumps its version.
- [ ] The agent *Skills* tab enables/disables and reorders skills; the order is the prompt order.
- [ ] Test Quality Reviewer exists and has linked skills (3 seeded + 1 imported).
- [ ] An enabled skill appears in the run log and trace as its own block with tokens; a disabled one does not.
- [ ] Import goes through a preview; nothing executable is read, sent or run.

P2:
- [ ] Imported skills are saved disabled with *needs vetting*; enabling asks for confirmation.
- [ ] Control experiment reproduces: Test Quality (happy-path-only test PR) and API contract
      (route signature change PR on General Reviewer) — missed without skills, flagged with them.
      Runbook + results in `docs/skills-experiment.md`.
- [ ] `pr-self-review` has `disable-model-invocation: true`; a manual run routes both UI and backend skills.

P3:
- [ ] Unit + integration + client tests and e2e flow `08-skills` pass; layer check clean.

## Notes
- Implementation plan: [M2-skills.plan.md](M2-skills.plan.md)
- Prompt slot already existed (`reviewer-core/src/prompt.ts`); the engine API is unchanged.
