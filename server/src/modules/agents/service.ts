import type {
  Agent,
  AgentSkillLink,
  AgentSkillView,
  AgentVersion,
  ModelInfo,
  Provider,
  SetAgentSkillsRequest,
} from '@devdigest/shared';
import { ValidationError } from '../../platform/errors.js';
import type { CreateAgentInput, UpdateAgentInput } from './domain.js';
import type { AgentsServiceDeps } from './ports.js';

/**
 * A2 — agents service. Business logic for the Agents tab + Agent Editor.
 * Provider/model selection uses the LLM adapter's dynamic model list.
 *
 * An Agent = provider + model + system_prompt + linked skills + output_schema +
 * enabled. Config changes are versioned via `agent_versions` (AgentsPort).
 */

export type { CreateAgentInput, UpdateAgentInput } from './domain.js';

export class AgentsService {
  constructor(private deps: AgentsServiceDeps) {}

  private get repo() {
    return this.deps.agents;
  }

  async list(workspaceId: string): Promise<Agent[]> {
    return this.repo.list(workspaceId);
  }

  async get(workspaceId: string, id: string): Promise<Agent | undefined> {
    return this.repo.getById(workspaceId, id);
  }

  /** Delete an agent (and its versions/skill-links, via cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async create(workspaceId: string, input: CreateAgentInput, userId?: string): Promise<Agent> {
    return this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      provider: input.provider,
      model: input.model,
      systemPrompt: input.system_prompt,
      outputSchema: input.output_schema,
      ...(input.strategy !== undefined ? { strategy: input.strategy } : {}),
      ...(input.ci_fail_on !== undefined ? { ciFailOn: input.ci_fail_on } : {}),
      ...(input.repo_intel !== undefined ? { repoIntel: input.repo_intel } : {}),
      enabled: input.enabled,
      createdBy: userId ?? null,
    });
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateAgentInput,
  ): Promise<Agent | undefined> {
    return this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.system_prompt !== undefined ? { systemPrompt: patch.system_prompt } : {}),
      ...(patch.output_schema !== undefined ? { outputSchema: patch.output_schema } : {}),
      ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
      ...(patch.ci_fail_on !== undefined ? { ciFailOn: patch.ci_fail_on } : {}),
      ...(patch.repo_intel !== undefined ? { repoIntel: patch.repo_intel } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
  }

  /**
   * Config history for an agent, newest version first. Workspace-scoped: returns
   * undefined when the agent isn't in this workspace (the route maps that to 404)
   * so version snapshots can't be read across tenants.
   */
  async listVersions(workspaceId: string, agentId: string): Promise<AgentVersion[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    return this.repo.listVersions(agentId);
  }

  /**
   * A single config snapshot for an agent. Returns undefined when the agent isn't
   * in this workspace OR that version was never recorded (route → 404).
   */
  async getVersion(
    workspaceId: string,
    agentId: string,
    version: number,
  ): Promise<AgentVersion | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    return this.repo.getVersion(agentId, version);
  }

  /** Linked skills for an agent as AgentSkillLink[] (ordered). */
  async skillLinks(agentId: string): Promise<AgentSkillLink[]> {
    return this.repo.skillLinks(agentId);
  }

  /**
   * Set / reorder the agent's linked skills. If `skillIds` is provided, replaces
   * the whole set in that order. Returns the resulting ordered links.
   */
  async setSkills(
    workspaceId: string,
    agentId: string,
    skillIds: string[],
  ): Promise<AgentSkillLink[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    await this.repo.setSkills(agentId, skillIds);
    return this.skillLinks(agentId);
  }

  /** The agent's linked skills for the Skills tab; undefined when the agent isn't here. */
  async skillViews(workspaceId: string, agentId: string): Promise<AgentSkillView[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    return this.repo.skillViews(agentId);
  }

  /**
   * Replace the agent's ordered skill list (Skills tab: attach, on/off, reorder).
   * Every skill must belong to the agent's workspace — the FK alone would accept
   * another tenant's skill. Records a new agent version.
   */
  async replaceSkills(
    workspaceId: string,
    agentId: string,
    body: SetAgentSkillsRequest,
  ): Promise<AgentSkillView[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    const ids = body.skills.map((s) => s.skill_id);
    const foreign = await this.repo.foreignSkillIds(workspaceId, ids);
    if (foreign.length > 0) throw new ValidationError('Unknown skill', { skill_ids: foreign });
    await this.repo.replaceSkillLinks(
      workspaceId,
      agentId,
      body.skills.map((s) => ({ skillId: s.skill_id, enabled: s.enabled })),
    );
    return this.repo.skillViews(agentId);
  }

  /** Link a single skill (append or set order) — additive to existing links. */
  async linkSkill(
    workspaceId: string,
    agentId: string,
    skillId: string,
    order?: number,
  ): Promise<AgentSkillLink[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    const existing = await this.repo.skillLinks(agentId);
    const resolvedOrder = order ?? existing.length;
    await this.repo.linkSkill(agentId, skillId, resolvedOrder);
    return this.skillLinks(agentId);
  }

  /**
   * Dynamic model list from the provider adapter's /models. Degrades gracefully
   * to [] if the provider key is not configured (the editor still renders).
   */
  async listModels(provider: Provider): Promise<ModelInfo[]> {
    try {
      const llm = await this.deps.llm(provider);
      return await llm.listModels();
    } catch {
      return [];
    }
  }
}
