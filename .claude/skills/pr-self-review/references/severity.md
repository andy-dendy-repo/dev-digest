# Severity rubric

Every reviewer uses one scale. A skill's own labels (react-best-practices tags whole sections
CRITICAL, security has CRITICAL/HIGH/MEDIUM/LOW) are inputs to this scale. They are not the
scale itself.

| Severity | Meaning | Effect |
|---|---|---|
| **critical** | Merging this breaks behaviour, security or an architecture boundary the team enforces. Matches a critical definition below. | **Blocks the PR** |
| **major** | A real defect or rule violation that should be fixed in this PR, but the code still works and the boundary holds. | Advisory |
| **minor** | A convention or maintainability issue. | Advisory |
| **nit** | Taste. Report only when cheap to fix. | Advisory |

## Introduced vs pre-existing

Set `introduced: true` only when **this diff** creates the problem: the offending code is on an
added or changed line, or a changed line is what breaks it (for example, a changed signature
that breaks an unchanged caller). A problem that sits in a touched file but predates the diff
gets `introduced: false`. It is reported and never blocks.

## When a finding is critical

The finding must be **introduced** and match one of these definitions. Anything else is major
at most. When unsure between critical and major, pick major and say why in `evidence`.

**onion-architecture**
- An import that breaks the Dependency Rule: a Domain or Application file (`domain.ts`,
  `service.ts`, `ports.ts`, helpers, `pipeline/`) imports Drizzle, `db/`, `db/schema`,
  `adapters/`, a repository, an SDK, Fastify, Node I/O, or the `Container`.
- `reviewer-core/src/` (outside `src/llm/`) doing I/O or importing server code.
- A route reaching `db/`, adapters or repositories directly.
- (The layer check reports most of these by itself; flag the ones it cannot see, such as
  `fetch(...)` or `process.env` inside the core.)

**frontend-ui-architecture**
- An import against the one-way direction `vendor/*` ← `lib/` ← `components/` ← `app/`:
  `src/components/**` or `src/lib/**` importing from `src/app/`, a route importing another
  route's `_components/`, or `src/vendor/ui` importing app code.
- An API contract type redeclared locally instead of imported from `@devdigest/shared`, when the
  local copy already disagrees with the contract.

**react-best-practices**: only rules whose breach is a runtime bug
- Side effects or non-determinism during render (impure component).
- Broken rules of hooks (conditional or looped hook calls, hooks outside components or hooks).
- A missing effect cleanup that leaks a subscription, timer or listener.
- Unstable or index `key` on a list that reorders, inserts or deletes.
- A `renderX()` factory or a component defined inside another component's body, when it holds
  state (identity loss resets that state).

**next-best-practices**
- An `async` client component (`"use client"` + `async function`).
- Non-serializable props (functions other than server actions, class instances) passed from a
  server to a client component.
- Server-only code, secrets or `process.env` values without `NEXT_PUBLIC_` reaching a client
  module.

**security**: at **HIGH confidence** only (attacker-controlled input confirmed, per the skill)
- Anything in the skill's CRITICAL or HIGH rows: injection, auth bypass, IDOR, RCE, stored XSS,
  SSRF, path traversal through user input.
- A committed secret, API key, token or `.env` file.
- Untrusted text (PR diffs, repo files, README) fed to the LLM prompt without the fencing that
  reviewer-core applies.

**drizzle-orm-patterns / postgresql-table-design**
- A change under `server/src/db/schema*` with no matching migration in
  `server/src/db/migrations/`.
- A migration that drops or renames a column or table, or narrows a type, with no data path.
- A multi-statement write that must be atomic but runs outside a transaction.

**fastify-best-practices**
- A route that takes params or a body without parsing them (no Zod or JSON-schema validation),
  when the value reaches the database, the filesystem, a shell or git.
- An error path that leaks stack traces or internal messages to the response.

**Capped skills** (`maxSeverity: major` in `skill-map.json`): `zod`, `typescript-expert`,
`react-testing-library`. Report their findings honestly. The aggregator caps them, so they never
block on their own. Another skill or a check blocks when the problem is critical.

**Deterministic checks** (produced by `scripts/checks.mjs`, not by reviewers):
- Layer check (depcruise) error → critical. A `no-circular` warning → minor.
- Type error in `server/`, `reviewer-core/` or `client/` → critical.
- `vendor/shared` copies diverging because of this diff → major.
