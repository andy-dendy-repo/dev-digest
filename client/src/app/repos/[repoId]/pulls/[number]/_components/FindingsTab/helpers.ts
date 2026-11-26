import type { FindingRecord, ReviewRecord, RunSummary } from "@devdigest/shared";

/** Lethal-trifecta findings across every review run of the PR. */
export function lethalTrifectaFindings(reviews: readonly ReviewRecord[]): FindingRecord[] {
  return reviews.flatMap((r) => r.findings).filter((f) => f.kind === "lethal_trifecta");
}

/** run_id → run row, so each review's VerdictBanner can show that run's cost. */
export function runsById(runs: readonly RunSummary[]): Map<string, RunSummary> {
  return new Map(runs.map((r) => [r.run_id, r]));
}

/** run_id → that run's findings, for the timeline's severity icons + preview. */
export function findingsByRun(reviews: readonly ReviewRecord[]): Map<string, FindingRecord[]> {
  return new Map(reviews.flatMap((rv) => (rv.run_id ? [[rv.run_id, rv.findings] as const] : [])));
}
