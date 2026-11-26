---
tags: [skill-creator]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

We want DevDigest to ping Slack when a review finishes. Post "Review done for PR #<n>: <score>/100, <k> findings" to an incoming-webhook URL stored as the secret SLACK_WEBHOOK_URL. If the secret isn't set just skip it silently, and Slack being down must never fail the review run. Wire it into the server where reviews complete.
