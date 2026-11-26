import type { IconName } from "@devdigest/ui";

export type Outcome = "running" | "error" | "cancelled" | "rejected" | "reviewed" | "approved";

/** Outcome → badge colours + icon. The label is `prReview.runStatus.<outcome>`. */
export const OUTCOME_META: Record<Outcome, { color: string; bg: string; icon: IconName }> = {
  running: { color: "var(--accent)", bg: "var(--accent-bg)", icon: "RefreshCw" },
  error: { color: "var(--crit)", bg: "var(--crit-bg)", icon: "XCircle" },
  cancelled: { color: "var(--text-muted)", bg: "var(--bg-hover)", icon: "X" },
  rejected: { color: "var(--crit)", bg: "var(--crit-bg)", icon: "XCircle" },
  reviewed: { color: "var(--warn)", bg: "var(--warn-bg)", icon: "MessageSquare" },
  approved: { color: "var(--ok)", bg: "var(--ok-bg)", icon: "CheckCircle" },
};
