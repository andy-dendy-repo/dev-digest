# DevDigest — AGENTS.md

Local-first AI pull-request review. **Starter template**: one end-to-end flow
(import a PR → run an agent review); later milestones (M1–M8) add features back.
This file is a map. Module rules live in each module's own `AGENTS.md`.

## Stack
- Node ≥ 22, TypeScript 5.x, Zod 3.25 (shared contracts)
- Postgres 16 + pgvector (Docker image `pgvector/pgvector:pg16`) — the only containerized service

## Commands
- `./scripts/dev.sh` — Postgres + migrations + seed + API (:3001) + web (:3000).
  Flags: `--no-seed` · `--no-client` · `--db-only`
- `docker compose down` — stop Postgres (Ctrl-C only stops the dev servers)

## Map
| Module | Role | Package manager | Rules |
|---|---|---|---|
| `server/` | Fastify API + Drizzle/Postgres, repo-intel indexer | **pnpm** | [server/AGENTS.md](server/AGENTS.md) |
| `client/` | Next.js studio UI | **pnpm** | [client/AGENTS.md](client/AGENTS.md) |
| `reviewer-core/` | Pure review engine (diff → prompt → LLM → findings) | **npm** | [reviewer-core/AGENTS.md](reviewer-core/AGENTS.md) |
| `e2e/` | Deterministic browser e2e | **npm** | [e2e/AGENTS.md](e2e/AGENTS.md) |
| `docs/` · `specs/` · `INSIGHTS.md` | Cross-module docs, specs, lessons | — | — |

## Conventions
- **Not a monorepo.** No workspace: install deps inside a module, with that module's package manager.
- `@devdigest/shared` (Zod contracts) resolves to `server/src/vendor/shared` for server and
  reviewer-core. `client/src/vendor/shared` is a **separate copy**.
- Rules live in `AGENTS.md`. `CLAUDE.md` only imports it (`@AGENTS.md`) and holds Claude Code-specific notes. Edit `AGENTS.md`.

## Gotchas
- The two `vendor/shared` copies have already drifted. Run
  `diff -r server/src/vendor/shared client/src/vendor/shared` before changing a contract.
- CI is path-filtered per package (`.github/workflows/`); a change in `reviewer-core/`
  also triggers `server-unit` (the server type-checks against its source).

## Do not touch
- Commit or open a PR only when asked; never commit on `main` — branch first.
- Never commit `.env` files or API keys.

## Skills
Task playbooks live in `.claude/skills/<name>/SKILL.md` (catalog: [.claude/skills/README.md](.claude/skills/README.md)).
When a task matches a skill's description, read its `SKILL.md` and follow it.

## Read when…
- **Read [README.md](README.md#architecture) when** you need the end-to-end review flow or the roadmap.
- **Read [reviewer-core/README.md](reviewer-core/README.md) when** changing prompt, LLM, or grounding behaviour.
- **Read [server/README.md](server/README.md) when** touching API routes, env vars, or DI.
- **Read [TESTING.md](TESTING.md) when** adding, moving, or naming tests, or touching CI.
- **Read [specs/](specs/README.md) and `<module>/specs/` before** building a feature. No spec → ask.
- **Before working in a module, read its `INSIGHTS.md`** and treat it as high-confidence guidance unless told otherwise. Cross-module lessons → [INSIGHTS.md](INSIGHTS.md).
- **At the end of a substantive task, do the insights wrap-up** ([engineering-insights](.claude/skills/engineering-insights/SKILL.md), mode `wrap-up`). Don't skip this step. Capture non-obvious findings as you go (mode `capture`).
- **Read [docs/agent-prompts/](docs/agent-prompts/README.md) when** editing the built-in reviewer agents' prompts.
