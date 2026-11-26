import { describe, it, expect, vi } from 'vitest';
import type { SecretsProvider } from '@devdigest/shared';
import { SettingsService } from '../src/modules/settings/service.js';
import type { ConnectionTester, SettingsPort } from '../src/modules/settings/ports.js';
import type { SettingsRow } from '../src/modules/settings/helpers.js';
import { WorkspaceService } from '../src/modules/workspace/service.js';
import type { RepoRecord } from '../src/modules/repos/ports.js';

/** Hermetic use-case tests: SettingsService / WorkspaceService over in-memory fakes. */

class FakeSettings implements SettingsPort {
  rows: (SettingsRow & { workspaceId: string; userId: string })[] = [];
  upserts = 0;
  async list(workspaceId: string) {
    return this.rows.filter((r) => r.workspaceId === workspaceId).map(({ key, value }) => ({ key, value }));
  }
  async upsertMany(workspaceId: string, userId: string, entries: SettingsRow[]) {
    this.upserts += 1;
    for (const e of entries) {
      const hit = this.rows.find((r) => r.workspaceId === workspaceId && r.userId === userId && r.key === e.key);
      if (hit) hit.value = e.value;
      else this.rows.push({ workspaceId, userId, ...e });
    }
  }
}

function secretsStore(initial: Record<string, string> = {}, opts: { readOnly?: boolean } = {}) {
  const store = new Map(Object.entries(initial));
  const secrets: SecretsProvider = {
    get: async (k) => store.get(k),
    ...(opts.readOnly ? {} : { set: vi.fn(async (k: string, v: string) => void store.set(k, v)) }),
  };
  return { store, secrets };
}

function makeService(tester: Partial<ConnectionTester>, secrets = secretsStore().secrets) {
  const settings = new FakeSettings();
  const onSecretsChanged = vi.fn();
  const service = new SettingsService({
    settings,
    secrets,
    tester: {
      github: tester.github ?? (async () => 'octocat'),
      llm: tester.llm ?? (async () => 3),
    },
    onSecretsChanged,
  });
  return { service, settings, onSecretsChanged };
}

describe('SettingsService prefs', () => {
  it('update upserts once and returns the merged prefs; an empty patch writes nothing', async () => {
    const { service, settings } = makeService({});
    expect(await service.update('ws', 'u', { theme: 'light' })).toEqual({ theme: 'light' });
    expect(await service.update('ws', 'u', {})).toEqual({ theme: 'light' });
    expect(settings.upserts).toBe(1);
  });

  it('secretsStatus reports booleans only', async () => {
    const { secrets } = secretsStore({ GITHUB_TOKEN: 'ghp_secret' });
    const { service } = makeService({}, secrets);
    expect(await service.secretsStatus()).toEqual({
      openai: false,
      anthropic: false,
      openrouter: false,
      github: true,
    });
  });
});

describe('SettingsService.testConnection (S11)', () => {
  it('a failed check redacts the candidate key and never saves it', async () => {
    const { store, secrets } = secretsStore({ OPENAI_API_KEY: 'sk-working' });
    const { service, onSecretsChanged } = makeService(
      { llm: async () => Promise.reject(new Error('401 bad key sk-typo')) },
      secrets,
    );
    const res = await service.testConnection('openai', 'sk-typo');
    expect(res).toEqual({ provider: 'openai', ok: false, message: '401 bad key [redacted] — key not saved' });
    expect(store.get('OPENAI_API_KEY')).toBe('sk-working');
    expect(onSecretsChanged).not.toHaveBeenCalled();
  });

  it('a passing check saves the key and drops cached clients', async () => {
    const { store, secrets } = secretsStore();
    const { service, onSecretsChanged } = makeService({ github: async () => 'octocat' }, secrets);
    const res = await service.testConnection('github', 'ghp_new');
    expect(res).toEqual({ provider: 'github', ok: true, message: 'Connected as @octocat' });
    expect(store.get('GITHUB_TOKEN')).toBe('ghp_new');
    expect(onSecretsChanged).toHaveBeenCalledOnce();
  });

  it('without a key the stored secret is tested and nothing is written', async () => {
    const { secrets } = secretsStore();
    const llm = vi.fn(async () => 7);
    const { service } = makeService({ llm }, secrets);
    expect(await service.testConnection('openrouter')).toEqual({
      provider: 'openrouter',
      ok: true,
      message: 'OK — 7 models available',
    });
    expect(llm).toHaveBeenCalledWith('openrouter', undefined);
    expect(secrets.set).not.toHaveBeenCalled();
  });

  it('a read-only secrets backend refuses a candidate key before testing it', async () => {
    const { secrets } = secretsStore({}, { readOnly: true });
    const llm = vi.fn(async () => 1);
    const { service } = makeService({ llm }, secrets);
    expect(await service.testConnection('openai', 'sk-x')).toEqual({
      provider: 'openai',
      ok: false,
      message: 'Secrets backend is read-only',
    });
    expect(llm).not.toHaveBeenCalled();
  });
});

describe('WorkspaceService.summary', () => {
  it('summarises the workspace repos and the clone dir', async () => {
    const repo: RepoRecord = {
      id: 'r1',
      workspaceId: 'ws',
      owner: 'acme',
      name: 'api',
      fullName: 'acme/api',
      defaultBranch: 'main',
      clonePath: null,
      lastPolledAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date(),
    };
    const service = new WorkspaceService({ repos: { list: async () => [repo] }, cloneDir: '/clones' });
    expect(await service.summary('ws')).toEqual({
      workspaceId: 'ws',
      cloneDir: '/clones',
      repos: [
        { id: 'r1', full_name: 'acme/api', clone_path: null, last_polled_at: '2026-01-01T00:00:00.000Z', cloned: false },
      ],
    });
  });
});
