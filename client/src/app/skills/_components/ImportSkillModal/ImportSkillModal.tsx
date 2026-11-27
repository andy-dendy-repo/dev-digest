/* ImportSkillModal — upload a .md file or .zip/.skill archive → server-side
   preview (core + frontmatter) → confirm. Nothing is saved before the user
   confirms, the archive's scripts/binaries are never read or sent, and the
   skill is saved disabled until someone vets and enables it. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Icon, Markdown, Modal, SelectInput, TextInput } from "@devdigest/ui";
import type { Skill, SkillImportPreview, SkillType } from "@devdigest/shared";
import { useCreateSkill, usePreviewSkillImport } from "@/lib/hooks/skills";
import { ACCEPTED_UPLOAD_TYPES, readSkillUpload, SkillUploadError } from "@/lib/skill-archive";
import { ApiError } from "@/lib/api";
import { SKILL_TYPES } from "@/lib/skills";
import { useToast } from "@/lib/toast";
import { s } from "./styles";

type Draft = SkillImportPreview["draft"];

export function ImportSkillModal({ onClose, onImported }: { onClose: () => void; onImported: (skill: Skill) => void }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const preview = usePreviewSkillImport();
  const create = useCreateSkill();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [reading, setReading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const result = preview.data;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setReading(true);
    try {
      const req = await readSkillUpload(file);
      const res = await preview.mutateAsync(req);
      setDraft(res.draft);
    } catch (err) {
      if (err instanceof SkillUploadError) setUploadError(t(`import.errors.${err.code}`));
      else setUploadError(t("import.errors.server", { message: err instanceof ApiError ? err.message : String(err) }));
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reset = () => {
    setDraft(null);
    preview.reset();
    create.reset();
  };

  const save = () => {
    if (!draft) return;
    create.mutate(
      { ...draft, source: "imported_file" },
      {
        onSuccess: (skill) => {
          toast.success(t("import.success", { name: skill.name }));
          onImported(skill);
        },
      },
    );
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const canSave = !!draft && draft.name.trim() && draft.description.trim() && !create.isPending;

  return (
    <Modal
      width={780}
      title={t("import.title")}
      subtitle={t("import.subtitle")}
      onClose={onClose}
      footer={
        draft ? (
          <div style={s.footer}>
            <Button kind="secondary" onClick={reset}>
              {t("import.back")}
            </Button>
            <Button kind="primary" icon="Check" onClick={save} disabled={!canSave}>
              {create.isPending ? t("import.saving") : t("import.confirm")}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!draft || !result ? (
        <div style={s.pick}>
          <Icon.Upload size={22} />
          <Button kind="primary" icon="Upload" onClick={() => inputRef.current?.click()} disabled={reading}>
            {reading ? t("import.reading") : t("import.choose")}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_UPLOAD_TYPES}
            aria-label={t("import.choose")}
            style={s.hiddenInput}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <p style={s.hint}>{t("import.accepted")}</p>
          {uploadError && (
            <p role="alert" style={s.error}>
              {uploadError}
            </p>
          )}
        </div>
      ) : (
        <>
          <div style={s.trust} role="note">
            <Icon.AlertTriangle size={16} style={s.trustIcon} />
            <div>
              <div style={s.trustTitle}>{t("import.trustTitle")}</div>
              {t("import.trustBody")}
            </div>
          </div>
          <div className="mono" style={s.core}>
            {t("import.core", { path: result.core_path })}
          </div>
          <FormField label={t("config.name")} hint={t("config.nameHint")} required>
            <TextInput value={draft.name} onChange={(v) => set("name", v)} mono aria-label={t("config.name")} />
          </FormField>
          <FormField label={t("config.description")} hint={t("config.descriptionHint")} required>
            <TextInput
              value={draft.description}
              onChange={(v) => set("description", v)}
              aria-label={t("config.description")}
            />
          </FormField>
          <FormField label={t("config.type")}>
            <SelectInput
              value={draft.type}
              onChange={(v) => set("type", v as SkillType)}
              options={SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
            />
          </FormField>
          <FormField label={t("import.previewTitle")}>
            <div style={s.bodyBox}>
              <Markdown>{draft.body}</Markdown>
            </div>
          </FormField>
          {result.ignored.length > 0 && (
            <>
              <div style={s.ignoredTitle}>{t("import.ignoredTitle")}</div>
              <ul style={s.ignoredList} aria-label={t("import.ignoredTitle")}>
                {result.ignored.map((i) => (
                  <li key={i.path} className="mono" style={s.ignoredItem}>
                    {i.path} — {t(`import.reason.${i.reason}`)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {create.isError && (
            <p role="alert" style={s.error}>
              {create.error instanceof ApiError ? create.error.message : String(create.error)}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
