"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { SkillCard, useConfirmEnable } from "@/app/skills/_components/SkillCard";
import { AddSkillMenu } from "@/app/skills/_components/AddSkillMenu";
import { s } from "./styles";

/** Left column: every skill (the active one highlighted) + "Add". */
export function SkillSidebar({ skills, activeId, tab }: { skills: Skill[]; activeId: string; tab: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const update = useUpdateSkill();
  const confirmEnable = useConfirmEnable();

  return (
    <div style={s.sidebar}>
      <div style={s.sidebarHeader}>
        <h2 style={s.sidebarTitle}>{t("detail.listTitle")}</h2>
        <AddSkillMenu label={t("detail.add")} compact />
      </div>
      <div style={s.sidebarList}>
        {skills.map((sk) => (
          <SkillCard
            key={sk.id}
            skill={sk}
            active={sk.id === activeId}
            onOpen={() => router.push(`/skills/${sk.id}?tab=${tab}`)}
            onToggle={(enabled) => {
              if (confirmEnable(sk, enabled)) update.mutate({ id: sk.id, patch: { enabled } });
            }}
          />
        ))}
      </div>
    </div>
  );
}
