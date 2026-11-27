"use client";

import React from "react";
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
                Cancel
              </Button>
              <Button
                kind="ghost"
                size="sm"
                icon="FileText"
                onClick={() => firstRunId && onOpenTrace(firstRunId)}
              >
                Open run trace
              </Button>
            </div>
          }
        >
          Live review
        </SectionLabel>
        <RunStatus runIds={runIds} onDone={onRunDone} />
      </div>

      <div style={s.reviewInProgress}>
        <Icon.RefreshCw size={16} style={s.spinner} />
        <span style={s.reviewInProgressText}>Review in progress…</span>
        <span style={s.reviewInProgressSub}>
          the agent is analyzing the diff — this can take a while on large PRs.
        </span>
      </div>
    </>
  );
}
