"use client";

import React from "react";
import { Icon, Badge } from "@devdigest/ui";
import { s } from "./styles";

/** Warns that the PR has lethal-trifecta findings (renders nothing for 0). */
export function LethalTrifectaBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div style={s.lethalTrifecta}>
      <Icon.Shield size={16} style={s.critIcon} />
      <span style={s.lethalTrifectaTitle}>Lethal Trifecta detected</span>
      <Badge color="var(--crit)" bg="transparent">
        {count} finding(s)
      </Badge>
    </div>
  );
}
