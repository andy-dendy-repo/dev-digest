import type { Skill, SkillSource, SkillType } from '@devdigest/shared';
import { formatSkillBlock } from '../../platform/prompt.js';

/**
 * Pure helpers for the skills module — stored-skill → DTO mapping and the
 * trust rule for imported sources. No I/O.
 */

/** A skill as stored (camelCase columns of `skills`). */
export interface StoredSkill {
  id: string;
  name: string;
  description: string;
  type: string;
  source: string;
  body: string;
  enabled: boolean;
  version: number;
  evidenceFiles: string[] | null;
  createdAt: Date;
}

export function toSkillDto(row: StoredSkill, agentCount?: number): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    created_at: row.createdAt.toISOString(),
    ...(agentCount !== undefined ? { agent_count: agentCount } : {}),
  };
}

/**
 * Sources whose text came from someone else. Such a skill is someone else's
 * instructions in the agent's prompt, so it is stored disabled until a user
 * vets and enables it.
 */
const UNTRUSTED_SOURCES: ReadonlySet<SkillSource> = new Set([
  'imported_file',
  'imported_url',
  'community',
]);

export function isUntrustedSource(source: SkillSource): boolean {
  return UNTRUSTED_SOURCES.has(source);
}

/** Add `token_count` = tokens of the block the skill renders into a prompt. */
export function withTokenCount(skill: Skill, countTokens: (text: string) => number): Skill {
  return { ...skill, token_count: countTokens(formatSkillBlock(skill)) };
}
