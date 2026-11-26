/**
 * Onion Architecture import rules for server/ and reviewer-core/.
 * Run from server/ (dependency-cruiser is a server dependency):
 *
 *   pnpm exec depcruise src ../reviewer-core/src \
 *     --config ../.claude/skills/onion-architecture/assets/depcruise.cjs \
 *     --ignore-known ../.claude/skills/onion-architecture/assets/known-violations.json
 *
 * Paths below are relative to server/. Layer roles (see ../SKILL.md):
 *   presentation   src/modules/<m>/routes.ts, src/modules/index.ts, src/modules/_shared/**
 *   infrastructure src/db/**, src/adapters/**, src/modules/<m>/repository.ts|repository/**
 *   module barrel  src/modules/<m>/index.ts (public surface; re-exports only)
 *   core           every other file under src/modules/ (service, ports, domain, helpers, pipeline…)
 *   domain         src/vendor/shared/**, src/modules/<m>/domain.ts
 *   engine         ../reviewer-core/src/** (its SDK adapter lives in llm/)
 */

const PRESENTATION = '^src/modules/(index\\.ts$|_shared/|[^/]+/routes\\.ts$)';
const BARREL = '^src/modules/[^/]+/index\\.ts$';
const MODULE_INFRA = '^src/modules/[^/]+/(repository\\.ts$|repository/)';
const INFRA = '^src/(db|adapters)/';
const DOMAIN = '^src/(vendor/shared/|modules/[^/]+/domain\\.ts$)';
const ENGINE = '^\\.\\./reviewer-core/src/';
const ENGINE_ADAPTER = '^\\.\\./reviewer-core/src/llm/';

// Packages that are infrastructure or a delivery mechanism: only adapters,
// repositories, db/ and the composition root may touch them.
const INFRA_PACKAGES =
  'node_modules/(drizzle-orm|postgres|octokit|@octokit|simple-git|openai|@anthropic-ai|@ast-grep|@vscode/ripgrep|dependency-cruiser|js-tiktoken)/';
const DELIVERY_PACKAGES = 'node_modules/(fastify|@fastify|fastify-[^/]+)/';

// Node builtins that do I/O. Pure ones (path, url, util, crypto, events) stay allowed.
// The check cannot see globals: `fetch(...)` and `process.env` still need review.
const IO_BUILTINS =
  '^(node:)?(fs|fs/promises|child_process|net|http|https|http2|dgram|dns|tls|os|readline|worker_threads|cluster)$';

// src/platform/ mixes the composition root with cross-cutting code. Application code
// may use only these pure utilities; jobs.ts (Drizzle), contained-read.ts and
// prompts.ts (filesystem), config.ts (env) and container.ts are outer-ring.
const PLATFORM_PURE =
  '^src/platform/(errors|resilience|run-logger|sse|price-book|model-router|local-only|grounding|prompt|structured|trace-builder)\\.ts$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'routes-no-infra',
      severity: 'error',
      comment:
        'Routes are presentation: parse input, call a use case, shape the response. ' +
        'Data access goes through a service and a repository port.',
      from: { path: PRESENTATION },
      to: { path: [INFRA, MODULE_INFRA, INFRA_PACKAGES, IO_BUILTINS] },
    },
    {
      name: 'core-no-infra',
      severity: 'error',
      comment:
        'Use cases and domain logic depend on ports (interfaces), never on db/, adapters/, ' +
        'repositories, SDKs, Fastify or Node I/O. The composition root injects the implementations.',
      from: { path: '^src/modules/', pathNot: [PRESENTATION, BARREL, MODULE_INFRA, DOMAIN] },
      to: { path: [INFRA, MODULE_INFRA, INFRA_PACKAGES, DELIVERY_PACKAGES, IO_BUILTINS] },
    },
    {
      name: 'core-platform-pure-only',
      severity: 'error',
      comment:
        'Application code may use the pure platform utilities (errors, resilience, run-logger…). ' +
        'jobs.ts, contained-read.ts, prompts.ts and config.ts do I/O and belong outside the core.',
      from: { path: '^src/modules/', pathNot: [PRESENTATION, BARREL, MODULE_INFRA] },
      to: { path: '^src/platform/', pathNot: [PLATFORM_PURE, '^src/platform/container\\.ts$'] },
    },
    {
      name: 'core-no-container',
      severity: 'error',
      comment:
        'Services take the ports they need as constructor arguments. Importing the ' +
        'Container turns it into a service locator and hides the real dependencies.',
      from: { path: '^src/modules/', pathNot: [PRESENTATION, BARREL, MODULE_INFRA] },
      to: { path: '^src/platform/container\\.ts$' },
    },
    {
      name: 'no-foreign-repository',
      severity: 'error',
      comment:
        "A module reaches another module's data through a port wired in the container " +
        "(e.g. container.reviewRepo), not by importing that module's repository file.",
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: MODULE_INFRA, pathNot: '^src/modules/$1/' },
    },
    {
      name: 'no-foreign-barrel',
      severity: 'error',
      comment:
        "A barrel can re-export its module's repository (repo-intel/index.ts does), which would " +
        'slip past no-foreign-repository. Import the specific file you need (types, constants, ports).',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: BARREL, pathNot: '^src/modules/$1/' },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'The domain centre imports only zod and other domain files.',
      from: { path: DOMAIN },
      to: { pathNot: [DOMAIN, 'node_modules/zod/'] },
    },
    {
      name: 'engine-no-io',
      severity: 'error',
      comment:
        'reviewer-core is a pure engine: no Node I/O, no server code. Its only side effect ' +
        'is the injected LLMProvider.',
      from: { path: ENGINE },
      to: {
        path: [IO_BUILTINS, '^src/(?!vendor/shared/)'],
      },
    },
    {
      name: 'engine-sdk-only-in-llm',
      severity: 'error',
      comment: 'Only the provider adapter in reviewer-core/src/llm/ may import an LLM SDK.',
      from: { path: ENGINE, pathNot: ENGINE_ADAPTER },
      to: { path: 'node_modules/(openai|@anthropic-ai)/' },
    },
    {
      name: 'resolvable',
      severity: 'error',
      comment:
        'Package rules match resolved node_modules/<pkg>/ paths. An unresolved import means ' +
        'dependencies are not installed (run pnpm install / npm ci) and the other rules are blind.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-circular',
      severity: 'warn',
      comment: 'Cycles usually mean a dependency points outward somewhere.',
      from: { path: '^src/modules/' },
      to: { circular: true },
    },
  ],
  options: {
    // Keep package paths as node_modules/<pkg>/… instead of pnpm's versioned
    // .pnpm/<pkg>@<ver>/… so known-violations.json survives dependency bumps.
    preserveSymlinks: true,
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
