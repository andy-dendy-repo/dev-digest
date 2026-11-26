/* FindingsPanel — severity counters/filter + hide-low-confidence + j/k
   navigation + FindingCard list, wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingActionKind, FindingRecord, Severity } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { countBySeverity } from "@/lib/findings-severity";
import { confidentFindings, visibleFindings } from "./helpers";
import { SeverityFilter } from "./SeverityFilter";
import { useFindingShortcuts } from "./useFindingShortcuts";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [severity, setSeverity] = React.useState<Severity | null>(null);
  const [focusIdx, setFocusIdx] = React.useState(0);

  // Counters reflect the list after "hide low confidence" but before the
  // severity filter, so each number is what clicking it will show.
  const counts = countBySeverity(confidentFindings(findings, hideLow));
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, severity),
    [findings, hideLow, severity],
  );

  const toggleSeverity = (sev: Severity) => {
    setSeverity((cur) => (cur === sev ? null : sev));
    setFocusIdx(0);
  };

  const onAction = React.useCallback(
    (index: number, act: FindingActionKind) => {
      const f = shown[index];
      if (f) action.mutate({ findingId: f.id, action: act, prId });
    },
    [shown, action, prId],
  );
  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  const claimKeyboard = useFindingShortcuts({
    count: shown.length,
    focusIdx,
    setFocusIdx,
    onAction,
  });

  return (
    <div {...claimKeyboard}>
      <div style={s.toolbar}>
        <SeverityFilter counts={counts} active={severity} onToggle={toggleSeverity} />
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
