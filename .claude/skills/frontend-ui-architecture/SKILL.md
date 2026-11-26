---
name: frontend-ui-architecture
description: >
  Where code lives in the DevDigest web client (client/, Next.js App Router + React 19 +
  TanStack Query) and why: component placement and folder anatomy, when to split a component,
  where constants, helpers, lib modules, hooks and data/query code go, business-logic layering,
  import direction, path aliases, barrels, named exports and file naming. Use this skill
  whenever you create, move, split or review a component, page, route, hook, constant,
  helper or query in client/, whenever you ask yourself "where should this file/function go?",
  when promoting code to a shared folder, or when a review touches folder structure or imports,
  even if the user never says "architecture". Not for hook misuse or rendering performance
  (react-best-practices), Next.js APIs (next-best-practices) or test-writing (react-testing-library).
metadata:
  version: "1.1.0"
  updated: "2026-11-27"
  sources: README.md
---

# Frontend UI architecture (DevDigest client)

This skill fixes **where code goes** in `client/` and **why**, so that every new file lands
where the next reader expects it. The rules are house decisions: they keep the conventions
the client already follows and settle the points where the sources disagree. Each rule carries
its source tag `[Sn]`; the full list is in [README.md](README.md), and per-question detail
with trade-offs is in [references/research-notes.md](references/research-notes.md).

Apply the rules to the code you write or move. The client follows them as of the
2026-11 architecture refactor (`specs/refactor-architecture.md`), and `pnpm lint` enforces
the mechanical ones (see "Enforced by lint"). If you find code that deviates, leave it
unless the task is about it, because drive-by restructuring bloats diffs and hides the real
change.

**Stay inside `client/`.** A client task is not a licence to edit `server/` or the
`vendor/shared` contracts. A contract change touches both copies (CI keeps them identical) and triggers server
CI, so it is a separate decision for the user. If the UI needs data the API doesn't return
yet, make the prop optional, render nothing when it's missing, and say which field is needed.

## Placement cheat sheet

| You are adding… | Put it in… |
|---|---|
| A new route | `src/app/<segment>/page.tsx`: thin; it renders one view from `_components/` |
| UI used by one route only | `src/app/<route>/_components/<Name>/` |
| A sub-part of one component | `<Parent>/_components/<Child>/` (nested), or in the parent file if tiny and inseparable |
| UI used by 2+ routes | `src/components/<kebab-name>/` |
| A domain-agnostic visual primitive (button, modal, chart) | `src/vendor/ui/<layer>/` + add it to `/showcase` |
| A value used by one component | top of that module; `constants.ts` beside it once the file gets noisy |
| A value used across routes | the domain module in `src/lib/` that owns it (e.g. `SEVERITIES` in `lib/findings-severity.ts`) |
| A user-visible string, including unit letters in a formatted label ("1m 42s") | `messages/en/<namespace>.json` via next-intl, never a constant or a template literal |
| A colour or spacing value | a CSS variable / `SEV`·`CAT` token from `@devdigest/ui`, never a hex in a component |
| Pure logic for one component | `helpers.ts` beside it (+ `helpers.test.ts`) |
| Pure domain logic used across routes | `src/lib/<domain>.ts` (kebab-case, named after the domain, never `utils.ts`) |
| UI state/wiring logic | a custom hook: beside the component, or `<shared-component>/hooks/` |
| A server request (query/mutation) | `src/lib/hooks/<domain>.ts`, built on `src/lib/api.ts` |
| An API contract type | `@devdigest/shared`; never redeclare it locally |
| Inline styles | `styles.ts` beside the component (`export const s = {…}`) |
| A test | beside the file it tests: `Name.test.tsx`, `helpers.test.ts` |

## The map

```
client/src/
├── app/                      routes; each route owns its private UI
│   └── <route>/
│       ├── page.tsx          thin entry (default export, Next requires it)
│       └── _components/      route-private components (`_` = not routable) [S7]
├── components/<kebab>/       app components shared by 2+ routes
├── lib/                      cross-route non-UI code (see "lib/" below)
│   ├── api.ts                the single fetch client + ApiError
│   ├── hooks/<domain>.ts     TanStack Query hooks per domain
│   └── <domain>.ts           pure domain modules, providers, contexts
└── vendor/
    ├── ui/                   design system, imported only as `@devdigest/ui`
    └── shared/               Zod contracts copy, imported as `@devdigest/shared`
```

**Import direction is one-way:** `vendor/*` ← `lib/` ← `components/` ← `app/`.
Each tier imports only from tiers to its left [S14][S15][S26]:
- `src/components/*` never imports from `src/app/`.
- A route never imports another route's `_components/`. Compose at the route level, or
  promote the shared piece instead.
- `vendor/ui` imports nothing app-specific.

This keeps features deletable and stops cycles. It is the only way a shared component stays
shared rather than secretly depending on one screen.

## 1. Where components live

1. **Colocate by default.** New UI starts in the `_components/` folder of the route that
   uses it [S1][S7][S17]. Files that change together live together, so a feature can be read,
   changed and deleted in one place.
2. **Promote on the second consumer, not before.** Move a component to the nearest common
   ancestor of its consumers. Two sibling components in one route share a parent `_components/`;
   two routes share `src/components/`. A component that has no domain knowledge and could ship
   in any app goes to `src/vendor/ui` [S15][S26]. Moving early guesses at reuse that rarely comes
   and turns `components/` into a junk drawer [S17][S18].
3. **Two tiers of shared UI.** `src/components/` holds app components that know the domain (a run, a
   finding, a cost). `src/vendor/ui` holds design-system pieces that don't [S14][S15].
4. **Keep nesting shallow.** At most two levels of nested `_components/` below a route view
   [S1][S26]. Deeper than that usually means the parent does too much; split the view instead.
5. **`page.tsx` stays thin.** It reads route params and renders one view component. The
   view, its state and its helpers live in `_components/<View>/` [S7].

## 2. Component folder anatomy

```
_components/FindingsPanel/
├── FindingsPanel.tsx        the component (named export)
├── index.ts                 one line: export { FindingsPanel } from "./FindingsPanel";
├── constants.ts             module constants (only if needed)
├── helpers.ts               pure functions (only if needed)
├── helpers.test.ts
├── styles.ts                export const s = { … } (only if needed)
├── FindingsPanel.test.tsx
├── SeverityFilter.tsx       a small child tightly bound to the parent (allowed)
└── _components/<Child>/     a child big enough for its own folder
```

- **Create a file only when it has content.** An empty `constants.ts` is noise.
- **`index.ts` re-exports explicitly**, one component per folder. It gives the folder a stable
  import path [S15][S25]. Write no new `export *` barrels, and no barrel that aggregates many
  modules. Aggregating barrels inflate the module graph that dev server, tests and type-checker
  load, and they make import cycles easy [S37][S38][S39][S40]. `@devdigest/ui` is the
  deliberate exception: it is a library entry point, which is where a barrel belongs [S39].
- **Named exports.** Import components by name. Use default exports only where Next.js
  requires them (`page`, `layout`, `loading`, `error`, …) [S7][S33]. Older `index.ts` files also
  alias `as default`; new ones don't need to.
- **A tightly bound child can share the parent's folder** as a sibling file (`SeverityFilter.tsx`),
  and a few tiny presentational atoms can share one file (`atoms.tsx`). One component per file
  is a default, not a law [S26][S32].

## 3. When and how to split a component

Split on **real signals**, not on line count. No authoritative source gives a numeric limit
[S2][S14][S20]. Split when one of these is true:
- The component has more than one concern: it fetches and also lays out and also handles a form
  [S2].
- A part is needed elsewhere (reuse).
- State or handlers for unrelated parts are tangled, or a part re-renders needlessly [S20].
- A part is hard to test on its own [S20].
- It contains nested `renderX()` functions; make them components [S14].

How to split:
- **Logic goes into a custom hook, not a "container" component.** The container/presentational
  split is retired; its author withdrew it in 2019 because hooks do the job without an arbitrary
  division [S22][S3]. Name hooks after the use case (`useRunEvents`), not the lifecycle
  (`useMount`) [S3].
- **Use composition before props.** If props keep growing, accept `children` or slot props, or
  build a compound component (`<Tabs>` + `<Tabs.Tab>` sharing context) [S5][S14][S21].
- **Some duplication is fine.** Two similar components are cheaper than the wrong shared
  abstraction. Extract on the third use, or when the shared shape is clear [S3][S18].
- **Server/client boundary.** Keep `'use client'` on the interactive leaf modules.
  `'use client'` marks a module boundary: everything that module imports ships to the browser.
  Pass server-rendered UI into client components as `children` [S6][S8][S24].

## 4. Constants

1. **Start module-level.** A constant lives at the top of the module that uses it, outside the
   component body, so it isn't recreated on every render. Move it to `constants.ts` beside the
   component when there are several or they are big maps [S17][S26].
2. **Cross-route constants belong to their domain module** in `src/lib/` (`SEVERITIES`,
   `RANK` in `findings-severity.ts`), next to the functions that use them. There is no global
   `constants.ts` grab-bag [S26][S14].
3. **Use `as const` objects or literal unions, not `enum`.** Use `satisfies` to check shape
   (`[...] as const satisfies readonly Severity[]`). Enums are non-erasable TypeScript syntax and
   `--erasableSyntaxOnly` rejects them [S12][S33].
4. **Naming:** `CONSTANT_CASE` for module-level values meant never to change
   (`VERDICT_META`, `MODEL_COLOR`). Use `camelCase` for anything computed or local [S33].
5. **These are not constants:**
   - User-visible text goes to `messages/en/<ns>.json` (project rule). This includes the
     words and unit letters inside formatted values. The helper returns numbers or parts
     (`{ m: 1, s: 42 }`) and the message holds the pattern (`"{m}m {s}s"`), so the label can be
     translated. Hard-coding `` `${m}m ${s}s` `` in a helper bypasses i18n.
   - Colours go to CSS variables or `SEV`/`CAT` tokens.
   - Environment config is read in one place (`lib/api.ts` reads `NEXT_PUBLIC_API_BASE`). Only
     `NEXT_PUBLIC_*` reaches the browser [S9][S14].
6. **Query keys are not loose constants.** They live in the domain's key factory (§6) [S28].

## 5. helpers vs lib vs hooks: the house definitions

Sources disagree on what `lib/` and `utils/` mean [S14][S16][S26][S36]. In this repo:

| Name | Means | Example |
|---|---|---|
| `helpers.ts` (in a component folder) | pure functions for that component/route only | `FindingsPanel/helpers.ts` → `visibleFindings` |
| `src/lib/<domain>.ts` | cross-route non-UI code: pure domain logic, formatters, providers, contexts | `format-cost.ts`, `findings-severity.ts`, `repo-context.tsx` |
| `src/lib/api.ts` | the single configured HTTP client (a pre-configured wrapper) | `api.get`, `ApiError` |
| `src/lib/hooks/<domain>.ts` | TanStack Query hooks and query definitions, one file per API domain | `hooks/reviews.ts` |
| `hooks/` or `useX.ts` beside a component | UI hooks (state, effects, shortcuts) for that component | `app-shell/hooks/useGlobalShortcuts.ts` |

Rules:
- **There is no `utils/` folder and no `utils.ts`.** A shared bucket collects dead code because
  nobody notices when its last caller is deleted [S17]. Name modules after the domain they serve.
- **Promotion is the same as for components:** `helpers.ts` → `src/lib/<domain>.ts` when a second
  route needs it. Promote the tests along with the code [S14][S26].
- **The `use` prefix is only for functions that call hooks.** A function that doesn't is a plain
  function (`getSorted`, not `useSorted`) [S3].
- **Pure first.** Put logic that doesn't need React in a plain function, so it can be tested
  without rendering [S30].

## 6. Business logic and data

Use four layers, kept as light as the feature allows [S30][S3][S18]:

```
component (render + wire events)
  → hook (UI state, derived values, handlers)
    → domain module (pure TS: rules, sorting, counting, formatting)
      → data hook (lib/hooks/<domain>.ts) → lib/api.ts → Fastify API
```

1. **Components stay thin.** They render, call hooks and pass handlers. A rule such as
   "count before filtering" lives in a pure function in `helpers.ts` or `src/lib/`. The function
   is named and tested, and the component calls it [S30].
2. **Event-caused logic goes in event handlers.** Compute derived values during render. Don't
   mirror props or query data into `useState` + `useEffect` [S4][S27].
3. **Server state lives in TanStack Query.** Client state is what's left, and it is usually
   small: keep it local and lift it only to the closest common parent. Use context only when
   prop drilling really hurts [S11][S19][S23].
4. **Query code lives in `src/lib/hooks/<domain>.ts`.** Every query is keyed through the
   domain's key factory and built from `queryOptions` in that same file; the hook sits on top
   [S11][S28][S29]:

   ```ts
   // lib/hooks/reviews.ts
   export const reviewKeys = {
     all: ["reviews"] as const,
     byPr: (prId: string) => [...reviewKeys.all, prId] as const,
   };
   export const prReviewsOptions = (prId: string) =>
     queryOptions({ queryKey: reviewKeys.byPr(prId), queryFn: () => api.get<ReviewRecord[]>(`/pulls/${prId}/reviews`) });
   export function usePrReviews(prId: string | null | undefined) {
     return useQuery({ ...prReviewsOptions(prId ?? ""), enabled: !!prId });
   }
   ```

   Mutations invalidate through the factory (`reviewKeys.byPr(prId)`), never through a
   retyped array. Keys stay with their domain, not in a global `queryKeys.ts` [S28].
5. **Contract types come from `@devdigest/shared`** (also re-exported by `lib/types.ts`). If a
   contract is missing, see the root AGENTS.md note on the two `vendor/shared` copies
   before adding one.
6. **Next.js data approach:** this app uses Next's *External HTTP API* approach. The browser
   talks to the Fastify API through `lib/api.ts`. There is no Data Access Layer and no Server
   Actions touching a database; don't introduce one ad hoc, because Next asks for one approach
   per app [S9]. If you add a server-only module, start it with `import "server-only"` so a
   client import fails the build [S8][S9].

## 7. Imports, aliases, naming

- **Aliases:**
  - Use `@/…` for anything outside the current component folder (`@/lib/hooks/reviews`,
    `@/components/run-cost-badge`).
  - Use `@devdigest/ui` and `@devdigest/shared` for the vendored packages.
  - Use relative paths only for siblings or the direct parent inside one component tree
    (`./constants`, `../helpers`).

  An alias keeps imports stable when files move; `../../../../lib` chains break and hide the
  tier being imported [S10][S14][S25]. The exception is tests importing `messages/en/*.json`:
  `messages/` sits outside `src/`, so they need a relative path.
- **Don't import through the back door.**
  - Import `@devdigest/ui` from its barrel, never `@devdigest/ui/kit/Modal` (vendor/ui README).
  - Import a component through its folder (`./_components/RunStatus`), not its inner file.
- **File naming (house convention):**

  | Kind | Case | Example |
  |---|---|---|
  | Component folder + file under `_components/` | PascalCase, same as the component | `RunStatus/RunStatus.tsx` |
  | Shared component folder under `src/components/` | kebab-case, with a PascalCase component file inside | `run-cost-badge/RunCostBadge.tsx` |
  | Non-component module | kebab-case, named after the domain | `format-cost.ts`, `findings-severity.ts` |
  | Hook file | `useX.ts` | `useGlobalShortcuts.ts` |
  | Fixed names inside a component folder | lowercase | `constants.ts`, `helpers.ts`, `styles.ts`, `index.ts` |

  The sources split between kebab-case and PascalCase [S14][S26][S32]. This repo keeps what it has,
  because consistency beats either choice [S7].
- **Colocate tests, styles and stories** with the module they cover [S17][S13]. Browser e2e
  flows stay in the root `e2e/` module.

## Enforced by lint

`pnpm lint` (ESLint flat config in `client/eslint.config.mjs`, run in CI `client.yml`) fails on:
- relative imports that climb into `lib/`, `components/`, `i18n/`, `test/` or `vendor/` (use `@/…`);
- back-door imports of `@devdigest/ui/*` (use the barrel);
- importing a removed `@/lib/hooks` barrel (import `@/lib/hooks/<domain>`);
- `export *` outside `src/vendor/ui`;
- React hooks misuse (`eslint-plugin-react-hooks`).

The rest of this skill (placement, splitting, strings, tokens) is review-time judgement.

## Before you finish: checklist

- [ ] Every new file is in the place the cheat sheet gives; nothing was promoted without a second consumer.
- [ ] No new import goes against `vendor ← lib ← components ← app`, and no route imports another route's `_components`.
- [ ] No new `export *`, `utils.ts`, `enum` or global constants file.
- [ ] Components are thin: rules live in named pure functions, server data in TanStack Query, and nothing is mirrored into state.
- [ ] Strings are in `messages/` (unit letters in formatted labels too), colours are CSS vars or tokens, and types come from `@devdigest/shared`.
- [ ] Nothing outside `client/` changed.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
- [ ] Imports outside the component folder use `@/`, and exports are named (default only for Next special files).
- [ ] Tests sit beside the code, and moved helpers took their tests with them.
