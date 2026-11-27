import type { FindingRecord, Severity } from "@devdigest/shared";
import { severityRank } from "@/lib/findings-severity";
import { LOW_CONFIDENCE_THRESHOLD } from "./constants";

/** Drop low-confidence findings when `hideLow` is on. */
export function confidentFindings(findings: FindingRecord[], hideLow: boolean): FindingRecord[] {
  return hideLow ? findings.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD) : findings;
}

/** Apply the confidence and (optional) severity filters, then sort by severity. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severity: Severity | null = null,
): FindingRecord[] {
  let shown = confidentFindings(findings, hideLow);
  if (severity) shown = shown.filter((f) => f.severity === severity);
  return [...shown].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * A bare key press meant as a panel shortcut: no modifier (so Cmd/Ctrl+A,
 * Ctrl+D… stay browser chords) and not typed into a form field or editor.
 */
export function isPlainShortcut(
  e: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "target">,
): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const el = e.target as HTMLElement | null;
  if (!el) return true;
  return !TYPING_TAGS.has(el.tagName) && !el.isContentEditable;
}
