---
tags: [skill-creator]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

i need a new endpoint in the server: GET /pulls/:id/cost — returns { total_usd, runs } for a PR, where total_usd is the sum of cost_usd over its agent_runs with status 'done' and runs is how many of those there are. 404 if the PR isn't in the caller's workspace. add a test too
