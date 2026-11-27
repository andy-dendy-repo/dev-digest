/* /skills/:id — Skill editor. Left skill list + Config / Preview tabs. Tab state
   lives in ?tab=. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useSkill, useSkills } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { SkillEditor } from "../SkillEditor";
import { SkillSidebar } from "./SkillSidebar";
import { resolveTab } from "./helpers";
import { s } from "./styles";

export function SkillDetailView({ id }: { id: string }) {
  const t = useTranslations("skills");
  const search = useSearchParams();
  const router = useRouter();
  const { data: skills } = useSkills();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);

  const tab = resolveTab(search.get("tab"));
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${id}?${sp.toString()}`);
  };

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    { label: skill?.name ?? t("detail.crumbFallback") },
  ];

  if (isError || (!isLoading && !skill)) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("detail.loadErrorTitle")}
          body={error instanceof ApiError ? error.message : t("detail.loadErrorBody")}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.layout}>
        <SkillSidebar skills={skills ?? []} activeId={id} tab={tab} />
        {isLoading || !skill ? (
          <div style={s.loading}>
            <Skeleton height={24} width={240} />
            <Skeleton height={200} />
          </div>
        ) : (
          <div style={s.pane}>
            <div style={s.paneBody}>
              {/* Remount per skill AND per saved version, so the draft restarts from the saved values. */}
              <SkillEditor key={`${skill.id}:${skill.version}`} skill={skill} tab={tab} onTab={setTab} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
