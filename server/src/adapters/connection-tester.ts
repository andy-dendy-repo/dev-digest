import type { GitHubClient, LLMProvider } from '@devdigest/shared';
import type { ConnectionTester, LlmConnTestProvider } from '../modules/settings/ports.js';

/**
 * `ConnectionTester` over the GitHub / LLM adapters. The container passes the
 * factories: with a candidate key they build a throwaway, uncached client
 * (S11 — the key is checked before anything persists it); without one they
 * resolve the client from the stored secret.
 */
export class LiveConnectionTester implements ConnectionTester {
  constructor(
    private readonly clients: {
      github: (token?: string) => Promise<GitHubClient>;
      llm: (provider: LlmConnTestProvider, key?: string) => Promise<LLMProvider>;
    },
  ) {}

  async github(token?: string): Promise<string> {
    const gh = await this.clients.github(token);
    return gh.currentLogin();
  }

  async llm(provider: LlmConnTestProvider, key?: string): Promise<number> {
    const llm = await this.clients.llm(provider, key);
    const models = await llm.listModels();
    return models.length;
  }
}
