/* Route error boundary: an error thrown while rendering any page lands here
   (inside the root layout, so providers and i18n still work). */
"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@devdigest/ui";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState fullScreen title={t("errorBoundary.title")} body={t("errorBoundary.body")} onRetry={reset} />;
}
