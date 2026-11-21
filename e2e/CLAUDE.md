# e2e/ (`@devdigest/e2e`) — CLAUDE.md

Deterministic browser e2e for the web app, driven by the agent-browser CLI. Project map: [../CLAUDE.md](../CLAUDE.md)

## Stack
TypeScript 5.7 · tsx · Vercel agent-browser CLI (installed separately, see README)

## Commands (npm)
- `npm run e2e:hermetic` — boots an isolated, freshly seeded stack, runs all flows, tears it down
  (safe while your dev stack is up)
- `npm test` — runs flows against a stack that is already running
- `npm run typecheck`

## Map
- `run.ts` — runner: loads every `specs/*.flow.json` in order
- `specs/` — the flows (`NN-name.flow.json`) + feature specs in Markdown
- `lib/assert.ts` — assertion helpers
- `../scripts/e2e.sh` — hermetic stack launcher

## Conventions
- One flow = one `specs/NN-name.flow.json`, a JSON list of agent-browser commands run in order.
- Locate elements only with `--url`, `--text`, and `find`.

## Gotchas
- Flows read seeded data (PR #482, the seeded agents). Changing `server/src/db/seed.ts` can break e2e.
- The runner only picks up files ending in `.flow.json`; other files in `specs/` are ignored.

## Do not touch
- Never use the agent-browser AI `chat` command and never trigger an LLM call — flows must stay deterministic.

## Read when…
- **Read [README.md](README.md) when** running flows, adding a flow, or checking coverage.
- **Read [../TESTING.md](../TESTING.md) when** deciding whether a check belongs in e2e or a unit suite.
- **Read [specs/README.md](specs/README.md) before** adding a flow or a spec; **[docs/](docs/README.md)** for design decisions.
- **Read [INSIGHTS.md](INSIGHTS.md) before** a non-trivial change here; append new lessons.
