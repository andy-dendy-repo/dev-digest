/* AddSkillMenu — "Add Skill ▾" (create / import from file) plus the two modals.
   Used by the Skills grid and the skill editor's sidebar. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, Dropdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { CreateSkillModal } from "../CreateSkillModal";
import { ImportSkillModal } from "../ImportSkillModal";

export function AddSkillMenu({ label, compact = false }: { label: string; compact?: boolean }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const [mode, setMode] = React.useState<"create" | "import" | null>(null);
  const open = (skill: Skill) => {
    setMode(null);
    router.push(`/skills/${skill.id}?tab=config`);
  };

  return (
    <>
      <Dropdown
        width={220}
        align="right"
        trigger={
          <Button kind="primary" size="sm" icon="Plus" iconRight={compact ? undefined : "ChevronDown"}>
            {label}
          </Button>
        }
        items={[
          { label: t("page.menu.create"), icon: "Edit", onClick: () => setMode("create") },
          { label: t("page.menu.importFile"), icon: "Upload", onClick: () => setMode("import") },
        ]}
      />
      {mode === "create" && <CreateSkillModal onClose={() => setMode(null)} onCreated={open} />}
      {mode === "import" && <ImportSkillModal onClose={() => setMode(null)} onImported={open} />}
    </>
  );
}
