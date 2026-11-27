/* SkillTypeBadge — the coloured type chip of a skill (Skills pages + agent Skills tab). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPE_COLORS } from "./constants";

export function SkillTypeBadge({ type }: { type: SkillType }) {
  const t = useTranslations("skills");
  const { c, bg } = SKILL_TYPE_COLORS[type];
  return (
    <Badge color={c} bg={bg}>
      {t(`type.${type}`)}
    </Badge>
  );
}
