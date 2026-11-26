---
tags: [skill-creator]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

modelColor() in client/src/app/agents/_components/AgentCard/helpers.ts maps an agent's model to a chip colour. the PR list (repos/[repoId]/pulls) now needs the same colour for a model chip in PRRow. wire it up so both places use the same function.
