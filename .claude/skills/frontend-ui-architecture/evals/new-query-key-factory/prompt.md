---
tags: [skill-creator]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

add a client query hook for GET /agents/:agentId/eval-runs (returns EvalRunRecord[] from @devdigest/shared) and a mutation for POST /agents/:agentId/eval-runs that starts a new eval run. after starting one, the list should refresh. no UI yet, just the data layer.
