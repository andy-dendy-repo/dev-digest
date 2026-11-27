"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, Dropdown } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useUpdateAgent } from "@/lib/hooks/agents";
import { AgentCard } from "@/app/agents/_components/AgentCard";
import { s } from "./styles";

/** Left column: every agent (the active one highlighted) + "Add". */
export function AgentSidebar({ agents, activeId, tab }: { agents: Agent[]; activeId: string; tab: string }) {
  const t = useTranslations("agents");
  const router = useRouter();
  const update = useUpdateAgent();

  return (
    <div style={s.sidebar}>
      <div style={s.sidebarHeader}>
        <div style={s.sidebarTitleRow}>
          <h1 style={s.sidebarTitle}>{t("editor.listTitle")}</h1>
          <Dropdown
            width={210}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus">
                {t("editor.add")}
              </Button>
            }
            items={[{ label: t("editor.createFromScratch"), icon: "Edit", onClick: () => router.push("/agents") }]}
          />
        </div>
      </div>
      <div style={s.sidebarList}>
        {agents.map((a) => (
          <AgentCard
            key={a.id}
            ag={a}
            skillCount={a.skill_count}
            active={a.id === activeId}
            onClick={() => router.push(`/agents/${a.id}?tab=${tab}`)}
            onToggle={(enabled) => update.mutate({ id: a.id, patch: { enabled } })}
          />
        ))}
      </div>
    </div>
  );
}
