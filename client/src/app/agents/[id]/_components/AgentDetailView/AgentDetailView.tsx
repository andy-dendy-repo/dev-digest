/* /agents/:id — Agent Editor. Left agent list + Config editor (model + system
   prompt). Tab state lives in ?tab=. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useAgent, useAgents } from "@/lib/hooks/agents";
import { ApiError } from "@/lib/api";
import { AgentEditor } from "../AgentEditor";
import { AgentSidebar } from "./AgentSidebar";
import { resolveTab } from "./helpers";
import { s } from "./styles";

export function AgentDetailView({ id }: { id: string }) {
  const search = useSearchParams();
  const router = useRouter();
  const { data: agents } = useAgents();
  const { data: agent, isLoading, isError, error, refetch } = useAgent(id);

  const tab = resolveTab(search.get("tab"));
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/agents/${id}?${sp.toString()}`);
  };

  const crumb = [
    { label: "Skills Lab" },
    { label: "Agents", href: "/agents" },
    { label: agent?.name ?? "Agent" },
  ];

  if (isError || (!isLoading && !agent)) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title="Couldn’t load this agent"
          body={error instanceof ApiError ? error.message : "The agent could not be loaded."}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.layout}>
        <AgentSidebar agents={agents ?? []} activeId={id} tab={tab} />

        {isLoading || !agent ? (
          <div style={s.loading}>
            <Skeleton height={24} width={240} />
            <Skeleton height={200} />
          </div>
        ) : (
          <div style={s.pane}>
            <div style={s.paneHeader}>
              <Icon.Cpu size={18} style={s.agentIcon} />
              <h1 style={s.agentName}>{agent.name}</h1>
              <Badge color="var(--text-secondary)" mono>
                {agent.provider}/{agent.model}
              </Badge>
              {!agent.enabled && <Badge color="var(--text-muted)">disabled</Badge>}
              <div style={s.paneActions}>
                <Button kind="secondary" size="sm" icon="GitPullRequest" onClick={() => router.push("/")}>
                  Run on a PR…
                </Button>
              </div>
            </div>
            <div style={s.paneBody}>
              <AgentEditor agent={agent} tab={tab} onTab={setTab} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
