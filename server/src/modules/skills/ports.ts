import type { Skill, SkillSource, SkillType } from '@devdigest/shared';

/**
 * Ports of the skills module (Application ring). Domain types only: the Drizzle
 * implementation (`repository.ts`) maps rows to `Skill`.
 */

/** Values for a new skill (version 1 is snapshotted with it). */
export interface NewSkill {
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled: boolean;
}

/** A partial update; a body change bumps the version and snapshots it. */
export interface SkillPatch {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/** Skills of a workspace and their immutable body versions. */
export interface SkillsPort {
  /** All skills of the workspace (with `agent_count`), by name. */
  list(workspaceId: string): Promise<Skill[]>;
  getById(workspaceId: string, id: string): Promise<Skill | undefined>;
  /** True when another skill of the workspace already uses `name`. */
  nameTaken(workspaceId: string, name: string, exceptId?: string): Promise<boolean>;
  insert(values: NewSkill): Promise<Skill>;
  update(workspaceId: string, id: string, patch: SkillPatch): Promise<Skill | undefined>;
  /** False when no such skill exists in the workspace. Agent links cascade. */
  deleteById(workspaceId: string, id: string): Promise<boolean>;
  /**
   * Skills that take part in this agent's runs, in the agent's order: linked,
   * enabled for the agent AND enabled globally.
   */
  effectiveForAgent(agentId: string): Promise<Skill[]>;
}

export interface SkillsServiceDeps {
  skills: SkillsPort;
  /** Token counter (cl100k) for `Skill.token_count`. */
  countTokens: (text: string) => number;
}
