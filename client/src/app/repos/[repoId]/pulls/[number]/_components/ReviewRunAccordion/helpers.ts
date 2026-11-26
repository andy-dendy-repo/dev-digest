import type { FindingRecord } from "@devdigest/shared";

/** Blockers = CRITICAL findings nobody dismissed (what the CI gate fails on). */
export function countBlockers(findings: readonly Pick<FindingRecord, "severity" | "dismissed_at">[]): number {
  return findings.filter((f) => f.severity === "CRITICAL" && !f.dismissed_at).length;
}

/** Local date-time for the header; an unparseable timestamp is shown as is. */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
