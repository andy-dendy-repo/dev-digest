"use client";

import React from "react";
import { SectionLabel, EmptyState } from "@devdigest/ui";
import type { ReviewRecord, RunSummary, PrCommit } from "@devdigest/shared";
import { RunHistory } from "../RunHistory";
import { ReviewRunAccordion } from "../ReviewRunAccordion";
import { findingsByRun, lethalTrifectaFindings, runsById } from "./helpers";
import { LiveRunSection } from "./LiveRunSection";
import { LethalTrifectaBanner } from "./LethalTrifectaBanner";
import { s } from "./styles";

interface FindingsTabProps {
  /** Runs still in flight (server-sourced); non-empty → live section + progress note. */
  liveRunIds: string[];
  /** Persisted review runs, newest first. */
  reviews: ReviewRecord[];
  prRuns: RunSummary[] | undefined;
  prCommits: PrCommit[];
  onOpenTrace: (runId: string) => void;
  onDelete: (runId: string) => void;
  onRunDone: () => void;
}

/** "Agent runs" tab: live runs, lethal-trifecta warning, timeline, review runs. */
export function FindingsTab({
  liveRunIds,
  reviews,
  prRuns,
  prCommits,
  onOpenTrace,
  onDelete,
  onRunDone,
}: FindingsTabProps) {
  const running = liveRunIds.length > 0;
  const runs = prRuns ?? [];
  const runById = runsById(runs);

  // Timeline → Review-runs navigation: clicking an agent name in the timeline
  // opens + scrolls to that run's accordion below. The nonce re-triggers the
  // scroll even when the same run is clicked twice.
  const [target, setTarget] = React.useState<{ runId: string; n: number } | null>(null);
  const goToReview = (runId: string) => setTarget((p) => ({ runId, n: (p?.n ?? 0) + 1 }));

  return (
    <section>
      {running && <LiveRunSection runIds={liveRunIds} onOpenTrace={onOpenTrace} onRunDone={onRunDone} />}

      <LethalTrifectaBanner count={lethalTrifectaFindings(reviews).length} />

      {(runs.length > 0 || prCommits.length > 0) && (
        <div style={s.timelineSection}>
          <SectionLabel
            icon="Activity"
            right={<span style={s.sectionHint}>runs &amp; commits · newest first</span>}
          >
            Timeline
          </SectionLabel>
          <RunHistory
            runs={runs}
            commits={prCommits}
            onOpenTrace={onOpenTrace}
            onGoToReview={goToReview}
            onDelete={onDelete}
            findingsByRun={findingsByRun(reviews)}
          />
        </div>
      )}

      <SectionLabel icon="AlertOctagon" right={<span style={s.sectionHint}>grouped by run · newest first</span>}>
        Review runs
      </SectionLabel>
      {reviews.length === 0
        ? !running && (
            <EmptyState
              icon="Sparkles"
              title="No findings yet"
              body="Run a review to generate findings. Use Run Review ▾ above (run all enabled agents or a specific one)."
            />
          )
        : reviews.map((review, i) => (
            <ReviewRunAccordion
              key={review.id}
              review={review}
              run={review.run_id ? runById.get(review.run_id) : undefined}
              defaultOpen={i === 0}
              targetRunId={target?.runId ?? null}
              targetNonce={target?.n ?? 0}
            />
          ))}
    </section>
  );
}
