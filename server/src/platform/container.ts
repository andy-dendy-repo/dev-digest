import type {
  AuthProvider,
  SecretsProvider,
  GitHubClient,
  GitClient,
  CodeIndex,
  Embedder,
  LLMProvider,
} from '@devdigest/shared';
import { cpus } from 'node:os';
import type { AppConfig } from './config.js';
import type { Db } from '../db/client.js';
import { JobRunner } from './jobs.js';
import { runBus, type RunBus } from './sse.js';
import { LocalSecretsProvider } from '../adapters/secrets/local.js';
import { LocalNoAuthProvider } from '../adapters/auth/local.js';
import { OctokitGitHubClient } from '../adapters/github/octokit.js';
import { SimpleGitClient } from '../adapters/git/simple-git.js';
import { RipgrepCodeIndex } from '../adapters/codeindex/ripgrep.js';
import { OpenAIProvider } from '../adapters/llm/openai.js';
import { AnthropicProvider } from '../adapters/llm/anthropic.js';
import { OpenAIEmbedder } from '../adapters/embedder/openai.js';
import { OpenRouterProvider } from '@devdigest/reviewer-core';
import { estimateCost } from '../adapters/llm/pricing.js';
import { PriceBook } from './price-book.js';
import { ConfigError } from './errors.js';
import { AgentsRepository } from '../modules/agents/repository.js';
import type { AgentsPort } from '../modules/agents/ports.js';
import { ReviewRepository } from '../modules/reviews/repository.js';
import type {
  PullLookupPort,
  ReviewsPort,
  ReviewsUnitOfWork,
  RunsPort,
} from '../modules/reviews/ports.js';
import { DrizzleUnitOfWork } from '../db/unit-of-work.js';
import type { PullsPort, ReviewSummaryPort, RunCostsPort } from '../modules/pulls/ports.js';
import { DrizzlePullsRepository } from '../modules/pulls/repository.js';
import type { ConnectionTester, SettingsPort } from '../modules/settings/ports.js';
import { DrizzleSettingsRepository } from '../modules/settings/repository.js';
import type { ReposPort } from '../modules/repos/ports.js';
import { RepoRepository } from '../modules/repos/repository.js';
import { LiveConnectionTester } from '../adapters/connection-tester.js';
import type { RepoIntel } from '../modules/repo-intel/types.js';
import type {
  CloneReader,
  CodeParser,
  DepGraph,
  RepoIntelServiceDeps,
  RepoIntelStore,
  Tokenizer,
} from '../modules/repo-intel/ports.js';
import { RepoIntelService } from '../modules/repo-intel/service.js';
import { RepoIndexer, type RepoIndexing } from '../modules/repo-intel/indexing.js';
import { RepoIntelRepository } from '../modules/repo-intel/repository.js';
import { AstGrepCodeParser } from '../adapters/astgrep/index.js';
import { FsCloneReader } from '../adapters/clone-reader/index.js';
import { DepCruiseGraph } from '../adapters/depgraph/index.js';
import { TiktokenTokenizer } from '../adapters/tokenizer/index.js';

/**
 * DI container. One per app instance. Holds config, db, the JobRunner,
 * the SSE bus, and lazily-constructed adapters resolved through SecretsProvider.
 *
 * Tests construct a container with `overrides` to inject mock adapters; the
 * Services depend on these interfaces, not the concrete classes.
 */
/**
 * Everything the reviews repository serves: the reviews module's own ports plus
 * the read side the PR list (pulls module) needs.
 */
export type ReviewStore = ReviewsPort & RunsPort & PullLookupPort & ReviewSummaryPort & RunCostsPort;

export interface ContainerOverrides {
  secrets?: SecretsProvider;
  auth?: AuthProvider;
  github?: GitHubClient;
  git?: GitClient;
  codeIndex?: CodeIndex;
  embedder?: Embedder;
  /** Pre-built providers by id (skip key lookup). */
  llm?: Partial<Record<'openai' | 'anthropic' | 'openrouter', LLMProvider>>;
  /** repo-intel facade (T1.1+) — tests inject mock RepoIntel implementations. */
  repoIntel?: RepoIntel;
  /** repo-intel T3 adapters — only the indexer pipeline reads these. */
  depgraph?: DepGraph;
  tokenizer?: Tokenizer;
}

export class Container {
  readonly config: AppConfig;
  readonly db: Db;
  readonly secrets: SecretsProvider;
  readonly auth: AuthProvider;
  readonly jobs: JobRunner;
  readonly runBus: RunBus;

  private _git?: GitClient;
  private _github?: GitHubClient;
  private _codeIndex?: CodeIndex;
  private _embedder?: Embedder;
  private llmCache = new Map<string, LLMProvider>();

  // Shared repositories for cross-cutting entities (agents, reviews/pulls,
  // runs). Constructed here, in the composition root, so consuming modules use
  // `container.agentsRepo` instead of reaching into another module's folder.
  private _agentsRepo?: AgentsPort;
  private _reviewRepo?: ReviewStore;
  private _reviewsUow?: ReviewsUnitOfWork;
  private _pullsRepo?: PullsPort;
  private _settingsRepo?: SettingsPort;
  private _reposRepo?: ReposPort;
  private _connectionTester?: ConnectionTester;
  private _repoIntel?: RepoIntel;
  private _repoIndexer?: RepoIndexing;
  private _repoIntelStore?: RepoIntelStore;
  private _codeParser?: CodeParser;
  private _cloneReader?: CloneReader;
  private _depgraph?: DepGraph;
  private _tokenizer?: Tokenizer;
  private _priceBook?: PriceBook;

  constructor(config: AppConfig, db: Db, private overrides: ContainerOverrides = {}) {
    this.config = config;
    this.db = db;
    this.secrets = overrides.secrets ?? new LocalSecretsProvider(config.secretsPath);
    this.auth = overrides.auth ?? new LocalNoAuthProvider(db);
    this.runBus = runBus;
    this.jobs = new JobRunner(db);
  }

  get git(): GitClient {
    if (this.overrides.git) return this.overrides.git;
    this._git ??= new SimpleGitClient(this.config.cloneDir, {
      getToken: () => this.secrets.get('GITHUB_TOKEN'),
    });
    return this._git;
  }

  get agentsRepo(): AgentsPort {
    return (this._agentsRepo ??= new AgentsRepository(this.db));
  }

  get reviewRepo(): ReviewStore {
    return (this._reviewRepo ??= new ReviewRepository(this.db));
  }

  get pullsRepo(): PullsPort {
    return (this._pullsRepo ??= new DrizzlePullsRepository(this.db));
  }

  get settingsRepo(): SettingsPort {
    return (this._settingsRepo ??= new DrizzleSettingsRepository(this.db));
  }

  get reposRepo(): ReposPort {
    return (this._reposRepo ??= new RepoRepository(this.db));
  }

  /**
   * S11 "Test connection": a candidate key gets a throwaway client
   * (`githubWithToken` / `llmWithKey`), no key → the stored secret.
   */
  get connectionTester(): ConnectionTester {
    return (this._connectionTester ??= new LiveConnectionTester({
      github: async (token) => (token ? this.githubWithToken(token) : this.github()),
      llm: (provider, key) => (key ? this.llmWithKey(provider, key) : this.llm(provider)),
    }));
  }

  /** Atomic review persistence (one transaction per finished run). */
  get reviewsUow(): ReviewsUnitOfWork {
    return (this._reviewsUow ??= new DrizzleUnitOfWork(this.db, (tx) => ({
      reviews: new ReviewRepository(tx),
    })));
  }

  get codeIndex(): CodeIndex {
    if (this.overrides.codeIndex) return this.overrides.codeIndex;
    this._codeIndex ??= new RipgrepCodeIndex(this.git);
    return this._codeIndex;
  }

  /**
   * The repo-intel facade. All higher-level features (reviews, blast,
   * onboarding, phantom-gate) code against this interface.
   * Tests inject a mock via `ContainerOverrides.repoIntel`.
   */
  get repoIntel(): RepoIntel {
    if (this.overrides.repoIntel) return this.overrides.repoIntel;
    this._repoIntel ??= new RepoIntelService(this.repoIntelDeps());
    return this._repoIntel;
  }

  /**
   * repo-intel indexing (full / incremental / resync) for the job handlers.
   * Always the real indexer, even when `overrides.repoIntel` swaps the facade.
   */
  get repoIndexer(): RepoIndexing {
    return (this._repoIndexer ??= new RepoIndexer(this.repoIntelDeps()));
  }

  /** The repo-intel tables (symbols, references, file_rank, repo_map_cache…). */
  get repoIntelStore(): RepoIntelStore {
    return (this._repoIntelStore ??= new RepoIntelRepository(this.db));
  }

  /** AST parser (@ast-grep/napi) for the indexer and the diff-scoped reads. */
  get codeParser(): CodeParser {
    return (this._codeParser ??= new AstGrepCodeParser());
  }

  /** Contained reads + source walk over the local clones. */
  get cloneReader(): CloneReader {
    return (this._cloneReader ??= new FsCloneReader());
  }

  private repoIntelDeps(): RepoIntelServiceDeps {
    return {
      store: this.repoIntelStore,
      git: this.git,
      codeIndex: this.codeIndex,
      parser: this.codeParser,
      clone: this.cloneReader,
      depgraph: this.depgraph,
      tokenizer: this.tokenizer,
      parseConcurrency: Math.max(1, cpus().length - 1),
      enabled: this.config.repoIntelEnabled,
    };
  }

  /** Import-graph builder (dependency-cruiser). T3 indexer pipeline only. */
  get depgraph(): DepGraph {
    if (this.overrides.depgraph) return this.overrides.depgraph;
    this._depgraph ??= new DepCruiseGraph();
    return this._depgraph;
  }

  /** Token counter (js-tiktoken) for the repo-map budget search. */
  get tokenizer(): Tokenizer {
    if (this.overrides.tokenizer) return this.overrides.tokenizer;
    this._tokenizer ??= new TiktokenTokenizer();
    return this._tokenizer;
  }

  /**
   * Live OpenRouter pricing for cost attribution. The lister builds a bare
   * OpenRouter provider just for `/models` (no estimator needed) and degrades to
   * `[]` when no key is configured; the static `estimateCost` table is the
   * fallback for OpenAI/Anthropic and a cold/cold-failed cache.
   */
  get priceBook(): PriceBook {
    this._priceBook ??= new PriceBook(async () => {
      try {
        const key = await this.secrets.get('OPENROUTER_API_KEY');
        if (!key) return [];
        return await new OpenRouterProvider(key).listModels();
      } catch {
        return [];
      }
    }, estimateCost);
    return this._priceBook;
  }

  async github(): Promise<GitHubClient> {
    if (this.overrides.github) return this.overrides.github;
    if (this._github) return this._github;
    const token = await this.secrets.get('GITHUB_TOKEN');
    if (!token) throw new ConfigError('GITHUB_TOKEN is not configured');
    this._github = new OctokitGitHubClient(token);
    return this._github;
  }

  /** Resolve an LLM provider by id; constructs from the secret key, cached. */
  async llm(id: 'openai' | 'anthropic' | 'openrouter'): Promise<LLMProvider> {
    const injected = this.overrides.llm?.[id];
    if (injected) return injected;
    const cached = this.llmCache.get(id);
    if (cached) return cached;
    const provider = await this.buildLlm(id);
    this.llmCache.set(id, provider);
    return provider;
  }

  /**
   * S11 (security hardening) — a provider built from a CANDIDATE key,
   * neither read from nor written to the secrets store and not cached. Used
   * by "Test connection" so a typo is verified before it can overwrite a
   * working key.
   */
  async llmWithKey(id: 'openai' | 'anthropic' | 'openrouter', key: string): Promise<LLMProvider> {
    const injected = this.overrides.llm?.[id];
    if (injected) return injected;
    return this.buildLlm(id, key);
  }

  /** S11 — a GitHub client for a candidate token, not persisted or cached. */
  githubWithToken(token: string): GitHubClient {
    return this.overrides.github ?? new OctokitGitHubClient(token);
  }

  private async buildLlm(
    id: 'openai' | 'anthropic' | 'openrouter',
    keyOverride?: string,
  ): Promise<LLMProvider> {
    if (id === 'openai') {
      const key = keyOverride ?? (await this.secrets.get('OPENAI_API_KEY'));
      if (!key) throw new ConfigError('OPENAI_API_KEY is not configured');
      return new OpenAIProvider(key);
    }
    if (id === 'openrouter') {
      // Single OpenRouter provider lives in reviewer-core (shared with the CI
      // runner); inject the PriceBook so cost attribution uses LIVE OpenRouter
      // prices (with the static table as a fallback) rather than a hardcoded one.
      const key = keyOverride ?? (await this.secrets.get('OPENROUTER_API_KEY'));
      if (!key) throw new ConfigError('OPENROUTER_API_KEY is not configured');
      return new OpenRouterProvider(key, {
        estimateCost: (model, tokensIn, tokensOut) =>
          this.priceBook.estimate(model, tokensIn, tokensOut),
      });
    }
    const key = keyOverride ?? (await this.secrets.get('ANTHROPIC_API_KEY'));
    if (!key) throw new ConfigError('ANTHROPIC_API_KEY is not configured');
    return new AnthropicProvider(key);
  }

  async embedder(): Promise<Embedder> {
    // Injected embedders (tests) always win. Otherwise embeddings are gated by
    // config: when disabled we throw BEFORE constructing the OpenAI client, so
    // the app makes ZERO OpenAI requests. All callers wrap this in try/catch and
    // degrade gracefully (memory/RAG simply returns no hits).
    if (this.overrides.embedder) return this.overrides.embedder;
    if (!this.config.embeddingsEnabled) {
      throw new ConfigError('Embeddings are disabled (set EMBEDDINGS_ENABLED=true to enable memory/RAG)');
    }
    if (this._embedder) return this._embedder;
    const openai = await this.llm('openai');
    this._embedder = new OpenAIEmbedder(openai);
    return this._embedder;
  }

  /**
   * Drop cached provider clients so the next resolve picks up changed secrets.
   * Call after persisting a new API key/PAT via SecretsProvider.set.
   */
  invalidateSecretCaches(): void {
    this.llmCache.clear();
    this._github = undefined;
    this._embedder = undefined;
  }
}
