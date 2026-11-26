/* useFormat — turns the number parts from format-cost.ts into labels using the
   patterns in messages/en/common.json › format (so units stay translatable). */
"use client";

import { useTranslations } from "next-intl";
import { costParts, secondsOf, tokenParts } from "@/lib/format-cost";

export function useFormat() {
  const t = useTranslations("common");
  const tokens = (n: number) => t("format.tokens", tokenParts(n));
  return {
    /** "$0.012" · "<$0.0001" · "—" for no data. */
    cost: (usd: number | null | undefined) => {
      const p = costParts(usd);
      if (p.kind === "none") return t("format.none");
      return t(p.kind === "below" ? "format.usdBelow" : "format.usd", { amount: p.amount });
    },
    /** "950" · "8.2K" · "1.3M". */
    tokens,
    /** "8.2K→1.3K". */
    tokenSplit: (tokensIn: number, tokensOut: number) =>
      t("format.tokenSplit", { tokensIn: tokens(tokensIn), tokensOut: tokens(tokensOut) }),
    /** "1.2s". */
    seconds: (ms: number) => t("format.seconds", { seconds: secondsOf(ms) }),
  };
}
