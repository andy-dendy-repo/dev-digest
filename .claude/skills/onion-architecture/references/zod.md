# Zod: parse at the edge, trust inside

Untrusted data enters at a few edges. **Parse it once there** into a domain type, and
let the type carry that trust inward ("parse, don't validate"). Parsing the same value
again deep in the core adds noise and suggests the boundary is in the wrong place.

## Where parsing happens

| Edge | Ring | Where |
|---|---|---|
| HTTP params, query, body | Presentation | Route `schema` via `fastify-type-provider-zod` |
| Env / config | Composition root | `src/platform/config.ts` |
| GitHub, git, ripgrep, ast-grep output | Infrastructure | The adapter maps SDK payloads into domain types before returning |
| Database rows | Infrastructure | The repository maps rows into domain types (see [drizzle.md](drizzle.md)) |
| LLM structured output | Engine adapter | `reviewer-core/src/llm/structured.ts` (Zod → JSON Schema, parse with repair) |
| Secrets file, user-supplied JSON | Infrastructure | The adapter that reads it |

## Contracts are the domain language

- `@devdigest/shared` (source of truth: `server/src/vendor/shared/`) holds Zod schemas
  and `z.infer` types shared by API, engine and UI. They form the innermost ring and
  import only `zod`.
- `client/src/vendor/shared` is a **separate copy** that CI keeps byte-identical
  (`shared-contracts.yml`). Edit the server copy, then sync with
  `rsync -a --delete server/src/vendor/shared/ client/src/vendor/shared/`.
- A shape that only one module needs internally belongs in `<m>/domain.ts`, not in
  shared. Keep shared for what crosses a process or package boundary.
- Derive types with `z.infer<typeof Schema>`. Do not hand-write a parallel interface
  that will drift.

## Inside the core

- Functions take already-parsed domain types. Do not call `.parse()` on a value that
  came from a port or from another use case.
- Business invariants that are not shape checks (e.g. "a stale review is one whose sha
  differs from head and is older than `STALE_DAYS`") are plain functions in
  `domain.ts` or the service, not Zod refinements spread across schemas.
- `safeParse` belongs at an edge that must degrade gracefully (e.g. tolerating a
  malformed LLM reply). In the core, a bad value is a bug, so let it throw.
