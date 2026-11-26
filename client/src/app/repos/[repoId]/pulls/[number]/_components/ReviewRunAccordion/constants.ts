/** Verdict → header badge colour token. */
export const VERDICT_COLOR: Record<string, string> = {
  request_changes: "var(--crit)",
  comment: "var(--warn)",
  approve: "var(--ok)",
};

export const VERDICT_COLOR_FALLBACK = "var(--text-muted)";
