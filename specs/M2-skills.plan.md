# M2 — Skills in the product: implementation plan

Spec: [M2-skills.md](M2-skills.md)

## Context
Roadmap M2 (root README): "Skills in the product". Much of the plumbing already existed but was not wired:
- Tables `skills`, `skill_versions`, `agent_skills(agent_id, skill_id, order)` (migration 0000).
- Contracts `Skill`, `SkillType`, `SkillSource`, `AgentSkillLink` (`contracts/knowledge.ts`).
- Agents repository/service/routes for links (`linkedSkills`, `setSkills`, `GET/POST /agents/:id/skills`).
- The engine's `## Skills / rules` prompt slot (`reviewer-core/src/prompt.ts`) and `ReviewInput.skills?: string[]`.
- The trace drawer's `skills` prompt block and the `skills.json` / `agents.json › skills` strings.

Missing: a `skills` module, the `/skills` UI, the agent *Skills* tab, the executor passing skills, per-section tokens.

## Decisions
- **Effective skill** = `skills.enabled AND agent_skills.enabled`. Order is kept for disabled links, hence the new `agent_skills.enabled` column.
- **Trust = vetting gate.** Imported skills are stored disabled and need an explicit confirmation to enable; once enabled they are plain instructions (not `wrapUntrusted`).
- **Archives are unpacked in the browser** (`fflate`, client dependency). `server/package.json` is skip-worktree locally, so no new server dependencies. Executable/binary entries never leave the browser: only their paths are sent, as `skipped`.
- **Reorder** uses native HTML5 drag-and-drop plus Alt+↑/↓; no new dependency.
- **Skill block format** in the prompt: `### <name>\n> <description>\n\n<body>`, joined by the engine under `## Skills / rules`. Built server-side; the engine API is unchanged.
- **Tokens:** server uses `container.tokenizer` (cl100k) through a port for `section_tokens` / `skills_detail` / `token_count`; the editor shows a `≈ chars/4` estimate while typing.
- **API-contract experiment** runs on General Reviewer with the seeded `api-breaking-changes` skill (no second new agent).
- **Demo PRs** for the control experiment are draft `[demo]` PRs on this repository, never merged.

## Steps (stacked PRs)
1. `feat/m2-skills-spec` — this spec + plan.
2. `feat/m2-skills-server` — contracts, migration, `modules/skills/` (CRUD + import preview), agents `PUT /agents/:id/skills` + `AgentSkillView`, `skill_count`.
3. `feat/m2-skills-prompt` — executor loads skills, run log line, trace `section_tokens` / `skills_detail`, trace drawer shows them.
4. `feat/m2-skills-ui` — nav, `/skills`, `/skills/:id` (Config + Preview), create + import modals.
5. `feat/m2-skills-agent-tab` — agent *Skills* tab, card badge.
6. `feat/m2-skills-seed` — Test Quality Reviewer, seeded skills, `examples/skills/flaky-test-patterns(.zip)`, e2e flow 08.
7. Demo branches + `docs/skills-experiment.md`.
