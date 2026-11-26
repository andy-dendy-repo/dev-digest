---
type: llm
focus: trace
weight: 1
---

The server obtains README.md through an existing port/adapter (e.g. GitClient.readFile) and not through node:fs, contained-read or a new file read inside a module service/executor
