import type { ConnTestProvider, SecretsProvider } from '@devdigest/shared';
import type { SettingsRow } from './helpers.js';

/**
 * Ports of the settings module (Application ring).
 */

/** Non-secret workspace prefs (`settings` key/value rows). */
export interface SettingsPort {
  /** Every pref row of the workspace. */
  list(workspaceId: string): Promise<SettingsRow[]>;
  /** Insert or overwrite each key for (workspace, user) in one statement. */
  upsertMany(workspaceId: string, userId: string, entries: SettingsRow[]): Promise<void>;
}

/** Read-only view of prefs (what feature-model resolution needs). */
export type SettingsReader = Pick<SettingsPort, 'list'>;

/** LLM providers a connection test can target (everything but GitHub). */
export type LlmConnTestProvider = Exclude<ConnTestProvider, 'github'>;

/**
 * A cheap live call that proves a credential works. Without a candidate key
 * the stored secret is used; with one, a throwaway client is built from it —
 * never read from or written to the secrets store, never cached (S11).
 * Throws the provider's error when the check fails.
 */
export interface ConnectionTester {
  /** GET /user → the login the token belongs to. */
  github(token?: string): Promise<string>;
  /** List the provider's models → how many are available. */
  llm(provider: LlmConnTestProvider, key?: string): Promise<number>;
}

export interface SettingsServiceDeps {
  settings: SettingsPort;
  secrets: SecretsProvider;
  tester: ConnectionTester;
  /** Drop cached provider clients after a key was saved. */
  onSecretsChanged: () => void;
}
