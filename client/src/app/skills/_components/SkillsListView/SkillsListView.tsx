/* /skills — Skills grid (M2): cards with the global enabled toggle, search and
   Add (create / import). Opening a card goes to the editor at /skills/:id. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { SkillCard, useConfirmEnable } from "../SkillCard";
import { AddSkillMenu } from "../AddSkillMenu";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsListView() {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const confirmEnable = useConfirmEnable();
  const [search, setSearch] = React.useState("");

  const all = skills ?? [];
  const list = filterSkills(all, search);

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>{t("page.heading")}</h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          <div style={s.search}>
            <Icon.Search size={13} style={s.searchIcon} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("page.searchPlaceholder")}
              aria-label={t("page.searchPlaceholder")}
              style={s.searchInput}
            />
          </div>
          <AddSkillMenu label={t("page.addSkill")} />
        </div>

        {isLoading && (
          <div style={s.grid}>
            <Skeleton height={120} />
            <Skeleton height={120} />
            <Skeleton height={120} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && all.length === 0 && (
          <EmptyState icon="Sparkles" title={t("page.empty.title")} body={t("page.empty.body")} />
        )}
        {all.length > 0 && list.length === 0 && (
          <EmptyState icon="Search" title={t("page.noMatch.title")} body={t("page.noMatch.body")} />
        )}
        {list.length > 0 && (
          <div style={s.grid}>
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                onOpen={() => router.push(`/skills/${sk.id}?tab=config`)}
                onToggle={(enabled) => {
                  if (confirmEnable(sk, enabled)) update.mutate({ id: sk.id, patch: { enabled } });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
