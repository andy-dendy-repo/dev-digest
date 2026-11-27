import type { PrCommit, RunSummary } from "@devdigest/shared";
import type { Outcome } from "./constants";

/**
 * The review OUTCOME of a run, not just its lifecycle: a finished run that found
 * blockers is "rejected", never a green "done". Derived from the denormalized
 * blocker/finding counts on the run row, so it matches the CI gate
 * (deterministic) rather than the model's verdict.
 */
export function outcomeOf(run: Pick<RunSummary, "status" | "blockers" | "findings_count">): Outcome {
  if (run.status === "running") return "running";
  if (run.status === "failed") return "error";
  if (run.status === "cancelled") return "cancelled";
  if ((run.blockers ?? 0) > 0) return "rejected";
  if ((run.findings_count ?? 0) > 0) return "reviewed";
  return "approved";
}

export type TimelineItem =
  | { kind: "run"; ts: number; run: RunSummary }
  | { kind: "commit"; ts: number; commit: PrCommit };

/** Epoch ms for sorting; unparseable / missing timestamps sort last. */
export function tsOf(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Date.parse(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Runs and commits interleaved, newest first. */
export function timelineItems(runs: RunSummary[], commits: PrCommit[]): TimelineItem[] {
  return [
    ...runs.map((run) => ({ kind: "run" as const, ts: tsOf(run.ran_at), run })),
    ...commits.map((commit) => ({ kind: "commit" as const, ts: tsOf(commit.committed_at), commit })),
  ].sort((a, b) => b.ts - a.ts);
}
