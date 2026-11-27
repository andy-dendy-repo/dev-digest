/* skills.ts — domain rules for skills shared by the Skills pages and the agent
   Skills tab: the vetting gate for imported text and a cheap token estimate. */
import type { Skill, SkillSource, SkillType } from "@devdigest/shared";

/** Skill types in the order pickers list them. */
export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Sources whose text came from someone else (mirrors the server's rule). */
const UNTRUSTED_SOURCES: ReadonlySet<SkillSource> = new Set(["imported_file", "imported_url", "community"]);

export function isUntrustedSource(source: SkillSource): boolean {
  return UNTRUSTED_SOURCES.has(source);
}

/** An imported skill nobody has enabled yet: show "needs vetting", confirm on enable. */
export function needsVetting(skill: Pick<Skill, "source" | "enabled">): boolean {
  return isUntrustedSource(skill.source) && !skill.enabled;
}

/**
 * Rough token count for live feedback while typing (≈4 chars per token). The
 * server's exact count (cl100k) comes back as `token_count` after a save.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
