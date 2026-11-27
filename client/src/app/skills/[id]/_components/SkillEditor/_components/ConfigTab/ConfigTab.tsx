/* ConfigTab — name, directive description, type and markdown body of a skill.
   Controlled by SkillEditor's draft; saves only the changed fields. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, SelectInput, TextInput } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SKILL_TYPES } from "@/lib/skills";
import { MarkdownEditor } from "@/app/skills/_components/MarkdownEditor";
import { changedFields, type SkillDraft } from "../../helpers";
import { s } from "./styles";

export function ConfigTab({
  skill,
  draft,
  onChange,
}: {
  skill: Skill;
  draft: SkillDraft;
  onChange: (d: SkillDraft) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const patch = changedFields(skill, draft);
  const dirty = Object.keys(patch).length > 0;
  const valid = draft.name.trim() && draft.description.trim() && draft.body.trim();
  const set = <K extends keyof SkillDraft>(key: K, value: SkillDraft[K]) => onChange({ ...draft, [key]: value });

  const save = () =>
    update.mutate(
      { id: skill.id, patch },
      { onSuccess: (data) => toast.success(t("config.savedToast", { version: data.version })) },
    );

  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("config.title")}</h2>
      <FormField label={t("config.name")} hint={t("config.nameHint")} required>
        <TextInput value={draft.name} onChange={(v) => set("name", v)} mono aria-label={t("config.name")} />
      </FormField>
      <FormField label={t("config.description")} hint={t("config.descriptionHint")}>
        <TextInput value={draft.description} onChange={(v) => set("description", v)} aria-label={t("config.description")} />
      </FormField>
      <FormField label={t("config.type")}>
        <SelectInput
          value={draft.type}
          onChange={(v) => set("type", v as SkillType)}
          options={SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
        />
      </FormField>
      <FormField label={t("config.body")} hint={t("config.bodyHint")} required>
        <MarkdownEditor
          value={draft.body}
          onChange={(v) => set("body", v)}
          filename={`${skill.name}.md`}
          label={t("config.body")}
          dirty={patch.body !== undefined}
        />
      </FormField>
      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={!dirty || !valid || update.isPending}>
          {update.isPending ? t("config.saving") : t("config.save")}
        </Button>
        {update.isSuccess && !dirty && (
          <span style={s.savedNote}>{t("config.saved", { version: update.data?.version })}</span>
        )}
      </div>
    </div>
  );
}
