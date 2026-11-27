/* SkillsTab — attach workspace skills to this agent, enable/disable them for it
   and set their order (= order of the blocks in the prompt). Every change is
   applied at once and saved through PUT /agents/:id/skills (in click order). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge, Checkbox, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/skills/SkillTypeBadge";
import { useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/skills";
import { buildRows, effectiveCount, matchesFilter, moveRow, toggleRow, toLinks, type SkillRow } from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const router = useRouter();
  const links = useAgentSkills(agent.id);
  const skills = useSkills();
  const setSkills = useSetAgentSkills(agent.id);
  const [filter, setFilter] = React.useState("");
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);

  if (links.isLoading || skills.isLoading) return <Skeleton height={240} />;
  if (links.isError || skills.isError) {
    return <ErrorState body={t("skills.loadError")} onRetry={() => void (links.refetch(), skills.refetch())} />;
  }

  const rows = buildRows(links.data ?? [], skills.data ?? []);
  const save = (next: SkillRow[]) => setSkills.save(toLinks(next, agent.id));
  const filtering = filter.trim().length > 0;
  // Reordering a filtered subset would be ambiguous, so drag/keys work on the full list only.
  const canMove = !filtering;
  const move = (from: number, to: number) => {
    if (canMove) save(moveRow(rows, from, to));
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="Sparkles"
        title={t("skills.empty.title")}
        body={t("skills.empty.body")}
        cta={t("skills.empty.cta")}
        onCta={() => router.push("/skills")}
      />
    );
  }

  const visible = rows.map((row, index) => ({ row, index })).filter(({ row }) => matchesFilter(row, filter));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent)" bg="var(--accent-bg)">
          {t("skills.enabledCount", { linked: effectiveCount(rows), total: rows.length })}
        </Badge>
        <div style={s.filter}>
          <Icon.Search size={13} style={s.filterIcon} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("skills.filterPlaceholder")}
            aria-label={t("skills.filterPlaceholder")}
            style={s.filterInput}
          />
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>
      {visible.length === 0 ? (
        <p style={s.hint}>{t("skills.noMatch")}</p>
      ) : (
        <ul style={s.list} aria-label={t("skills.title")}>
          {visible.map(({ row, index }) => (
            <li
              key={row.skill_id}
              draggable={canMove}
              onDragStart={() => setDragFrom(index)}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDragOver(index);
              }}
              onDragLeave={() => setDragOver((o) => (o === index ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, index);
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              style={s.row(dragOver === index, !row.skill_enabled)}
            >
              <button
                type="button"
                aria-label={t("skills.moveHandle", { name: row.name })}
                disabled={!canMove}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                  e.preventDefault();
                  move(index, e.key === "ArrowUp" ? index - 1 : index + 1);
                }}
                style={s.handle(!canMove)}
              >
                <Icon.GripVertical size={16} />
              </button>
              <Checkbox
                checked={row.enabled}
                onChange={(enabled) => save(toggleRow(rows, row.skill_id, enabled))}
                label={<span style={s.srOnly}>{t("skills.toggleLabel", { name: row.name })}</span>}
              />
              <span className="mono" style={s.name} title={row.description}>
                {row.name}
              </span>
              {!row.skill_enabled && (
                <span style={s.off} title={t("skills.globallyDisabledTitle")}>
                  {t("skills.globallyDisabled")}
                </span>
              )}
              <SkillTypeBadge type={row.type} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
