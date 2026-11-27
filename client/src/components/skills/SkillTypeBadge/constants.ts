import type { SkillType } from "@devdigest/shared";

/** Colour tokens per skill type (CSS variables from the UI kit). */
export const SKILL_TYPE_COLORS: Record<SkillType, { c: string; bg: string }> = {
  rubric: { c: "var(--accent)", bg: "var(--accent-bg)" },
  convention: { c: "var(--ok)", bg: "var(--ok-bg)" },
  security: { c: "var(--crit)", bg: "var(--crit-bg)" },
  custom: { c: "var(--text-secondary)", bg: "var(--bg-hover)" },
};
