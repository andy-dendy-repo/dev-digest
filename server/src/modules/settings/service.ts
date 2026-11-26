import type {
  ConnTestProvider,
  ConnTestResult,
  SecretKey,
  SecretsStatus,
  Settings,
  SettingsUpdate,
} from '@devdigest/shared';
import { GITHUB_PROVIDER, SECRET_KEY_BY_PROVIDER } from './constants.js';
import { rowsToSettings } from './helpers.js';
import type { SettingsServiceDeps } from './ports.js';

/**
 * F1 — settings use cases: non-secret workspace prefs, which provider keys are
 * configured (booleans only), and "Test connection" for a provider key.
 *
 * Secrets never land in the `settings` table: keys go to the SecretsProvider,
 * and only after a live check passes (S11).
 */
export class SettingsService {
  constructor(private deps: SettingsServiceDeps) {}

  async get(workspaceId: string): Promise<Settings> {
    return rowsToSettings(await this.deps.settings.list(workspaceId));
  }

  /** Upsert every key in `patch` for this user, then return the workspace's prefs. */
  async update(workspaceId: string, userId: string, patch: SettingsUpdate): Promise<Settings> {
    const entries = Object.entries(patch).map(([key, value]) => ({ key, value }));
    if (entries.length > 0) await this.deps.settings.upsertMany(workspaceId, userId, entries);
    return this.get(workspaceId);
  }

  /** Which provider keys are configured — booleans only, the values are NEVER returned. */
  async secretsStatus(): Promise<SecretsStatus> {
    const entries = await Promise.all(
      (Object.entries(SECRET_KEY_BY_PROVIDER) as [keyof SecretsStatus, SecretKey][]).map(
        async ([provider, key]) => [provider, Boolean(await this.deps.secrets.get(key))] as const,
      ),
    );
    return Object.fromEntries(entries) as SecretsStatus;
  }

  /**
   * S11 (security hardening): a candidate key is verified with a throwaway
   * client FIRST and persisted only if the check passes — a typo must never
   * overwrite the working key. Provider errors can echo the key back, so it is
   * redacted from every message. Without a key, the stored one is tested.
   */
  async testConnection(provider: ConnTestProvider, key?: string): Promise<ConnTestResult> {
    const { secrets, tester } = this.deps;
    if (key && !secrets.set) {
      return { provider, ok: false, message: 'Secrets backend is read-only' };
    }
    let message: string;
    try {
      if (provider === GITHUB_PROVIDER) {
        message = `Connected as @${await tester.github(key)}`;
      } else {
        message = `OK — ${await tester.llm(provider, key)} models available`;
      }
    } catch (err) {
      const raw = (err as Error).message;
      const safe = key ? raw.split(key).join('[redacted]') : raw;
      return { provider, ok: false, message: key ? `${safe} — key not saved` : safe };
    }
    if (key) {
      try {
        await secrets.set!(SECRET_KEY_BY_PROVIDER[provider], key);
        this.deps.onSecretsChanged();
      } catch (err) {
        return {
          provider,
          ok: false,
          message: `Key verified but could not be saved: ${(err as Error).message}`,
        };
      }
    }
    return { provider, ok: true, message };
  }
}
