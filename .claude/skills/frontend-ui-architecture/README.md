# frontend-ui-architecture

**Version:** 1.0.1 · **Updated:** 2026-11-26 · **Scope:** `client/` (Next.js 15 App Router, React 19, TanStack Query 5)

This skill says where code lives in the DevDigest web client and why. It covers:
- where components live and what goes in a component folder
- when to split a component
- where constants, helpers, `lib/` modules, hooks and query code go
- how business logic is layered
- import direction, aliases, barrels, exports and file naming

The agent-facing rules are in [SKILL.md](SKILL.md). This README is for people: why the skill
exists, the decisions behind it, and every source it was built from.

## Files

| File | For |
|---|---|
| [SKILL.md](SKILL.md) | The rules the agent loads: placement table, map, rules per topic, checklist |
| [references/research-notes.md](references/research-notes.md) | The research behind the rules: takeaways per question, the disagreements between sources, rejected sources, open questions |
| `README.md` | This file: purpose, house decisions, the source list, version history |

## What it does not cover

These belong to other skills, so the two never give conflicting advice:
- [react-best-practices](../react-best-practices/SKILL.md): hook misuse, state anti-patterns, rendering performance
- [next-best-practices](../next-best-practices/SKILL.md): Next.js APIs, RSC mechanics, metadata, route handlers
- [react-testing-library](../react-testing-library/SKILL.md): how to write tests (this skill only says where they go)

## House decisions

The sources disagree on these points. These are the choices this skill makes; settled with the
maintainer on 2026-11-26.

| Question | Decision | Why |
|---|---|---|
| Generic or repo-specific? | Repo-specific rules, each backed by a source | The client already has a consistent convention, so the agent should follow it, not rediscover it |
| Folder layout | Route-private `_components/<Name>/` → shared `src/components/<kebab>/` → design system `src/vendor/ui` | This is the existing convention. It matches Next's colocation model [S7] and "promote on reuse" [S15][S26] |
| Barrels | A one-line explicit `index.ts` per component is fine. No new `export *` or aggregating barrels. `@devdigest/ui` is the one library-entry barrel | Barrels cost performance at scale [S37]–[S40]. A per-component index is the FSD-sanctioned form [S15]. A barrel as a library entry point is fine [S39] |
| TanStack Query layout | Keep hooks in `lib/hooks/<domain>.ts`. New or changed queries get a key factory + `queryOptions` in the same domain file. No forced migration | The current layout works. The maintainer of TanStack Query now prefers `queryOptions` [S29] and per-domain key factories [S28] |
| Container/presentational | Not used: logic goes to custom hooks | Withdrawn by its author in 2019 [S22] and replaced by hooks [S3] |
| Size limits | None. Split on concrete signals instead | No authoritative source gives a number [S2][S14][S20] |
| `lib/` meaning | Cross-route non-UI code: the API client, data hooks, domain modules, providers. No `utils/` | Sources disagree [S14][S16][S26][S36]. This matches the current `src/lib` and avoids a dumping ground [S17] |
| Enums | `as const` objects or unions with `satisfies` | [S12][S33] |
| Imports | `@/` alias outside the component folder; relative only inside it | [S10][S14][S25]. Google prefers relative imports [S33]; this choice is a synthesis |
| Exports | Named exports; default only for Next special files | [S33][S7] |
| File naming | Keep the current mix: PascalCase component folders under `_components`, kebab-case shared folders and modules | Sources split [S14][S26][S32]; consistency wins [S7] |

As part of this change, [react-best-practices](../react-best-practices/SKILL.md) dropped its
container/presentational rule, turned its numeric size limits into heuristics, and now points
here for code organization.

## Sources

Every URL was fetched and checked against the claim it supports on 2026-11-26 (one exception:
[S22]). Tags `[Sn]` in [SKILL.md](SKILL.md) and the research notes use this numbering.

Trust levels:
- **primary:** owner of the technology
- **high:** recognized expert or widely adopted reference
- **medium:** credible but opinionated, dated or narrow

### Official documentation

| # | Source | Owner | Date | Trust |
|---|---|---|---|---|
| S1 | [File Structure (React FAQ, legacy)](https://legacy.reactjs.org/docs/faq-structure.html) | React team | undated, frozen 2023 | primary |
| S2 | [Thinking in React](https://react.dev/learn/thinking-in-react) | react.dev | current | primary |
| S3 | [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) | react.dev | current | primary |
| S4 | [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) | react.dev | current | primary |
| S5 | [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component) | react.dev | current | primary |
| S6 | [`'use client'` reference](https://react.dev/reference/rsc/use-client) | react.dev | current | primary |
| S7 | [Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure) | Next.js | 2026-07-21 | primary |
| S8 | [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) | Next.js | 2026-10-05 | primary |
| S9 | [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) | Next.js | 2026-11-18 | primary |
| S10 | [Absolute imports and module path aliases](https://nextjs.org/docs/app/getting-started/installation#set-up-absolute-imports-and-module-path-aliases) | Next.js | 2026-10-02 | primary |
| S11 | [Does this replace client state?](https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state) · [Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) | TanStack | v5 docs | primary |
| S12 | [Enums: objects vs enums](https://www.typescriptlang.org/docs/handbook/enums.html) · [TS 5.8 `--erasableSyntaxOnly`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html) | Microsoft | 2025 | primary |
| S13 | [How to write stories](https://storybook.js.org/docs/writing-stories) | Storybook | current | primary |

### Reference architectures

| # | Source | Owner | Date | Trust |
|---|---|---|---|---|
| S14 | bulletproof-react: [Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) · [Project Standards](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md) · [Components and Styling](https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md) · [API Layer](https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md) · [State Management](https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md) | Alan Alickovic | 2024–2026 | high |
| S15 | Feature-Sliced Design v2.1: [Overview](https://feature-sliced.design/docs/get-started/overview) · [Public API](https://feature-sliced.design/docs/reference/public-api) · [Usage with Next.js](https://feature-sliced.design/docs/guides/tech/with-nextjs) · [Migration v2.0→v2.1 ("pages first")](https://fsd.how/docs/guides/migration/from-v2-0/) · [Steiger linter](https://github.com/feature-sliced/steiger) | FSD core team | 2018–2025 | high |
| S16 | [Guide to React project structure](https://testdouble.com/insights/react-project-structure-guide) | Tommy Groshong, Test Double | 2021-11-29 | medium |

### Expert articles

| # | Source | Author | Date | Trust |
|---|---|---|---|---|
| S17 | [Colocation](https://kentcdodds.com/blog/colocation) · [State Colocation will make your React app faster](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) | Kent C. Dodds | 2019 | high |
| S18 | [AHA Programming](https://kentcdodds.com/blog/aha-programming) | Kent C. Dodds | 2020-06-22 | high |
| S19 | [Application State Management with React](https://kentcdodds.com/blog/application-state-management-with-react) | Kent C. Dodds | 2020-07-21 | high |
| S20 | [When to break up a component into multiple components](https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components) | Kent C. Dodds | 2019-07-19 | high |
| S21 | [Inversion of Control](https://kentcdodds.com/blog/inversion-of-control) · [Compound Components with React Hooks](https://kentcdodds.com/blog/compound-components-with-react-hooks) | Kent C. Dodds | 2019 | high |
| S22 | [Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0) (cited only for its 2019 retraction; quote verified in the [LogRocket reprint](https://blog.logrocket.com/how-to-convert-your-existing-redux-containers-to-hooks/) because Medium blocked fetching) | Dan Abramov | 2015 / 2019 note | high |
| S23 | [Writing Resilient Components](https://overreacted.io/writing-resilient-components/) | Dan Abramov | 2019-03-16 | high |
| S24 | [The Two Reacts](https://overreacted.io/the-two-reacts/) | Dan Abramov | 2024-01-04 | high |
| S25 | [Delightful React File/Directory Structure](https://www.joshwcomeau.com/react/file-structure/) | Josh W. Comeau | 2022, updated 2025-12-03 | high |
| S26 | [React Folder Structure in 5 Steps](https://www.robinwieruch.de/react-folder-structure/) | Robin Wieruch | updated 2026-05-05 | high |
| S27 | [Practical React Query](https://tkdodo.eu/blog/practical-react-query) | Dominik Dorfmeister (TkDodo) | 2020, updated 2023-10-21 | high |
| S28 | [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) | TkDodo | 2021, updated 2022-04-23 | high |
| S29 | [The Query Options API](https://tkdodo.eu/blog/the-query-options-api) | TkDodo | 2024-01-17 | high |
| S30 | [Modularizing React Applications with Established UI Patterns](https://martinfowler.com/articles/modularizing-react-apps.html) · [Headless Component](https://martinfowler.com/articles/headless-component.html) | Juntao Qiu (martinfowler.com) | 2023 | high |
| S31 | [Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html) | Robert C. Martin | 2011-09-30 | high |

### Style guides

| # | Source | Owner | Date | Trust |
|---|---|---|---|---|
| S32 | [Airbnb React/JSX Style Guide](https://github.com/airbnb/javascript/tree/master/react) · [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) | Airbnb | React section 2021 (partly pre-hooks) | medium |
| S33 | [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) | Google | living | high |

### Tooling

| # | Source | Owner | Date | Trust |
|---|---|---|---|---|
| S34 | [JS Boundaries overview](https://www.jsboundaries.dev/docs/overview/) · [rules](https://www.jsboundaries.dev/docs/rules/) · [eslint-plugin-boundaries repo](https://github.com/javierbrea/eslint-plugin-boundaries) | Javier Brea | v7.4.5, 2026-11-25 | primary |
| S35 | [`import/no-restricted-paths`](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md) | eslint-plugin-import | current | primary |
| S36 | [components.json: aliases](https://ui.shadcn.com/docs/components-json) | shadcn/ui | current | high |

### Performance (barrel files)

| # | Source | Owner | Date | Trust |
|---|---|---|---|---|
| S37 | [How we optimized package imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js) · [`optimizePackageImports` reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports) | Shu Ding, Vercel | 2023-10-13 / 2025-12-19 | primary |
| S38 | [Speeding up the JavaScript ecosystem: The barrel file debacle](https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/) | Marvin Hagemeister | 2023-10-08 | high |
| S39 | [Please Stop Using Barrel Files](https://tkdodo.eu/blog/please-stop-using-barrel-files) | TkDodo | 2024-07-26 | high |
| S40 | [How We Achieved 75% Faster Builds by Removing Barrel Files](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files) | Tim Sebastian, Atlassian | 2025-06-26 | high |

### Reviewed but not used

These were looked at during research and left out. The reasons are in
[research-notes.md › Not included / rejected](references/research-notes.md#not-included--rejected).

- [Tania Rascia: React Architecture](https://www.taniarascia.com/react-architecture-directory-structure): Redux-era, pre-RSC
- Marmelab: A Better File Structure For React/Redux Applications (2015): Redux-era
- Matt Pocock: Why I don't like TypeScript enums: redundant with [S12]
- patterns.dev: Compound Pattern: host unreachable, so it could not be verified; [S21] covers the topic
- [TkDodo: React Query and React Context](https://tkdodo.eu/blog/react-query-and-react-context): sound, but out of scope
- [react.dev: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure): covered by react-best-practices
- O'Reilly, *Learning JavaScript Design Patterns* 2e, ch. 14: paywalled
- Atomic Design (Brad Frost): not recommended as a folder scheme by any modern source above

## Maintaining the skill

- **Version:** `metadata.version` in [SKILL.md](SKILL.md) follows semver.
  - **Major:** a house decision changes, e.g. dropping per-component `index.ts`.
  - **Minor:** a new rule or section.
  - **Patch:** wording or a source fix.

  Bump `metadata.updated` and the line at the top of this file, and add a row below.
- **New sources:** add them to the next free `[Sn]` here and in `references/research-notes.md`.
  Never renumber existing tags.
- **Code changes:** when a known deviation listed in SKILL.md is cleaned up in code, remove it
  from that list.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-11-26 | First version: research on 40 sources and house decisions settled with the maintainer |
| 1.0.1 | 2026-11-26 | After the first eval run: unit letters in formatted labels go through next-intl; client tasks stay inside `client/`; don't add lines to existing `export *` barrels |
| 1.1.0 | 2026-11-27 | After the architecture refactor (F1–F7): "Known deviations" removed (all fixed); every query uses key factories + `queryOptions`; new "Enforced by lint" section (`pnpm lint` in CI) |
