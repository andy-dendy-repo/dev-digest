---
tags: [skill-creator]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

reviews would be better if the model knew what the project is about. include the repo's README.md in the review prompt (if the repo has one), trimmed to ~4k chars. it should work for local reviews in the server and also when reviewer-core runs in the CI runner later
