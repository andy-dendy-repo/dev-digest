/* SkillEditor — header (name, type, version, tokens, global enabled switch) +
   Config / Preview tabs over one draft, so switching tabs keeps unsaved edits
   and Preview shows them. The parent remounts it per skill version. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Tabs, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/skills/SkillTypeBadge";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { useConfirmEnable } from "@/app/skills/_components/SkillCard";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { TABS } from "./constants";
import { draftOf, type SkillDraft } from "./helpers";
import { s } from "./styles";

export function SkillEditor({ skill, tab, onTab }: { skill: Skill; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("skills");
  const update = useUpdateSkill();
  const confirmEnable = useConfirmEnable();
  const [draft, setDraft] = React.useState<SkillDraft>(() => draftOf(skill));
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  return (
    <div>
      <div style={s.header}>
        <Icon.Sparkles size={18} style={s.icon} />
        <h1 className="mono" style={s.name}>
          {skill.name}
        </h1>
        <SkillTypeBadge type={skill.type} />
        <Badge color="var(--text-secondary)" mono>
          {t("detail.version", { version: skill.version })}
        </Badge>
        {skill.token_count != null && (
          <Badge color="var(--text-muted)">{t("detail.tokens", { count: skill.token_count })}</Badge>
        )}
        <label style={s.enabled}>
          {t("config.enabled")}
          <Toggle
            on={skill.enabled}
            onChange={(enabled) => {
              if (confirmEnable(skill, enabled)) update.mutate({ id: skill.id, patch: { enabled } });
            }}
            size={16}
          />
        </label>
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {tab === "preview" ? (
          <PreviewTab body={draft.body} />
        ) : (
          <ConfigTab skill={skill} draft={draft} onChange={setDraft} />
        )}
      </div>
    </div>
  );
}
