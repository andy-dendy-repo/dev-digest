import type { FindingRecord, Severity } from "@devdigest/shared";

/** The finding severities, most severe first (display + sort order). */
export const SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[];

const RANK: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

/** Sort weight of a severity (lower = more severe; unknown sorts last). */
export function severityRank(severity: string): number {
  return RANK[severity] ?? 9;
}

/** Number of findings per severity; every severity is present (0 when none). */
export function countBySeverity(findings: Pick<FindingRecord, "severity">[]): Record<Severity, number> {
  const counts = Object.fromEntries(SEVERITIES.map((sev) => [sev, 0])) as Record<Severity, number>;
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

/** Comparator: most severe first, then highest confidence. */
export function bySeverityThenConfidence(
  a: Pick<FindingRecord, "severity" | "confidence">,
  b: Pick<FindingRecord, "severity" | "confidence">,
): number {
  return severityRank(a.severity) - severityRank(b.severity) || b.confidence - a.confidence;
}
