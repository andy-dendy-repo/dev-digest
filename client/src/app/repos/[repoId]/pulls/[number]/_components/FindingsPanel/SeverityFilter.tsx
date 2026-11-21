/* SeverityFilter — per-severity counters for one review run; clicking a counter
   toggles a single-severity filter on that run's findings list. Pure UI: counts
   come from already-loaded findings, so a click never hits the network. */
"use client";

import { useTranslations } from "next-intl";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { FILTER_SEVERITIES } from "./constants";
import { s } from "./styles";

export function SeverityFilter({
  counts,
  active,
  onToggle,
}: {
  counts: Record<Severity, number>;
  active: Severity | null;
  onToggle: (severity: Severity) => void;
}) {
  const t = useTranslations("prReview");
  return (
    <div role="group" aria-label={t("panel.severityFilterLabel")} style={s.sevGroup}>
      {FILTER_SEVERITIES.map((sev) => {
        const isActive = active === sev;
        return (
          <button
            key={sev}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(sev)}
            style={s.sevChip(SEV[sev].c, isActive, active !== null && !isActive)}
          >
            {t(`panel.severityCount.${sev}`, { count: counts[sev] })}
          </button>
        );
      })}
    </div>
  );
}
