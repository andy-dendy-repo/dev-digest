# reviewer-core: the Engine ring

`reviewer-core` is the domain-service core of the product: diff → prompt → LLM →
grounded findings. It is consumed as **source** by `server/` and by the CI agent
runner, so anything it imports becomes a dependency of both.

## Rules

- **No I/O.** No DB, GitHub, filesystem, child processes, network or `process.env`.
  Callers pass resolved strings (skills, memory, specs, repo map, callers). The only
  side effect is the injected `LLMProvider` port. (`engine-no-io`)
- **SDKs live in `src/llm/` only.** `openrouter.ts` is the engine's own
  infrastructure adapter: it implements `LLMProvider` with the `openai` SDK. Code
  outside `src/llm/` sees only the port. (`engine-sdk-only-in-llm`)
- **Inward imports only:** `zod` and `@devdigest/shared` (resolved to
  `server/src/vendor/shared`). Never import server modules, `db/`, `adapters/` or
  `platform/`.
- **New inputs are optional parameters.** A feature that needs more context adds an
  optional field (like `skills`, `memory`, `specs`, `callers`). The server resolves
  the data and passes it in.

## Changing the engine

- After changing an exported API, run `npm run typecheck` here **and**
  `pnpm typecheck` in `../server`. The server compiles against this source through a
  path alias.
- Security invariants such as `INJECTION_GUARD`, `wrapUntrusted` and `groundFindings`
  are defined in `reviewer-core/AGENTS.md`. They are engine policy and stay in the
  engine.
- Engine tests stay hermetic: a stubbed `LLMProvider`, no keys, no network.
