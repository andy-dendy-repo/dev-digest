import type { FindingRecord } from "@devdigest/shared";

/** What the preview needs from a finding — satisfied by both `FindingRecord`
 *  (timeline) and `FindingBrief` (PR list). */
export type FindingPreviewItem = Pick<
  FindingRecord,
  "id" | "severity" | "category" | "title" | "file" | "start_line" | "end_line" | "confidence" | "rationale"
>;

/** "12" when single-line, else "12-15". */
export function lineRange(f: Pick<FindingRecord, "start_line" | "end_line">): string {
  return f.start_line === f.end_line ? `${f.start_line}` : `${f.start_line}-${f.end_line}`;
}

export const PANEL_WIDTH = 440;
export const PANEL_MAX_HEIGHT = 420;
const GAP = 6;
const MARGIN = 8;
/** Below this much room under the trigger, open upward if there's more room above. */
const MIN_ROOM_BELOW = 240;

export type PanelPosition = {
  left: number;
  width: number;
  maxHeight: number;
} & ({ top: number; bottom?: undefined } | { bottom: number; top?: undefined });

/**
 * Fixed-position placement for the preview panel, from the trigger's viewport
 * rect. Clamped horizontally to the viewport; opens upward when there isn't
 * enough room below (and there's more above).
 */
export function panelPosition(
  anchor: { top: number; bottom: number; left: number },
  viewport: { width: number; height: number },
): PanelPosition {
  const width = Math.min(PANEL_WIDTH, viewport.width - 2 * MARGIN);
  const left = Math.max(MARGIN, Math.min(anchor.left, viewport.width - width - MARGIN));
  const below = viewport.height - anchor.bottom - GAP - MARGIN;
  const above = anchor.top - GAP - MARGIN;
  if (below >= Math.min(PANEL_MAX_HEIGHT, MIN_ROOM_BELOW) || below >= above) {
    return { left, width, top: anchor.bottom + GAP, maxHeight: Math.min(PANEL_MAX_HEIGHT, below) };
  }
  return {
    left,
    width,
    bottom: viewport.height - anchor.top + GAP,
    maxHeight: Math.min(PANEL_MAX_HEIGHT, above),
  };
}
