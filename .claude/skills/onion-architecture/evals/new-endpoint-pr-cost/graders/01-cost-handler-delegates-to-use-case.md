---
type: llm
focus: trace
weight: 1
---

The GET /pulls/:id/cost handler itself calls no Drizzle, db/schema or repository function; it parses params, resolves the workspace and delegates to a use case
