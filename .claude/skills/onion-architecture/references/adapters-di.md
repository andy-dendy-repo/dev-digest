# Ports, adapters and the composition root

## Where a port lives

| Port for… | File | Examples |
|---|---|---|
| An external system | `server/src/vendor/shared/adapters.ts` | `LLMProvider`, `GitHubClient`, `GitClient`, `CodeIndex`, `Embedder`, `SecretsProvider`, `AuthProvider`, `JobQueue` |
| A module's own persistence or a module-specific capability | `server/src/modules/<m>/ports.ts` | `PullsPort`, `SettingsPort`, `ConnectionTester`, `AgentsPort`, `ReposPort`, `ReviewsUnitOfWork`. To move here: `Tokenizer`, `DepGraph` |

A port declared inside `src/adapters/**` (today `Tokenizer` and `DepGraph`) points the
wrong way: the core has to import the adapter folder to see its own dependency. When
you touch one, move the interface to the core and leave only the class in
`src/adapters/`.

Add a port to the server copy of `vendor/shared/adapters.ts`, then sync the client
copy (it must stay identical, see [zod.md](zod.md)). The UI uses no ports, but it does
read a few plain types from that file (`ModelInfo`, `GitCommit`).

A port's signature uses domain types only. SDK types (`Octokit`, `SimpleGit`,
`OpenAI.ChatCompletion`, `SgNode`…) stop at the adapter.

## Writing an adapter

Each adapter lives in `src/adapters/<name>/` and:
- implements exactly one port;
- maps SDK responses into domain types;
- translates SDK and network errors into `ExternalServiceError` (or `ConfigError` for
  missing keys), so the core never catches library-specific errors;
- has a mock in `src/adapters/mocks.ts` (`MockGitHubClient`, `MockLLMProvider`, …)
  that tests use through `ContainerOverrides`.

Pure helpers that happen to sit in `src/adapters/` today (`git/diff-parser.ts`,
`codeindex/extract.ts`) have no I/O, so they belong in the core. Move such a helper
next to its use case (or into `domain.ts`) when you next touch it. Anything that wraps
a native binary or library with side effects (`@ast-grep/napi`, ripgrep, simple-git,
js-tiktoken) stays an adapter behind a port.

## The composition root

`src/platform/container.ts` is the only file that knows concrete classes:
- it constructs adapters lazily (`get git()`, `async github()`, `async llm(id)`);
- it accepts `ContainerOverrides` so tests inject mocks;
- it exposes shared repositories (`agentsRepo`, `reviewRepo`, `reposRepo`, …) so
  modules never import each other's repository files;
- it registers background job handlers through the `JobQueue` port (`app.ts`,
  `registerJobHandlers`), never from a route.

A **new** getter returns the port type, not the class:
`get pullsRepo(): PullsPort { return (this._pullsRepo ??= new DrizzlePullsRepository(this.db)); }`.
A getter typed as the concrete class lets every caller reach Drizzle-specific methods,
and the port stops being the boundary. `reviewRepo` still returns its class (debt
until the reviews ports land); every other repository getter is port-typed. Add an `overrides` slot when a route test needs
to swap the implementation. Use-case tests don't need one: they build the service
with fakes directly.

When you add an external system:
1. Add the port to `adapters.ts`.
2. Add the adapter class.
3. Add a lazy getter and an `overrides` slot in `container.ts`.
4. Add a mock to `mocks.ts`.

## Services receive ports, not the container

```ts
// Target shape
export interface ReviewServiceDeps {
  reviews: ReviewsPort;
  runs: RunsPort;
  llm: (id: Provider) => Promise<LLMProvider>;   // async factory when the adapter is built lazily
  runBus: RunBus;
}
export class ReviewService {
  constructor(private deps: ReviewServiceDeps) {}
}
```

Services in `reviews` and `repo-intel` still take `private container: Container`
(recorded debt); the others take a deps object. A service
written that way hides its dependencies, cannot be tested without building a whole
container, and can reach anything. New services take a deps object. When you
substantially edit an old one, convert it and regenerate the baseline.

`src/platform/` mixes the composition root with cross-cutting code. The core may
import the pure utilities listed in the rings table of `../SKILL.md`. These are
outer-ring and enforced by `core-platform-pure-only` / `core-no-container`:
- `container.ts` and `config.ts`: composition root, env;
- `jobs.ts`: Drizzle;
- `contained-read.ts` and `prompts.ts`: filesystem.

A use case that needs a file read or a job queue gets it through a port.
