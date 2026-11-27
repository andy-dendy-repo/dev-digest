/* SkillCard — one skill in the Skills grid / sidebar: name, type, source,
   description, usage, the global enabled toggle and delete. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/skills/SkillTypeBadge";
import { useDeleteSkill } from "@/lib/hooks/skills";
import { needsVetting } from "@/lib/skills";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onOpen,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onOpen?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const del = useDeleteSkill();
  const agentCount = skill.agent_count ?? 0;

  return (
    <div style={s.card(!!active, skill.enabled)} data-testid="skill-card">
      <div style={s.headerRow}>
        {/* Sibling buttons (open / toggle / delete), never nested in one another. */}
        <button type="button" onClick={onOpen} style={s.open}>
          <span style={s.iconBox}>
            <Icon.Sparkles size={14} />
          </span>
          <span className="mono" style={s.name}>
            {skill.name}
          </span>
        </button>
        {onToggle && (
          // Toggle has no accessible name of its own: the label gives the switch one.
          <label style={s.toggleLabel}>
            <span style={s.srOnly}>{t("card.toggleEnabled", { name: skill.name })}</span>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t("card.confirmDelete", { name: skill.name, count: agentCount }))) del.mutate(skill.id);
          }}
          disabled={del.isPending}
          title={t("card.delete")}
          aria-label={t("card.delete")}
          style={s.deleteBtn(del.isPending)}
        >
          <Icon.Trash size={14} />
        </button>
      </div>
      <div style={s.description}>{skill.description || t("card.noDescription")}</div>
      <div style={s.metaRow}>
        <SkillTypeBadge type={skill.type} />
        <span style={s.source}>{t(`source.${skill.source}`)}</span>
        {needsVetting(skill) && (
          <span title={t("card.vettingTitle")}>
            <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">
              {t("card.needsVetting")}
            </Badge>
          </span>
        )}
        <span style={s.stats}>
          {t("card.agents", { count: agentCount })}
          {skill.token_count != null && ` · ${t("detail.tokens", { count: skill.token_count })}`}
        </span>
      </div>
    </div>
  );
}
