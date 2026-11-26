import { describe, it, expect } from 'vitest';
import type { CodeIndex, CodeReference } from '@devdigest/shared';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { Container } from '../src/platform/container.js';
import type { Db } from '../src/db/client.js';
import {
  MockCloneReader,
  MockGitClient,
  MockJobQueue,
  MockSecretsProvider,
} from '../src/adapters/mocks.js';
import { AstGrepCodeParser } from '../src/adapters/astgrep/index.js';
import { CallerSignaturesQuery } from '../src/modules/repo-intel/callers.js';
import { UnresolvedReferencesQuery } from '../src/modules/repo-intel/phantom.js';
import {
  RepoIndexer,
  registerRepoIntelJobHandlers,
  type RepoIndexing,
} from '../src/modules/repo-intel/indexing.js';
import {
  INDEX_JOB_KIND,
  REFRESH_JOB_KIND,
  RESYNC_JOB_KIND,
} from '../src/modules/repo-intel/constants.js';
import type { RepoBasics } from '../src/modules/repo-intel/ports.js';
import type { FileRankRow, IndexResult, RepoIntel } from '../src/modules/repo-intel/types.js';

/**
 * Hermetic use-case tests for repo-intel: each use case is built from port
 * fakes (in-memory clone, fake CodeIndex / store) plus the real ast-grep
 * parser. No DB, no filesystem, no container.
 */

const BASICS: RepoBasics = {
  id: 'r1',
  owner: 'acme',
  name: 'app',
  defaultBranch: 'main',
  clonePath: '/clone',
};

const CLONE = {
  'src/util.ts': 'export function alpha(x: number) { return x + 1; }\nexport type T = string;\n',
  'src/a.ts': "import { alpha } from './util';\nexport function useA() {\n  return alpha(1);\n}\n",
  'src/b.ts': "import { alpha } from './util';\nexport function useB() {\n  return alpha(2);\n}\n",
};

function fakeCodeIndex(refs: Record<string, CodeReference[]>) {
  const asked: string[] = [];
  const codeIndex: Pick<CodeIndex, 'references'> = {
    references: async (_repo, symbol) => {
      asked.push(symbol);
      return refs[symbol] ?? [];
    },
  };
  return { codeIndex, asked };
}

function callersQuery(opts: { ranks?: FileRankRow[]; enabled?: boolean; basics?: RepoBasics | null }) {
  const { codeIndex, asked } = fakeCodeIndex({
    alpha: [
      { fromPath: 'src/util.ts', toSymbol: 'alpha', line: 1 }, // self → skipped
      { fromPath: 'src/a.ts', toSymbol: 'alpha', line: 3 },
      { fromPath: 'src/b.ts', toSymbol: 'alpha', line: 3 },
      { fromPath: 'src/a.ts', toSymbol: 'alpha', line: 3 }, // duplicate → deduped
    ],
  });
  const query = new CallerSignaturesQuery({
    store: {
      getRepoBasics: async () => (opts.basics === undefined ? BASICS : opts.basics),
      getFileRankFor: async () => opts.ranks ?? [],
    },
    codeIndex,
    parser: new AstGrepCodeParser(),
    clone: new MockCloneReader(CLONE),
    enabled: opts.enabled ?? true,
  });
  return { query, asked };
}

describe('CallerSignaturesQuery', () => {
  it('labels cross-file callers with their enclosing signature, ranked by file percentile', async () => {
    const { query, asked } = callersQuery({
      ranks: [
        { path: 'src/a.ts', percentile: 40 },
        { path: 'src/b.ts', percentile: 90 },
      ],
    });

    const rows = await query.getCallerSignatures('r1', ['src/util.ts']);

    // Only callable symbols are chased (the `type T` alias is skipped).
    expect(asked).toEqual(['alpha']);
    expect(rows).toEqual([
      { file: 'src/b.ts', symbol: 'useB', signature: expect.stringContaining('function useB'), rank: 90 },
      { file: 'src/a.ts', symbol: 'useA', signature: expect.stringContaining('function useA'), rank: 40 },
    ]);
  });

  it('keeps reference order with rank 0 when the repo has no file_rank, and honours limit', async () => {
    const { query } = callersQuery({});
    const all = await query.getCallerSignatures('r1', ['src/util.ts']);
    expect(all.map((r) => [r.file, r.rank])).toEqual([
      ['src/a.ts', 0],
      ['src/b.ts', 0],
    ]);
    const one = await query.getCallerSignatures('r1', ['src/util.ts'], 1);
    expect(one.map((r) => r.file)).toEqual(['src/a.ts']);
  });

  it('degrades to [] when disabled, unknown, or not cloned', async () => {
    expect(await callersQuery({ enabled: false }).query.getCallerSignatures('r1', ['src/util.ts'])).toEqual([]);
    expect(await callersQuery({ basics: null }).query.getCallerSignatures('r1', ['src/util.ts'])).toEqual([]);
    expect(
      await callersQuery({ basics: { ...BASICS, clonePath: null } }).query.getCallerSignatures('r1', ['src/util.ts']),
    ).toEqual([]);
  });
});

describe('UnresolvedReferencesQuery', () => {
  it('flags bare invocations that are neither declared, imported nor a known global', async () => {
    const query = new UnresolvedReferencesQuery({
      store: { getRepoBasics: async () => BASICS },
      parser: new AstGrepCodeParser(),
      clone: new MockCloneReader({
        'src/p.ts':
          "import { known } from './k';\nfunction local() {}\nknown();\nlocal();\nsetTimeout(local, 1);\nghost();\n",
      }),
      enabled: true,
    });

    expect(await query.getUnresolvedReferences('r1', ['src/p.ts', 'README.md'])).toEqual([
      { refFile: 'src/p.ts', refLine: 6, symbolName: 'ghost', declFile: null },
    ]);
  });
});

describe('repo-intel job handlers (composition root)', () => {
  it('registers INDEX / REFRESH / RESYNC and dispatches each to the indexer', async () => {
    const calls: string[] = [];
    const ok: IndexResult = { status: 'full', filesIndexed: 0, filesSkipped: 0, durationMs: 0 };
    const indexer: RepoIndexing = {
      indexRepo: async (id) => (calls.push(`index:${id}`), ok),
      refreshIndex: async (id) => (calls.push(`refresh:${id}`), ok),
      resyncRepo: async (id) => (calls.push(`resync:${id}`), ok),
    };
    const jobs = new MockJobQueue({ runJobs: true });
    registerRepoIntelJobHandlers(jobs, () => indexer);

    for (const kind of [INDEX_JOB_KIND, REFRESH_JOB_KIND, RESYNC_JOB_KIND]) {
      await (await jobs.enqueue('ws', kind, { repoId: 'r1' })).done;
    }
    expect(calls).toEqual(['index:r1', 'refresh:r1', 'resync:r1']);
  });

  it('buildApp registers them on the container job queue', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({ config });
    const handlers = (app.container.jobs as unknown as { handlers: Map<string, unknown> }).handlers;
    expect([INDEX_JOB_KIND, REFRESH_JOB_KIND, RESYNC_JOB_KIND].every((k) => handlers.has(k))).toBe(true);
    await app.close();
  });

  it('the container keeps a real indexer when the facade is overridden', () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const fake = {} as RepoIntel;
    const container = new Container(config, {} as Db, {
      repoIntel: fake,
      git: new MockGitClient({}),
      secrets: new MockSecretsProvider(),
    });
    expect(container.repoIntel).toBe(fake);
    expect(container.repoIndexer).toBeInstanceOf(RepoIndexer);
  });
});
