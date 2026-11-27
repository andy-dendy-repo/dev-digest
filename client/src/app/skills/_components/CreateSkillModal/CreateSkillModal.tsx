/* CreateSkillModal — a new skill from scratch: name, directive description,
   type and markdown body. On success the caller opens the new skill. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, SelectInput, TextInput } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useCreateSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { SKILL_TYPES } from "@/lib/skills";
import { MarkdownEditor } from "../MarkdownEditor";
import { s } from "./styles";

export function CreateSkillModal({ onClose, onCreated }: { onClose: () => void; onCreated: (skill: Skill) => void }) {
  const t = useTranslations("skills");
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>("rubric");
  const [body, setBody] = React.useState("");
  const canSubmit = name.trim() && description.trim() && body.trim() && !create.isPending;

  const submit = () =>
    create.mutate(
      { name: name.trim(), description: description.trim(), type, body },
      { onSuccess: (skill) => onCreated(skill) },
    );

  return (
    <Modal
      width={760}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="secondary" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Check" onClick={submit} disabled={!canSubmit}>
            {create.isPending ? t("create.creating") : t("create.submit")}
          </Button>
        </div>
      }
    >
      <FormField label={t("config.name")} hint={t("config.nameHint")} required>
        <TextInput value={name} onChange={setName} placeholder={t("create.namePlaceholder")} mono aria-label={t("config.name")} />
      </FormField>
      <FormField label={t("config.description")} hint={t("config.descriptionHint")} required>
        <TextInput
          value={description}
          onChange={setDescription}
          placeholder={t("create.descriptionPlaceholder")}
          aria-label={t("config.description")}
        />
      </FormField>
      <FormField label={t("config.type")}>
        <SelectInput
          value={type}
          onChange={(v) => setType(v as SkillType)}
          options={SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
        />
      </FormField>
      <FormField label={t("config.body")} hint={t("config.bodyHint")} required>
        <MarkdownEditor
          value={body}
          onChange={setBody}
          filename={`${name.trim() || "skill"}.md`}
          label={t("config.body")}
          placeholder={t("create.bodyPlaceholder")}
        />
      </FormField>
      {create.isError && (
        <div role="alert" style={s.error}>
          {create.error instanceof ApiError ? create.error.message : String(create.error)}
        </div>
      )}
    </Modal>
  );
}
