/* NotFoundView — unknown URL or a `notFound()` call (app/not-found.tsx). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";

export function NotFoundView() {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <AppShell>
      <EmptyState
        icon="Search"
        title={t("notFound.title")}
        body={t("notFound.body")}
        cta={t("notFound.cta")}
        onCta={() => router.push("/")}
      />
    </AppShell>
  );
}
