---
type: llm
focus: trace
weight: 1
---

A notifier port interface is declared outside server/src/adapters/ (in vendor/shared/adapters.ts or a module ports.ts) and its method arguments use domain types, not Slack payload or fetch types
