# Research notes: React/Next.js UI architecture

These are the research notes behind the `frontend-ui-architecture` skill ([SKILL.md](../SKILL.md); the source list is also in [README.md](../README.md)). Compiled 2026-11-26. The house decisions that settle the disagreements below are in README.md › House decisions. Each rule below points at a source in the numbered list ([S1]…[S40]). Every URL was fetched on the compilation date, and the attributed claim was checked against the page text. The one exception is [S22]: the original Medium page returned 403, so the quote was checked in a verbatim reprint. The skill should cover where code lives (components, constants, utils/lib, business logic) and how imports are kept in line. The target is a Next.js 15 App Router + React 19 + TanStack Query 5 + Tailwind 4 + next-intl client.

**Overlap with `.claude/skills/react-best-practices/SKILL.md`:** that skill already covers hooks and state anti-patterns and has a thin "Code Organization" section. This file should supply the *where/why* of structure and leave hook-misuse rules to that skill. Two conflicts:
- Its rule "Container components fetch data; presentational components receive props" contradicts Abramov's 2019 retraction [S22].
- Its "max 200 lines / 5–7 props" thresholds have no authoritative source (see Open questions).

---

## Key takeaways by question

### 1. Where do components live?

1. **Colocate by default.** Put code as close as possible to where it is used, and keep files that change together next to each other [S1][S17][S14]. Promote a component to a shared folder only when a second consumer appears [S26][S15].
2. **Organize the top level by feature/domain rather than by file type** once the app is more than trivial. Keep technical folders (`components/`, `hooks/`, `utils/`) for code that really is shared [S14][S26][S25][S1]. The folder tree should "scream" the domain, not the framework [S31].
3. **Keep two tiers of components.**
   - A shared, domain-agnostic UI kit (`components/ui`, or a vendored package). It must never import from features.
   - Feature or route components. These hold the domain knowledge.

   [S14][S15][S26]
4. **Next.js App Router:** files inside `app/` are not routable unless they are `page`/`route`, so colocating components and helpers inside route segments is safe. `_private` folders opt a folder out of routing and separate UI logic from routing. `(groups)` organize routes without changing URLs. Next.js is officially unopinionated: it lists three strategies and asks you to pick one and stay consistent [S7]:
   - everything outside `app/`
   - top-level folders inside `app/`
   - split by feature/route
5. **Keep nesting shallow.** The React FAQ says at most 3–4 nested folders [S1]. Wieruch says no more than two levels per component folder [S26].
6. **Start small and let structure emerge.** Feature-Sliced Design v2.1 ("pages first") keeps UI and logic in the page slice until several pages reuse it, and only then moves it down a layer [S15]. Robin Wieruch's progression goes single file → files → folders → technical folders → feature folders [S26]. The React FAQ says "don't overthink it" [S1].

**Disagreements / trade-offs:**
- **Folder per component vs flat files.** Josh Comeau gives every component a folder with an `index.ts` redirect [S25], and Airbnb uses `index.jsx` as a directory's root component [S32]. bulletproof-react [S14] and the barrel critics [S38][S39][S40] prefer direct file imports.
- **How many layers.** FSD has 6 layers plus slices and segments [S15]. bulletproof-react has 3 tiers: shared → features → app [S14].
- **Where project files sit.** Next.js allows colocating them inside `app/` or keeping `app/` routing-only [S7]. FSD recommends keeping Next's `app/` thin and re-exporting pages from `src/` [S15].

### 2. How should components be split?

1. **One concern per component.** "A component should ideally only be concerned with one thing. If it ends up growing, it should be decomposed." The component tree often mirrors the data model [S2].
2. **Split when you feel real pain, not ahead of time.** Signals: re-render cost, reuse, tangled state/handlers, testability [S20]. Avoid hasty abstractions, because "duplication is far cheaper than the wrong abstraction" [S18][S20]. React's own docs: "some duplication is fine" [S3].
3. **Turn nested `renderX()` helpers into real components** [S14].
4. **Use composition instead of piling on props.**
   - Too many props is a smell: split the component, or accept `children`/slots [S14][S5].
   - Prefer inversion of control: "make your abstraction do less stuff, and make your users do that instead" [S21].
   - Use compound components (`<Tabs>`/`<Tabs.Tab>` with shared context) when parts must cooperate [S21].
5. **Container/presentational is no longer the default split.** Abramov (2019): "I don't suggest splitting your components like this anymore… Hooks let me do the same thing without an arbitrary division" [S22]. Move stateful logic into a custom hook instead [S3], or into a "headless" hook that the UI consumes [S30].
6. **RSC boundary.** Keep `'use client'` on the interactive leaves. It marks a *module* boundary, and everything that module imports goes into the client bundle. Pass server-rendered UI into client components as `children`/props [S6][S8]. Mental model: `UI = f(data, state)`, split across server and client [S24].
7. **Barrel (`index.ts`) files.** Avoid them in application code:
   - They inflate the module graph that dev servers, test runners, linters and TypeScript must load [S38][S40][S37].
   - They make circular imports easy [S39][S15].
   - They do not actually stop deep imports [S39][S15].

   If you keep public-API index files, re-export explicitly (no `export *`) and give each `shared/ui` component its own index [S15]. Barrels are fine as a *library* entry point [S39].
8. **One component per file is a convention, not a law.** Airbnb allows only one per file (several stateless ones are tolerated) [S32]. Wieruch keeps tightly coupled children in the parent's file [S26].

**Disagreements / trade-offs:**
- **Barrels.** Josh Comeau (updated 2025) calls barrel avoidance premature for apps of his size (~15% of 1,200 files) and more important for npm libraries [S25]. Atlassian measured large gains at Jira scale [S40]. Atlassian also admits trade-offs: barrels gave control over public APIs, and direct imports may increase coupling [S40].
- **Barrel optimization in Next.js.** `optimizePackageImports` fixes barrels only for listed packages. It is still marked experimental. It only works on files that contain nothing but re-exports [S37][S39].
- **No authoritative numeric size or prop limits exist.** Sources give qualitative triggers only [S2][S20][S14].

### 3. Where do constants go?

1. **Module-level first.** Define a constant at the top of the module that uses it, outside the component body. Move it to a shared constants file only when more than one module needs it. This is colocation applied to constants [S17][S26].
2. **Per-feature `constants.ts`** sits inside the feature or component folder [S26]. **A single app-wide `constants.ts`** holds truly global values such as design-ish tokens, breakpoints and public keys [S25].
3. **Separate config from constants.** Environment-derived configuration belongs in a dedicated config module; bulletproof-react's `config/` holds "global configuration and exported environment variables" [S14]. In Next.js:
   - Only `NEXT_PUBLIC_*` variables reach the client.
   - Secrets must be read only in server-only code.
   - Next recommends that *only* the Data Access Layer touch `process.env` [S9].
4. **Prefer `as const` objects or string-literal unions to `enum`.**
   - The TS Handbook says you "may not need an enum when an object with `as const` could suffice", which keeps code aligned with JavaScript [S12].
   - TS 5.8's `--erasableSyntaxOnly` rejects `enum` (and namespaces, parameter properties) for type-stripping runtimes [S12].
   - Google forbids `const enum` [S33].
5. **Naming.**
   - Google: `CONSTANT_CASE` marks module-level values intended never to change. Function-local values use `lowerCamelCase` [S33].
   - Airbnb: uppercase only if the value is exported, `const`, and deeply immutable [S32].
6. **Query keys count as constants too.** Colocate them per feature with a key factory, "not globally in `/src/utils/queryKeys.ts`" [S28].

**Disagreements / trade-offs:**
- **Where to start.** Comeau centralizes app-wide values in one `src/constants.ts` [S25]. Wieruch and bulletproof-react start from colocated, per-module files [S26][S14].
- **Plain `enum`.** Google still allows plain `enum` [S33]. The TS team's newer tooling flag pushes away from it [S12].

### 4. utils/helpers vs lib/ vs services/

1. **`utils/`** holds generic, pure, project-agnostic functions ("a utility is a generic function that accomplishes an abstract task"). **`helpers/`** holds project-specific functions [S25][S26]. Wieruch says the names themselves are up to you [S26].
2. **`lib/`** holds pre-configured wrappers around third-party libraries: an API client instance, an SDK init, a configured query client [S14][S26]. bulletproof-react keeps a single pre-configured API client in `lib/` [S14].
3. **Avoid the `utils` dumping ground.** Shared utils folders collect dead code because nobody notices when the last consumer is deleted. Keep helpers next to their consumer until they are reused [S17]. Feature-specific helpers live in `features/<x>/utils` [S14].
4. **Keep request declarations out of `lib/`.** Each request (types/schema, fetcher, query hook or options) is declared in the feature's `api/` folder [S14]. Wieruch adds a top-level `api/` only when many features share endpoints [S26].
5. **Hook vs plain function.** Use the `use` prefix only if the function calls hooks; otherwise write a plain function (`getSorted`, not `useSorted`) [S3]. Component-specific hooks sit next to the component. Generic ones go in `hooks/` [S25][S26].
6. **"services/" is not a term the current primary sources use.** It shows up in older guides (see Rejected). In Next.js the server-side counterpart is the Data Access Layer (`data/` in the docs' examples) [S9]. In FSD it is the `api`/`model` segments [S15].

**Disagreements / trade-offs:** what `lib/` means differs by source:
- **Wrappers around third-party libraries** [S14][S26].
- **"Library functions like format-date"** plus `lib/utils` (the `cn` helper); this is shadcn/ui's convention [S36].
- **All non-UI code, with domain logic in `lib/core`** [S16].
- **Just a placeholder name with no framework meaning** (Next.js docs) [S7].

The skill should pick one meaning for this repo and write it down.

### 5. Where does business logic live?

1. **Keep components thin.** Components render and wire events. Stateful UI logic goes in custom hooks named for a concrete use case (`useChatRoom`, not `useMount`) [S3]. Domain rules go in plain TS modules that can be tested without React. Network/gateway code goes in its own layer, so changes to the API shape touch one file [S30].
2. **Event-caused logic goes in event handlers.** Derived values are computed during render, not synced with Effects [S4].
3. **Server state is not client state.**
   - Use TanStack Query as the server cache [S11][S19][S27].
   - Don't copy query data into `useState` [S27].
   - Once server data moves to TanStack Query, the global client state left over is "usually very tiny" [S11].
4. **Colocate query definitions per feature** (`features/x/queries.ts`) [S27][S28]. In v5, prefer `queryOptions(...)` as the main shared abstraction. It can be reused by `useQuery`, `useSuspenseQuery`, prefetching and `getQueryData` [S11][S29]. Wrap it in a custom hook only when the hook adds logic [S29].
5. **Keep state as local as possible.** Lift it to the closest common parent, and reach for context only when prop drilling really hurts [S19][S17][S23].
6. **Next.js App Router data access.**
   - Fetch in Server Components.
   - Pick *one* approach (external HTTP API, Data Access Layer, or component-level), not a mix.
   - For new projects, Next recommends a DAL: a `server-only` module that does authorization and returns minimal DTOs.
   - Server Actions stay thin, delegate to the DAL, and re-check auth inside each action, because each one is a public POST endpoint.

   [S9][S8]
7. **Guard environments.** Use `import 'server-only'` (or `client-only`) so a wrong-side import fails the build [S8][S9].

**Disagreements / trade-offs:**
- **Custom hook per query vs `queryOptions`.** TkDodo (2020/2023) and bulletproof-react recommend a custom hook per query/request [S27][S14]. TkDodo's 2024 post says custom hooks "won't be my first choice" now that `queryOptions` exists [S29].
- **How much layering.** Fowler/Qiu argue for full layering (view / hook view-model / domain classes / gateway) [S30]. React docs and Kent C. Dodds stress keeping abstraction light [S3][S18]. Scale the layering to the app.
- **The DAL does not map directly onto DevDigest.** The DAL guidance assumes the Next server talks to the DB. DevDigest's client calls a separate Fastify API, which is Next's "External HTTP APIs" approach [S9].

### 6. Naming, import boundaries, aliases, colocated tests/styles/stories

1. **Pick one filename case and enforce it with a linter.**
   - kebab-case is the most common modern choice: bulletproof-react (via `eslint-plugin-check-file`) [S14], Wieruch [S26], Next.js doc examples [S8].
   - TkDodo recommends `unicorn/filename-case` to stop bikeshedding [S39].
   - Hook files are `use-*.ts` with `use*` exports [S3][S25].
2. **Imports flow one way: shared → features → app.** Features never import each other; compose features at the app/route level. Enforce this with `import/no-restricted-paths` zones [S14][S35] or with `eslint-plugin-boundaries` [S34].
   - In boundaries v7.x the main rule is `dependencies`.
   - `element-types` is now an alias of `dependencies`.
   - `entry-point`, `no-private` and `external` are deprecated [S34].
3. **FSD layer rule:** a module imports only from layers strictly below it, and slices on the same layer cannot import each other. Steiger is FSD's linter for this; it is in beta [S15].
4. **Path aliases:** `@/*` → `src/*` is Next's `create-next-app` default and bulletproof-react's standard. Aliases keep imports stable when files move [S10][S14][S25].
5. **Colocate tests next to the module.** Integration tests sit in the feature folder; e2e tests sit at the repo root [S17]. Stories go next to the component [S13]. Styles go next to the component [S17].
6. **Exports.**
   - Google bans default exports: there is no canonical name, and named imports fail loudly [S33].
   - Airbnb prefers a default export for single-export modules [S32].
   - Next.js special files (`page`, `layout`, …) default-export by convention [S7][S8].

   A common compromise is named exports everywhere except framework entry files.
7. **Mark the server/client boundary in the file system.** Use `server-only` for server modules [S8]. `'use client'` belongs on the first line of interactive leaf modules [S6].

**Disagreements / trade-offs:**
- **Filename case.** Airbnb uses PascalCase component files (guide last changed 2021) [S32]. Google uses `snake_case` [S33]. Modern React/Next sources use kebab-case [S14][S26][S8].
- **Aliases vs relative imports.** Google prefers relative imports within a project and warns against long `../../../` chains [S33]. Next.js and bulletproof-react prefer `@/` aliases [S10][S14]. "Relative inside a feature, alias across features" is a synthesis, not a sourced rule.
- **What boundaries cost.** Boundary tooling adds config overhead. Abramov warns against lint rules that police style rather than bugs [S23].

---

## Sources

Trust levels:
- **primary:** the owner of the tech
- **high:** a recognized expert or a widely adopted reference
- **medium:** credible but opinionated, dated or narrow
- **low:** unvetted

### Official docs

- **[S1]** *File Structure (React FAQ, legacy docs)*
  - **Who:** React team
  - **URL:** https://legacy.reactjs.org/docs/faq-structure.html
  - **Date:** undated; legacy site, frozen since react.dev launched in 2023
  - **Trust:** primary (legacy)
  - **Covers:** group by feature/route or by type; keep nesting to ≤3–4 folders; "don't overthink it"; colocation of files that change together. Still the React team's only official word on folders. **Q1, Q6.**
- **[S2]** *Thinking in React*
  - **Who:** react.dev
  - **URL:** https://react.dev/learn/thinking-in-react
  - **Date:** undated (current docs)
  - **Trust:** primary
  - **Covers:** split by separation of concerns ("ideally only concerned with one thing"); component tree mirrors the data model. **Q2.**
- **[S3]** *Reusing Logic with Custom Hooks*
  - **Who:** react.dev
  - **URL:** https://react.dev/learn/reusing-logic-with-custom-hooks
  - **Date:** undated
  - **Trust:** primary
  - **Covers:** when to extract hooks; `use` prefix only for functions that call hooks; hooks share logic, not state; keep hooks focused on concrete use cases; avoid `useMount`-style lifecycle hooks; "some duplication is fine". **Q2, Q4, Q5, Q6.**
- **[S4]** *You Might Not Need an Effect*
  - **Who:** react.dev
  - **URL:** https://react.dev/learn/you-might-not-need-an-effect
  - **Date:** undated
  - **Trust:** primary
  - **Covers:** logic in event handlers; derive during render; frameworks' data fetching beats Effects; wrap fetching in a custom hook. **Q5.**
- **[S5]** *Passing Props to a Component: passing JSX as children*
  - **Who:** react.dev
  - **URL:** https://react.dev/learn/passing-props-to-a-component
  - **Date:** undated
  - **Trust:** primary
  - **Covers:** `children` as a "hole" for composition and visual wrappers. **Q2.**
- **[S6]** *'use client' directive (reference)*
  - **Who:** react.dev
  - **URL:** https://react.dev/reference/rsc/use-client
  - **Date:** undated
  - **Trust:** primary
  - **Covers:** `'use client'` marks a module and its transitive deps as client code; add it only where interactivity or browser APIs are needed. **Q2, Q6.**
- **[S7]** *Project structure and organization*
  - **Who:** Next.js docs
  - **URL:** https://nextjs.org/docs/app/getting-started/project-structure
  - **Date:** lastUpdated 2026-07-21
  - **Trust:** primary
  - **Covers:** safe colocation in `app/`; `_private` folders; `(route groups)`; `src/`; three organization strategies; "be consistent"; `components`/`lib` are placeholder names with no framework meaning. **Q1, Q4, Q6.**
- **[S8]** *Server and Client Components*
  - **Who:** Next.js docs
  - **URL:** https://nextjs.org/docs/app/getting-started/server-and-client-components
  - **Date:** lastUpdated 2026-10-05
  - **Trust:** primary
  - **Covers:** push `'use client'` down to cut bundle size; interleave via `children`; providers as deep as possible; wrap third-party client components; `server-only`/`client-only` against environment poisoning; kebab-case file names in examples. **Q2, Q5, Q6.**
- **[S9]** *How to think about data security in Next.js*
  - **Who:** Next.js docs
  - **URL:** https://nextjs.org/docs/app/guides/data-security
  - **Date:** lastUpdated 2026-11-18
  - **Trust:** primary
  - **Covers:** three data-fetching approaches (pick one); Data Access Layer (server-only, authz, DTOs); only the DAL touches `process.env`; thin Server Actions that delegate to the DAL; re-authorize in every action. **Q3, Q4, Q5.**
- **[S10]** *Installation: Set up Absolute Imports and Module Path Aliases*
  - **Who:** Next.js docs
  - **URL:** https://nextjs.org/docs/app/getting-started/installation#set-up-absolute-imports-and-module-path-aliases
  - **Date:** lastUpdated 2026-10-02
  - **Trust:** primary
  - **Covers:** built-in `paths`/`baseUrl` support; `create-next-app` defaults to `@/*`. **Q6.**
- **[S11]** *TanStack Query docs*
  - **Who:** TanStack
  - **URLs:**
    - "Does TanStack Query replace Redux, MobX or other global state managers?": https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state
    - "Query Options": https://tanstack.com/query/latest/docs/framework/react/guides/query-options
  - **Date:** undated (v5 docs)
  - **Trust:** primary
  - **Covers:** server vs client state (remaining global state "usually very tiny"); `queryOptions` as the way to share key + fn with type safety. **Q5.**
- **[S12]** *TypeScript docs*
  - **Who:** Microsoft
  - **URLs:**
    - Handbook, "Enums → Objects vs Enums": https://www.typescriptlang.org/docs/handbook/enums.html
    - TypeScript 5.8 release notes, `--erasableSyntaxOnly`: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html
  - **Date:** handbook undated; 5.8 released 2025
  - **Trust:** primary
  - **Covers:** `as const` objects instead of enums; the erasable-syntax flag rejects `enum`/`namespace`. **Q3.**
- **[S13]** *How to write stories*
  - **Who:** Storybook docs
  - **URL:** https://storybook.js.org/docs/writing-stories
  - **Date:** undated (current docs)
  - **Trust:** primary
  - **Covers:** a story file "lives alongside the component file". **Q6.** (Only relevant if Storybook is adopted.)

### Reference architectures

- **[S14]** *bulletproof-react docs*
  - **Who:** Alan Alickovic (alan2207), ~36k stars
  - **Trust:** high
  - **Pages and last commit dates:**
    - Project Structure (2024-11-12): https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
    - Project Standards (2024-07-20): https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md
    - Components and Styling (2026-04-30): https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md
    - API Layer (2024-07-20): https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md
    - State Management (2024-07-20): https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md
  - **Covers:**
    - `app/ components/ config/ features/ hooks/ lib/ stores/ testing/ types/ utils/`
    - features own `api/components/hooks/stores/types/utils`
    - shared → features → app flow; no cross-feature imports; `import/no-restricted-paths` zones
    - **dropped barrel files** over Vite tree-shaking and performance issues
    - `@/*` alias; kebab-case via `check-file`
    - colocate; limit props; extract render functions
    - single API client in `lib/`; per-request declarations in `features/*/api`
    - five state categories
  - **Questions:** Q1–Q6.
- **[S15]** *Feature-Sliced Design docs (v2.1)*
  - **Who:** Feature-Sliced Design core team
  - **Date:** v2.1 docs, site © 2018–2025
  - **Trust:** high (a popular methodology, but opinionated)
  - **Pages:**
    - Overview: https://feature-sliced.design/docs/get-started/overview
    - Public API: https://feature-sliced.design/docs/reference/public-api
    - Usage with Next.js: https://feature-sliced.design/docs/guides/tech/with-nextjs
    - Migration v2.0→v2.1, "pages first": https://fsd.how/docs/guides/migration/from-v2-0/
    - Steiger linter (beta): https://github.com/feature-sliced/steiger
  - **Covers:**
    - layers app/pages/widgets/features/entities/shared (processes deprecated); import only from strictly lower layers; no same-layer slice imports
    - segments `ui/api/model/lib/config`
    - public-API index files and their pitfalls (cycles, tree-shaking, `export *`); per-component indexes in `shared/ui`
    - Next.js integration: rename FSD layers to `_app`/`_pages` and re-export into Next's `app/`
    - v2.1 keeps code in pages until it is reused
  - **Questions:** Q1, Q2, Q4, Q6.
- **[S16]** *Guide to React project structure*
  - **Who:** Tommy Groshong, Test Double
  - **URL:** https://testdouble.com/insights/react-project-structure-guide
  - **Date:** 2021-11-29
  - **Trust:** medium
  - **Covers:** `pages/` + `ui/` + `lib/` (with `lib/core` holding pure domain logic); one-way rule lib ← ui ← pages; "start with `lib/` only". This is the alternative "lib = all non-UI code" view. **Q4, Q5.**

### Expert articles

- **[S17]** *Colocation*
  - **Who:** Kent C. Dodds
  - **URL:** https://kentcdodds.com/blog/colocation
  - **Date:** 2019-06-17
  - **Trust:** high
  - **Companion:** *State Colocation will make your React app faster*, https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster (2019-09-23)
  - **Covers:** "place code as close to where it's relevant as possible"; colocate tests, styles, state and comments; shared `utils/` accumulates dead code; e2e tests at the root. **Q1, Q3, Q4, Q5, Q6.**
- **[S18]** *AHA Programming*
  - **Who:** Kent C. Dodds
  - **URL:** https://kentcdodds.com/blog/aha-programming
  - **Date:** 2020-06-22
  - **Trust:** high
  - **Covers:** Avoid Hasty Abstractions; "prefer duplication over the wrong abstraction"; optimize for change. **Q2, Q5.**
- **[S19]** *Application State Management with React*
  - **Who:** Kent C. Dodds
  - **URL:** https://kentcdodds.com/blog/application-state-management-with-react
  - **Date:** 2020-07-21
  - **Trust:** high
  - **Covers:** server cache vs UI state; react-query for the cache; keep state local; lift; context only when prop drilling hurts. **Q5.**
- **[S20]** *When to break up a component into multiple components*
  - **Who:** Kent C. Dodds
  - **URL:** https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components
  - **Date:** 2019-07-19
  - **Trust:** high
  - **Covers:** split on real problems (performance, reuse, state tangling, testing); "don't be afraid of a growing component until you start experiencing real problems". Pre-RSC, but the reasoning still holds. **Q2.**
- **[S21]** *Inversion of Control* and *Compound Components with React Hooks*
  - **Who:** Kent C. Dodds
  - **URLs:**
    - https://kentcdodds.com/blog/inversion-of-control (2019-11-18)
    - https://kentcdodds.com/blog/compound-components-with-react-hooks (2019-02-18)
  - **Trust:** high
  - **Covers:** avoid prop explosion by handing control to callers; compound components that share implicit state via context. **Q2.**
- **[S22]** *Presentational and Container Components*
  - **Who:** Dan Abramov
  - **URL:** https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
  - **Date:** 2015, with an "Update from 2019" note
  - **Trust:** high
  - **Verification:** Medium returned 403 to automated fetches. The 2019 note was checked verbatim in the LogRocket reprint (https://blog.logrocket.com/how-to-convert-your-existing-redux-containers-to-hooks/): "I don't suggest splitting your components like this anymore… Hooks let me do the same thing without an arbitrary division."
  - **Covers:** cite it *only* for the retraction. **Q2, Q5.**
- **[S23]** *Writing Resilient Components*
  - **Who:** Dan Abramov (overreacted)
  - **URL:** https://overreacted.io/writing-resilient-components/
  - **Date:** 2019-03-16
  - **Trust:** high
  - **Covers:** keep local state isolated ("avoid making truly local state global"); don't over-police style with lint rules. **Q5, Q6.**
- **[S24]** *The Two Reacts*
  - **Who:** Dan Abramov (overreacted)
  - **URL:** https://overreacted.io/the-two-reacts/
  - **Date:** 2024-01-04
  - **Trust:** high
  - **Covers:** `UI = f(data, state)`; some components belong near the data (server), others near the user (client). The mental model for splitting along the RSC boundary. **Q2, Q5.**
- **[S25]** *Delightful React File/Directory Structure*
  - **Who:** Josh W. Comeau
  - **URL:** https://www.joshwcomeau.com/react/file-structure/
  - **Date:** 2022-03-15, updated 2025-12-03
  - **Trust:** high
  - **Covers:**
    - per-component folders with an `index.ts` redirect; component-specific hooks/helpers inside that folder
    - `src/hooks`, `src/helpers` (project-specific) vs `src/utils` (generic, portable)
    - global `constants.ts`; `@/` alias; kebab-case hook files
    - argues barrel avoidance is premature for apps. The main pro-barrel counterpoint.
  - **Questions:** Q1, Q3, Q4, Q6.
- **[S26]** *React Folder Structure in 5 Steps*
  - **Who:** Robin Wieruch
  - **URL:** https://www.robinwieruch.de/react-folder-structure/
  - **Date:** updated 2026-05-05
  - **Trust:** high
  - **Covers:**
    - progressive structure from a single file up to feature folders and then domains/packages
    - features don't import each other; feature hooks live in `features/x/hooks` and are promoted when reused
    - `lib/` = "pre-configured wrappers around third-party libraries"; `utils/` generic vs `helpers/` project-specific; per-module `constants.ts`
    - kebab-case, singular names; ≤2 nesting levels; `index.js` only as an explicit public API
  - **Questions:** Q1–Q4, Q6.
- **[S27]** *Practical React Query*
  - **Who:** Dominik Dorfmeister (TkDodo), TanStack Query maintainer
  - **URL:** https://tkdodo.eu/blog/practical-react-query
  - **Date:** 2020-11-16, updated 2023-10-21
  - **Trust:** high
  - **Covers:** separate server state from client state; don't copy query data into local state; custom hooks around `useQuery`; keep each key's usages in a per-feature `queries.ts`. **Q5.**
- **[S28]** *Effective React Query Keys*
  - **Who:** TkDodo
  - **URL:** https://tkdodo.eu/blog/effective-react-query-keys
  - **Date:** 2021-06-13, updated 2022-04-23
  - **Trust:** high
  - **Covers:** colocate keys per feature, not in a global `queryKeys.ts`; one query-key factory per feature. **Q3, Q5.**
- **[S29]** *The Query Options API*
  - **Who:** TkDodo
  - **URL:** https://tkdodo.eu/blog/the-query-options-api
  - **Date:** 2024-01-17
  - **Trust:** high
  - **Covers:** `queryOptions` as the main abstraction; "custom hooks won't be my first choice"; "separating QueryKey from QueryFunction was a mistake"; combine with key factories. Supersedes part of [S27]. **Q5.**
- **[S30]** Two articles by Juntao Qiu on martinfowler.com
  - **Articles:**
    - *Modularizing React Applications with Established UI Patterns*: https://martinfowler.com/articles/modularizing-react-apps.html (2023-02-16)
    - *Headless Component: a pattern for composing React UIs*: https://martinfowler.com/articles/headless-component.html (2023-11-07)
  - **Trust:** high
  - **Covers:** view / hook / domain-model / gateway layering; "separate view from non-view logic"; anti-corruption layer for API shapes; headless hooks that separate behaviour from markup. **Q2, Q5.**
- **[S31]** *Screaming Architecture*
  - **Who:** Robert C. Martin
  - **URL:** https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html
  - **Date:** 2011-09-30
  - **Trust:** high (conceptual, not React-specific)
  - **Covers:** "architectures should tell readers about the system, not about the frameworks". The rationale for feature-first top-level folders. **Q1.**

### Style guides

- **[S32]** *Airbnb JavaScript Style Guide and its React/JSX Style Guide*
  - **Who:** Airbnb
  - **URLs:**
    - React/JSX guide: https://github.com/airbnb/javascript/tree/master/react (last change 2021-02-17)
    - JS guide: https://github.com/airbnb/javascript
  - **Trust:** medium. The React section is partly pre-hooks (mentions mixins and `createClass`), so cite it only for naming and export rules.
  - **Covers:**
    - only one React component per file (several stateless ones allowed); PascalCase filenames; `index.jsx` as a directory's root component
    - §10.6 prefer a default export for single-export modules
    - §23.10 uppercase constants only if exported, `const` and immutable
  - **Questions:** Q2, Q3, Q6.
- **[S33]** *Google TypeScript Style Guide*
  - **Who:** Google
  - **URL:** https://google.github.io/styleguide/tsguide.html
  - **Date:** undated (living)
  - **Trust:** high
  - **Covers:** no default exports (named exports only); `CONSTANT_CASE` for module-level constants; no `const enum`; no `export let`; no namespace container classes; *prefers relative imports within a project* (counterpoint to aliases); snake_case files. **Q3, Q6.**

### Tooling

- **[S34]** *eslint-plugin-boundaries / JS Boundaries docs*
  - **Who:** Javier Brea
  - **URLs:**
    - Docs: https://www.jsboundaries.dev/docs/overview/
    - Rules: https://www.jsboundaries.dev/docs/rules/
    - Repo: https://github.com/javierbrea/eslint-plugin-boundaries
  - **Date:** v7.4.5, released 2026-11-25
  - **Trust:** primary (for the tool)
  - **Covers:**
    - element descriptors plus a `dependencies` rule with allow/disallow policies; default-deny when no policy allows a dependency
    - also works with Oxlint
    - `element-types` is an alias of `dependencies`; `entry-point`, `external` and `no-private` are deprecated (older blog posts still use them)
  - **Questions:** Q6.
- **[S35]** *import/no-restricted-paths*
  - **Who:** eslint-plugin-import
  - **URL:** https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md
  - **Date:** undated
  - **Trust:** primary
  - **Covers:** `zones` with `target`/`from`/`except`/`message`. The lightweight way to enforce shared → features → app. **Q6.**
- **[S36]** *components.json: aliases*
  - **Who:** shadcn/ui docs
  - **URL:** https://ui.shadcn.com/docs/components-json
  - **Date:** undated
  - **Trust:** high (de facto convention for Tailwind-based UI kits)
  - **Covers:** alias roots `components`, `ui`, `lib` ("library functions like format-date"), `utils` (`@/lib/utils`) and `hooks`. Explains why many Next.js/Tailwind apps have `lib/utils.ts`. **Q4.**

### Performance

- **[S37]** *How we optimized package imports in Next.js*, plus the `optimizePackageImports` API reference
  - **Who:** Shu Ding, Vercel
  - **URLs:**
    - Blog post: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js (2023-10-13)
    - API reference: https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports (lastUpdated 2025-12-19)
  - **Trust:** primary
  - **Covers:**
    - barrel entry files with up to 10k re-exports
    - dev boot improvements of 15–70%: for example, `lucide-react` went from 1,583 to 333 modules
    - the option is still marked experimental; `lucide-react` and `recharts` (both used by DevDigest's client) are optimized by default
  - **Questions:** Q2.
- **[S38]** *Speeding up the JavaScript ecosystem: The barrel file debacle*
  - **Who:** Marvin Hagemeister
  - **URL:** https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/
  - **Date:** 2023-10-08
  - **Trust:** high
  - **Covers:** barrels inflate the module graph for bundlers, test runners (a per-file cost in Jest) and lint import-cycle rules; synthetic benchmarks; "a few are fine, a barrel in every folder is the problem". **Q2.**
- **[S39]** *Please Stop Using Barrel Files*
  - **Who:** TkDodo
  - **URL:** https://tkdodo.eu/blog/please-stop-using-barrel-files
  - **Date:** 2024-07-26
  - **Trust:** high
  - **Covers:**
    - barrels in apps cause circular imports and slow dev startup (a Next.js app went from 11k to 3.5k modules)
    - `optimizePackageImports` only handles pure re-export files
    - barrels don't really encapsulate
    - OK only as a library entry point; recommends `import/no-cycle` and `unicorn/filename-case`
  - **Questions:** Q2, Q6.
- **[S40]** *How We Achieved 75% Faster Builds by Removing Barrel Files*
  - **Who:** Tim Sebastian, Atlassian (Jira frontend)
  - **URL:** https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files
  - **Date:** 2025-06-26
  - **Trust:** high (industrial case study)
  - **Covers:** 75% fewer CI build minutes per commit; >30% faster TS highlighting; ~50% faster local tests; 88% fewer unit tests per CI build. It also states the trade-offs: losing barrel-based public-API control, and possibly more coupling. **Q2.**

---

## Not included / rejected

- **Tania Rascia, "React Architecture: How to Structure and Organize a React Application"** (https://www.taniarascia.com/react-architecture-directory-structure, 2021-06-23). Redux-store-centred and pre-RSC. Its `services/` = "plain JavaScript module" is the only definition of services found, and it is too dated to anchor a rule.
- **Marmelab, "A Better File Structure For React/Redux Applications"** (2015). Redux era; superseded by feature folders plus server-state libraries.
- **Matt Pocock, "Why I don't like TypeScript enums"** (Total TypeScript, undated page). Accurate but redundant with the primary TS sources [S12]. It is also undated.
- **patterns.dev, "Compound Pattern"**. The host failed DNS resolution during compilation, so it could not be verified. [S21] covers the pattern instead.
- **profy.dev "Screaming Architecture – evolution of a React folder structure", freeCodeCamp "A better way to structure React projects", dev.to and Medium container/presentational explainers, greatfrontend quiz page**. Derivative or low-trust; every claim they make is covered by a primary or high-trust source above.
- **LogRocket "How to convert your existing Redux containers to Hooks"** (2019, updated 2022). Used *only* to verify Abramov's 2019 note verbatim [S22]. Not cited for its own advice, which is Redux-era.
- **O'Reilly, *Learning JavaScript Design Patterns* 2e, ch. 14 "Application Structure for React.js"**. Paywalled, so it could not be verified.
- **TkDodo, "React Query and React Context"** (2023-07-22). Verified and sound: context is for dependency injection, not state management. It is too narrow for a structure skill; it could be added later to the data-fetching guidance.
- **react.dev "Choosing the State Structure"**. Verified, but it is about the shape of state, not file structure, and `react-best-practices` already covers it.
- **Atomic Design (Brad Frost)**. Not fetched. The React FAQ [S1] treats it only as an example to borrow from, and no modern React source above recommends it as a folder scheme.
- **web.archive.org copy of Abramov's Medium post**. The fetch was blocked by the environment's permission policy; the LogRocket reprint was used instead.

## Open questions

1. **Numeric thresholds.** No authoritative source gives a max line count or max prop count. Sources give only qualitative triggers [S2][S14][S20]. `react-best-practices`' "200 lines / 5–7 props" should be marked as a house heuristic, or dropped.
2. **Internal alias barrels.** Does a path-aliased internal barrel (e.g. this repo's `@devdigest/ui` → `src/vendor/ui/index.ts`) get Next's `optimizePackageImports` treatment? The docs talk only about *packages*, and the option is experimental [S37]. Unverified; measure it (module count in `next dev`) before deciding.
3. **Relative vs alias imports inside a feature.** Google prefers relative imports [S33]; Next.js and bulletproof-react default to `@/` [S10][S14]. There is no primary source for the "relative within a feature, alias across features" compromise.
4. **TanStack Query in an RSC app talking to a separate backend.**
   - Next says to pick one data-fetching approach [S9], and DevDigest's is the "External HTTP API" one.
   - How client-side TanStack Query should coexist with Server Component fetching and prefetch/hydration was not researched.
   - TanStack's "Advanced Server Rendering" guide is the next source to read.
5. **Custom hook vs `queryOptions` as the per-feature export** [S27] vs [S29]. TkDodo has shifted toward `queryOptions`; bulletproof-react still shows hooks [S14]. The skill needs a house decision.
6. **The meaning of `lib/`** varies across [S14][S26][S36][S16]. It needs a repo-specific definition, especially since `client/src/lib` currently mixes an API client, providers, hooks and pure helpers.
7. **FSD vs the bulletproof-style three tiers** for a mid-size app. Both are credible. FSD v2.1's "pages first" narrows the gap, but no source settles which suits a Next.js App Router app better. FSD also needs `_app`/`_pages` renaming to coexist with Next.js [S15].
8. **Out of scope, not researched:** where next-intl message files and per-feature translation namespaces should live, and how Tailwind 4 `@theme` tokens relate to a `constants.ts`.
9. **eslint-plugin-boundaries v7 replacement for "must import via public API".** `entry-point` and `no-private` are deprecated [S34]. The docs describe policy selectors on the `dependencies` rule, but the exact replacement for these two rules was not verified.
