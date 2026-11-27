"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge } from "@devdigest/ui";
import { s } from "./styles";

/** Warns that the PR has lethal-trifecta findings (renders nothing for 0). */
export function LethalTrifectaBanner({ count }: { count: number }) {
  const t = useTranslations("prReview");
  if (count === 0) return null;
  return (
    <div style={s.lethalTrifecta}>
      <Icon.Shield size={16} style={s.critIcon} />
      <span style={s.lethalTrifectaTitle}>{t("trifecta.detected")}</span>
      <Badge color="var(--crit)" bg="transparent">
        {t("trifecta.count", { count })}
      </Badge>
    </div>
  );
}
