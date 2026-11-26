# Refactor — Architecture alignment (onion backend, frontend UI architecture)
**Status:** in progress
**Affected modules:** server · client · reviewer-core · CI

## Goal
Bring the codebase in line with its own architecture skills
([onion-architecture](../.claude/skills/onion-architecture/SKILL.md),
[frontend-ui-architecture](../.claude/skills/frontend-ui-architecture/SKILL.md)) and the
React / Next.js / Fastify / Drizzle best-practice skills, **without changing user-visible
behaviour** except where a step fixes a bug. Every PR keeps all suites green
(client, reviewer-core, server unit + integration, browser e2e).

## Starting point (2026-11-26 audit)
- Layer check: 58 known violations (31 `core-no-infra`, 9 `core-no-container`,
  9 `routes-no-infra`, 3 `core-platform-pure-only`, 1 `no-foreign-repository`, 5 cycles).
  No module has `ports.ts`; services take the whole `Container`; zero DB transactions.
- Client: three fat `page.tsx` files, 0 query-key factories (33 inline keys), ~50 deep
  relative imports, `export *` barrels, 23 `.tsx` files without next-intl, no
  `error.tsx` / `loading.tsx` / `not-found.tsx`, 5 of 6 pages are client components.

## Scope
- In: layering (ports, use cases, composition root), transactions, indexes, response
  contracts, client placement / data layer / Next boundaries / i18n / tests.
- Out: new features; behaviour changes to review output; removing "unused" code that a
  later milestone may re-add (see root AGENTS.md: unused ≠ dead) — `model-router.ts` and
  `trace-builder.ts` stay (the onion skill lists them as pure platform utilities).
- Constraint: `server/package.json` is not committed (skip-worktree), so the server gets no
  new npm dependencies or scripts; CI calls tools with `pnpm exec`.

## Plan — two independent PR stacks

Each PR is based on the previous one in its stack. After every backend PR the
`known-violations.json` baseline is regenerated so removed debt cannot return.

### Foundation
| PR | Content |
|---|---|
| **P0/P1** | Bug fixes from the audit + CI guardrails (test type-check, layer check, shared-contracts sync). This spec. |

### Backend stack (server/, reviewer-core/)
| PR | Content | Debt removed |
|---|---|---|
| **B1** Transactions + indexes | `UnitOfWork` port + Drizzle implementation; repositories accept `Db \| Tx`. Atomic: review persistence (review → findings → run completion → trace), agent versioning, `deleteAgentRun`, PR detail files/commits replace, full reindex. Migration with FK/lookup indexes. | — (correctness) |
| **B2** Pulls, polling, workspace, settings | `PullsService` (+ `PullsPort`, `RunCostsPort`), polling folded into it, batched upserts; `WorkspaceService`/`SettingsService` behind ports; `ConnectionTester`. Routes become `parse → service → return`. | `routes-no-infra` ×9, `no-foreign-repository`, settings `core-no-*` |
| **B3** Agents + repos | Services take explicit deps (ports typed in `ports.ts`, domain `Agent` not `AgentRow`); `JobQueue` port; job handlers registered in the composition root; container getters typed as ports. | agents/repos `core-no-container`, `core-no-infra`, agents cycle |
| **B4** Reviews | `ReviewService`, `RunExecutor`, `DiffLoader` take ports; `diff-parser` moves inward (pure); ports use domain types, not Drizzle rows. | reviews `core-no-container` ×3, `core-no-infra` ×9 |
| **B5** Repo-intel | `RepoIntelStore`, `CodeParser` (ast-grep), `CloneReader` (contained-read, fs walk), `Tokenizer`/`DepGraph` ports moved inward; pipelines receive deps; service split; service↔pipeline cycle broken. | the rest (~20) |
| **B6** Contracts + access | Fastify `response` schemas from `@devdigest/shared`, `RunRequest` via `schema.body`, hand-written duplicates of Zod types removed, workspace ownership checks on `/runs/:id/*` and `/repos/:id/*`. | — |

### Frontend stack (client/)
| PR | Content |
|---|---|
| **F1** Imports & exports | `@/` aliases instead of `../../..`; drop `export *` barrels (`lib/hooks/index.ts`, shared component barrels); named exports (default only for Next special files); no back-door imports. Mechanical, no behaviour change. |
| **F2** Data layer | Query-key factories + `queryOptions` per domain in `lib/hooks/<domain>.ts`; all invalidations through factories (incl. the PR page); local contract re-declarations replaced by `@devdigest/shared`. |
| **F3** Thin pages & splits | `page.tsx` → thin entry + `_components/<View>` + hook (PR detail, pulls list, agent detail); split `FindingsTab`, `RunHistory`; pure helpers with tests; dedupe `SEVERITY_ORDER`/`RANK`, `eventsToLog`; less prop drilling. |
| **F4** Next.js boundaries | `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx`; no `Suspense fallback={null}` over the whole app; server page shells with `generateMetadata`; only used next-intl namespaces sent to the client. |
| **F5** i18n & tokens | All user-visible strings in `messages/en` (incl. `window.confirm`, units in formatters — formatters return parts); colours as CSS variables / tokens. |
| **F6** React hygiene & tests | Event logic out of effects, stable keys, a11y of clickable non-buttons, timers cleared on unmount; shared `renderWithProviders`; flow tests for FindingsTab, ReviewRunAccordion, AddRepoView, ConfigTab; unit tests for `api.ts`, diff comments, pulls helpers. |
| **F7** ESLint | Flat config (typescript-eslint, react-hooks, `no-restricted-imports` for deep relatives / `@devdigest/ui/*`), clean after F1–F6, enforced in `client.yml`. |

## Acceptance criteria
- [ ] Every PR: client typecheck + tests, reviewer-core typecheck + tests, server typecheck
      (src + tests) + unit + integration, layer check, browser e2e (7 flows) green.
- [ ] Backend: layer check passes with an empty (or near-empty, justified) baseline.
- [ ] Client: no `export *` outside `@devdigest/ui`, no deep relative imports into
      `lib/`/`components/`, all queries keyed via factories, pages are thin.

## Notes
- Audit and phase-0 details: PR "fix: phase 0 bugs" and `INSIGHTS.md` session notes.
- Correction to the audit: a job timeout is not retried (`TimeoutError` is not retryable),
  so retries never overlap; nothing to fix there.
- B5 (repo-intel): the callers digest (`getCallerSignatures`) was **not** switched to the
  persisted `references` index. The two sources differ in extractor (ast-grep vs regex),
  file scope (walk limits), snapshot (`last_indexed_sha` vs working tree) and order (the
  digest is truncated at `limit`), so the switch would change the review prompt. Details
  and the path to do it: `server/src/modules/repo-intel/README.md` ("Callers digest").
- B5: `MAX_PARSE_MS_PER_FILE` was never enforced (a timer cannot interrupt synchronous
  parsing); the no-op `withTimeout` wrapper was removed and the constant documented.
