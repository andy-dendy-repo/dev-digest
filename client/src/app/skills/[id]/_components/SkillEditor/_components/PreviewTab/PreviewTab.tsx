/* PreviewTab — the skill body rendered as markdown (the current draft). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, Markdown } from "@devdigest/ui";

export function PreviewTab({ body }: { body: string }) {
  const t = useTranslations("skills");
  if (!body.trim()) return <EmptyState icon="FileText" title={t("preview.empty")} />;
  return (
    <div style={{ maxWidth: 820, fontSize: 14 }}>
      <Markdown>{body}</Markdown>
    </div>
  );
}
