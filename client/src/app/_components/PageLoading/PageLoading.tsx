/* PageLoading — route-level loading UI (app/loading.tsx): the app shell with a
   skeleton, shown while a route's server payload streams in. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { s } from "./styles";

export function PageLoading() {
  const t = useTranslations("common");
  return (
    <AppShell>
      <div role="status" aria-label={t("meta.loading")} style={s.wrap}>
        <Skeleton height={28} width={420} />
        <Skeleton height={16} width={300} />
        <Skeleton height={200} />
      </div>
    </AppShell>
  );
}
