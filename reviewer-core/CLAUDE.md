# reviewer-core/ (`@devdigest/reviewer-core`) — CLAUDE.md

Pure review engine: diff → prompt → LLM → grounded findings. Project map: [../CLAUDE.md](../CLAUDE.md)

## Stack
TypeScript 5.7 · Zod 3.24 · Vitest 2 · openai 4 (used by the OpenRouter provider)

## Commands (npm)
- `npm test` — hermetic, stubbed `LLMProvider`; no keys, no network
- `npm run typecheck` — this **is** the build (nothing is emitted)

## Map
- `src/review/` — `run.ts` (entry: `reviewPullRequest`, single-pass / map-reduce), `reduce.ts`
- `src/prompt.ts` — `assemblePrompt`, `wrapUntrusted`, `INJECTION_GUARD`
- `src/grounding.ts` — `groundFindings` citation gate
- `src/llm/` — OpenRouter provider, structured output (Zod → JSON Schema, parse-with-repair)
- `src/output/` — `toReview` CI payload helper
- `test/` — unit tests

## Conventions
- **No I/O.** No DB, GitHub, filesystem, or env reads. The only side effect is the injected `LLMProvider`.
- Callers pass resolved strings (skills, memory, specs, repo map) — the engine never fetches them.
- Optional prompt slots (`skills`, `memory`, `specs`, `callers`) are empty in the starter; keep them optional.

## Gotchas
- The server consumes this package's **source** via a tsconfig path alias. After any change to an
  exported API, also run `pnpm typecheck` in `../server`.
- `@devdigest/shared` resolves to `../server/src/vendor/shared` — contracts are edited there.

## Do not touch
- Do not weaken, bypass, or make optional `groundFindings`; the score is recomputed from surviving findings.
- Do not remove `INJECTION_GUARD` or stop wrapping untrusted input with `wrapUntrusted`.
- Do not add keyword/denylist filtering of untrusted text as an injection defense (see INSIGHTS.md).

## Read when…
- **Read [README.md](README.md) when** you need the pipeline or the public API.
- **Read [../server/README.md](../server/README.md#review-context-non-obvious) when** you need the reasoning behind the injection guard and grounding.
- **Read [specs/](specs/README.md) before** changing engine behaviour; **[docs/](docs/README.md)** for design decisions.
- **Read [INSIGHTS.md](INSIGHTS.md) before** a non-trivial change here; record new lessons with `/engineering-insights`.
