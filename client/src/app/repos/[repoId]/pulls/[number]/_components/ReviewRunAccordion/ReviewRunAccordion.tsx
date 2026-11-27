/* ReviewRunAccordion — one collapsible review RUN (a single agent's pass over
   the PR). Header shows agent + verdict + counts + score + when it ran; the
   body holds that run's VerdictBanner summary and its own FindingsPanel. A PR
   can have many runs (different agents / re-runs over time) — each is separate
   and collapsible so older runs don't bury the latest. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge } from "@devdigest/ui";
import type { ReviewRecord, RunSummary } from "@devdigest/shared";
import { useDeleteReview } from "@/lib/hooks/reviews";
import { FindingsPanel } from "../FindingsPanel";
import { VerdictBanner } from "../VerdictBanner";
import { usePrContext } from "../pr-context";
import { VERDICT_COLOR, VERDICT_COLOR_FALLBACK } from "./constants";
import { countBlockers, formatWhen } from "./helpers";
import { s } from "./styles";

export function ReviewRunAccordion({
  review,
  run,
  defaultOpen = false,
  targetRunId = null,
  targetNonce = 0,
}: {
  review: ReviewRecord;
  /** The agent run that produced this review (cost/tokens for the banner). */
  run?: RunSummary;
  defaultOpen?: boolean;
  /** When this matches review.run_id, the accordion opens and scrolls into view
   *  (driven from the Timeline: clicking an agent name navigates here). */
  targetRunId?: string | null;
  targetNonce?: number;
}) {
  const t = useTranslations("prReview");
  const { prId } = usePrContext();
  const [open, setOpen] = React.useState(defaultOpen);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (review.run_id && review.run_id === targetRunId) {
      setOpen(true);
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRunId, targetNonce, review.run_id]);
  const del = useDeleteReview(prId);
  const findings = review.findings;
  const blockers = countBlockers(findings);
  const verdictColor = (review.verdict && VERDICT_COLOR[review.verdict]) || VERDICT_COLOR_FALLBACK;

  return (
    <div ref={rootRef} id={review.run_id ? `review-run-${review.run_id}` : undefined} style={s.root}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
        }}
        style={s.header}
      >
        <Icon.Cpu size={15} style={s.mutedIcon} />
        <span style={s.agentName}>{review.agent_name ?? t("agentFallback")}</span>
        {review.verdict && (
          <Badge color={verdictColor} bg="transparent">
            {t(`accordion.verdict.${review.verdict}`)}
          </Badge>
        )}
        <span style={s.counts}>
          {t("accordion.counts", { findings: findings.length, blockers })}
        </span>
        <span style={s.spacer} />
        {review.score != null && (
          <Badge mono color="var(--text-secondary)">
            {review.score}
          </Badge>
        )}
        <span className="mono" style={s.when}>
          {formatWhen(review.created_at)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(t("accordion.confirmDelete", { agent: review.agent_name ?? t("accordion.agentGeneric") }))) {
              del.mutate(review.id);
            }
          }}
          disabled={del.isPending}
          title={t("accordion.delete")}
          aria-label={t("accordion.delete")}
          style={s.deleteBtn(del.isPending)}
        >
          <Icon.Trash size={14} style={del.isPending ? s.spin : undefined} />
        </button>
        <Icon.ChevronDown size={16} style={s.chevron(open)} />
      </div>

      {open && (
        <div style={s.body}>
          {review.verdict && (
            <div style={s.banner}>
              <VerdictBanner
                verdict={review.verdict}
                summary={review.summary}
                score={review.score}
                findingsCount={findings.length}
                blockers={blockers}
                agentName={review.agent_name}
                cost={
                  run?.status === "done"
                    ? { costUsd: run.cost_usd, tokensIn: run.tokens_in, tokensOut: run.tokens_out }
                    : undefined
                }
              />
            </div>
          )}
          <FindingsPanel findings={findings} />
        </div>
      )}
    </div>
  );
}
