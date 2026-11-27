"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, CircularScore } from "@devdigest/ui";
import type { RunSummary } from "@devdigest/shared";
import { RunCostBadge } from "@/components/run-cost-badge";
import { FindingsPreview, type FindingPreviewItem } from "@/components/findings-preview";
import { OUTCOME_META } from "./constants";
import { outcomeOf } from "./helpers";
import { s } from "./styles";

/** One agent run: outcome badge, score, agent + model, findings, cost, actions. */
export function RunRow({
  run,
  findings,
  onOpenTrace,
  onGoToReview,
  onDelete,
}: {
  run: RunSummary;
  /** This run's findings (from the PR's loaded reviews); empty → counts only. */
  findings: FindingPreviewItem[];
  onOpenTrace: (runId: string) => void;
  onGoToReview?: (runId: string) => void;
  onDelete?: (runId: string) => void;
}) {
  const t = useTranslations("prReview");
  const outcome = outcomeOf(run);
  const meta = OUTCOME_META[outcome];
  const settled = run.status === "done";

  return (
    <div style={s.runRow}>
      <Badge color={meta.color} bg={meta.bg} icon={meta.icon}>
        {t(`runStatus.${outcome}`)}
      </Badge>
      {settled && run.score != null && <CircularScore score={run.score} size={30} stroke={3} />}
      <div style={s.runMain}>
        <div style={s.runTitle}>
          <button
            type="button"
            onClick={() => onGoToReview?.(run.run_id)}
            title={t("timeline.goToReview")}
            style={s.agentLink(!!onGoToReview)}
          >
            {run.agent_name ?? t("agentFallback")}
          </button>{" "}
          <span className="mono" style={s.model}>
            {run.provider}/{run.model}
          </span>
        </div>
        {run.status === "failed" && run.error && (
          <div style={s.runError} title={run.error}>
            {run.error}
          </div>
        )}
        {settled &&
          (findings.length > 0 ? (
            <div>
              <FindingsPreview findings={findings} />
            </div>
          ) : (
            <div style={s.runCounts}>
              {t("runStatus.findings", { count: run.findings_count ?? 0 })}
              {(run.blockers ?? 0) > 0 ? t("runStatus.blockers", { count: run.blockers ?? 0 }) : ""}
            </div>
          ))}
      </div>
      <div style={s.runMeta}>
        {run.ran_at && <span>{new Date(run.ran_at).toLocaleTimeString()}</span>}
        {settled && (
          <RunCostBadge
            costUsd={run.cost_usd}
            tokensIn={run.tokens_in}
            tokensOut={run.tokens_out}
            variant="total"
          />
        )}
      </div>
      <button
        type="button"
        title={t("timeline.openTrace")}
        aria-label={t("timeline.openTrace")}
        onClick={() => onOpenTrace(run.run_id)}
        style={s.iconBtn}
      >
        <Icon.FileText size={13} />
      </button>
      {onDelete && run.status !== "running" && (
        <button
          type="button"
          aria-label={t("timeline.deleteRun")}
          title={t("timeline.deleteRun")}
          onClick={() => onDelete(run.run_id)}
          style={s.deleteBtn}
        >
          <Icon.Trash size={13} />
        </button>
      )}
    </div>
  );
}
