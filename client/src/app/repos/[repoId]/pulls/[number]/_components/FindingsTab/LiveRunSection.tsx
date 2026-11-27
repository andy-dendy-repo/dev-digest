"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Button, SectionLabel } from "@devdigest/ui";
import { useCancelRun } from "@/lib/hooks/reviews";
import { RunStatus } from "../RunStatus";
import { s } from "./styles";

/** In-flight runs: cancel / open-trace controls, the live log, and a progress note. */
export function LiveRunSection({
  runIds,
  onOpenTrace,
  onRunDone,
}: {
  runIds: string[];
  onOpenTrace: (runId: string) => void;
  onRunDone: () => void;
}) {
  const t = useTranslations("prReview");
  const cancel = useCancelRun();
  const firstRunId = runIds[0];

  return (
    <>
      <div style={s.liveRunSection}>
        <SectionLabel
          icon="Sparkles"
          right={
            <div style={s.cancelActions}>
              <Button
                kind="danger"
                size="sm"
                icon="X"
                loading={cancel.isPending}
                onClick={() => runIds.forEach((id) => cancel.mutate(id))}
              >
                {t("live.cancel")}
              </Button>
              <Button
                kind="ghost"
                size="sm"
                icon="FileText"
                onClick={() => firstRunId && onOpenTrace(firstRunId)}
              >
                {t("live.openTrace")}
              </Button>
            </div>
          }
        >
          {t("live.title")}
        </SectionLabel>
        <RunStatus runIds={runIds} onDone={onRunDone} />
      </div>

      <div style={s.reviewInProgress}>
        <Icon.RefreshCw size={16} style={s.spinner} />
        <span style={s.reviewInProgressText}>{t("live.inProgress")}</span>
        <span style={s.reviewInProgressSub}>{t("live.inProgressSub")}</span>
      </div>
    </>
  );
}
