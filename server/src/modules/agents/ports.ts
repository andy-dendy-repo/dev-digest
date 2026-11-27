import type {
  Agent,
  AgentSkillLink,
  AgentVersion,
  CiFailOn,
  LLMProvider,
  Provider,
  ReviewStrategy,
} from '@devdigest/shared';

/**
 * Ports of the agents module (Application ring). Domain types only: the
 * Drizzle implementation (`repository.ts`) maps rows to `Agent` /
 * `AgentVersion` / `AgentSkillLink`.
 */

/** Values for a new agent (version 1 is snapshotted with it). */
export interface NewAgent {
  workspaceId: string;
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
  enabled?: boolean;
  createdBy?: string | null;
}

/** A partial update; any config change (all but `enabled`) bumps the version. */
export interface AgentPatch {
  name?: string;
  description?: string;
  provider?: Provider;
  model?: string;
  systemPrompt?: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
  enabled?: boolean;
}

/** Agents, their immutable config versions and their linked skills. Workspace-scoped. */
export interface AgentsPort {
  list(workspaceId: string): Promise<Agent[]>;
  listEnabled(workspaceId: string): Promise<Agent[]>;
  getById(workspaceId: string, id: string): Promise<Agent | undefined>;
  /** False when no such agent exists in the workspace. */
  deleteById(workspaceId: string, id: string): Promise<boolean>;
  insert(values: NewAgent): Promise<Agent>;
  update(workspaceId: string, id: string, patch: AgentPatch): Promise<Agent | undefined>;
  /** Config snapshots, newest version first. */
  listVersions(agentId: string): Promise<AgentVersion[]>;
  getVersion(agentId: string, version: number): Promise<AgentVersion | undefined>;
  /** Linked skills in `order` ascending. */
  skillLinks(agentId: string): Promise<AgentSkillLink[]>;
  /** Link one skill at `order` (idempotent: upserts the order). */
  linkSkill(agentId: string, skillId: string, order: number): Promise<void>;
  /** Replace the whole ordered set of linked skills (order = index). */
  setSkills(agentId: string, skillIds: string[]): Promise<void>;
}

export interface AgentsServiceDeps {
  agents: AgentsPort;
  /** Lazy provider factory; throws when the provider's key is not configured. */
  llm: (id: Provider) => Promise<LLMProvider>;
}
