/* useConfirmEnable — the vetting gate in the UI: enabling a skill imported from
   someone else asks for an explicit confirmation first. */
"use client";

import { useTranslations } from "next-intl";
import type { Skill } from "@devdigest/shared";
import { isUntrustedSource } from "@/lib/skills";

/** Returns `confirm(skill, next)` → true when the change may proceed. */
export function useConfirmEnable() {
  const t = useTranslations("skills");
  return (skill: Pick<Skill, "name" | "source">, next: boolean): boolean => {
    if (!next || !isUntrustedSource(skill.source)) return true;
    return window.confirm(t("trust.confirmEnable", { name: skill.name }));
  };
}
