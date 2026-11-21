/* RunCostBadge — USD cost (+ tokens) of an agent run. M1 run cost badge
   (specs/M1-run-cost-badge.md). Variants:
     compact → "$0.014"               (PR list)
     total   → "9,119 tok · $0.0013"  (Agent runs timeline row)
     split   → "$0.014 · 8.2K→1.3K"   (VerdictBanner)
   Unknown cost always renders "—" (tokens hidden), never a fake "$0.00". */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { NO_COST, formatCost, formatTokenSplit } from "@/lib/format-cost";

export type RunCostBadgeVariant = "compact" | "total" | "split";

export function RunCostBadge({
  costUsd,
  tokensIn,
  tokensOut,
  variant = "compact",
}: {
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  variant?: RunCostBadgeVariant;
}) {
  const t = useTranslations("prReview");
  const cost = formatCost(costUsd);
  const hasTokens = tokensIn != null && tokensOut != null;

  let text = cost;
  if (cost !== NO_COST && hasTokens) {
    if (variant === "total") text = `${t("cost.tokensTotal", { count: tokensIn + tokensOut })} · ${cost}`;
    else if (variant === "split") text = `${cost} · ${formatTokenSplit(tokensIn, tokensOut)}`;
  }

  return (
    <span
      className="mono"
      title={t("cost.title")}
      data-testid="run-cost"
      style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}
    >
      {text}
    </span>
  );
}
