"use client";

import React from "react";
import type { RunSummary, PrCommit } from "@devdigest/shared";
import type { FindingPreviewItem } from "@/components/findings-preview";
import { timelineItems } from "./helpers";
import { CommitRow } from "./CommitRow";
import { RunRow } from "./RunRow";
import { s } from "./styles";

/**
 * PR timeline — every agent run interleaved with the PR's commits, newest-first
 * and DB-backed so it survives reload. Showing commits between runs makes it
 * clear which commit each review ran against. Failed runs show their error
 * inline; clicking a run row opens its trace. A settled run with findings shows
 * severity icons that open a brief findings preview.
 */
export function RunHistory({
  runs,
  commits = [],
  onOpenTrace,
  onGoToReview,
  onDelete,
  findingsByRun,
}: {
  runs: RunSummary[];
  commits?: PrCommit[];
  /** run_id → that run's findings (from the PR's loaded reviews). */
  findingsByRun?: ReadonlyMap<string, FindingPreviewItem[]>;
  /** Open the trace + log drawer for a run (the logs icon). */
  onOpenTrace: (runId: string) => void;
  /** Jump to this run's inline review accordion below (clicking the agent name). */
  onGoToReview?: (runId: string) => void;
  onDelete?: (runId: string) => void;
}) {
  if (runs.length === 0 && commits.length === 0) return null;

  return (
    <div style={s.list}>
      {timelineItems(runs, commits).map((item) =>
        item.kind === "commit" ? (
          <CommitRow key={`commit:${item.commit.sha}`} commit={item.commit} />
        ) : (
          <RunRow
            key={`run:${item.run.run_id}`}
            run={item.run}
            findings={findingsByRun?.get(item.run.run_id) ?? []}
            onOpenTrace={onOpenTrace}
            onGoToReview={onGoToReview}
            onDelete={onDelete}
          />
        ),
      )}
    </div>
  );
}
