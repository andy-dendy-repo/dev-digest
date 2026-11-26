import {
  OPEN_STATUSES,
  SIZE_MEDIUM_MAX,
  SIZE_SMALL_MAX,
  type PrMeta,
  type PullsSort,
  type SizeInfo,
} from "./constants";

/** Bucket a PR into S/M/L by total changed lines. */
export function sizeOf(pr: PrMeta): SizeInfo {
  const lines = pr.additions + pr.deletions;
  const size = lines < SIZE_SMALL_MAX ? "S" : lines < SIZE_MEDIUM_MAX ? "M" : "L";
  return { size, lines };
}

export type RelativeTime = { unit: "none" | "now" | "m" | "h" | "d"; value: number };

/**
 * Compact age for the list's UPDATED column, as parts for the
 * `list.relativeTime` message ("now", "45m", "3h", "2d"; "—" when unknown).
 */
export function relativeTime(iso: string | null | undefined, now = Date.now()): RelativeTime {
  const then = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(then)) return { unit: "none", value: 0 };
  const m = Math.max(0, Math.round((now - then) / 60_000));
  if (m < 1) return { unit: "now", value: 0 };
  if (m < 60) return { unit: "m", value: m };
  const h = Math.round(m / 60);
  if (h < 24) return { unit: "h", value: h };
  return { unit: "d", value: Math.round(h / 24) };
}

/**
 * The rows the list shows: status filter ("all" = no filter), then a
 * case-insensitive match on title or number, sorted by last update.
 */
export function visiblePulls(
  pulls: readonly PrMeta[],
  { status, query, sort }: { status: string; query: string; sort: PullsSort },
): PrMeta[] {
  const q = query.trim().toLowerCase();
  return pulls
    .filter((p) => status === "all" || p.status === status)
    .filter((p) => !q || p.title.toLowerCase().includes(q) || String(p.number).includes(q))
    .sort((a, b) => {
      const ta = Date.parse(a.updated_at ?? "") || 0;
      const tb = Date.parse(b.updated_at ?? "") || 0;
      return sort === "oldest" ? ta - tb : tb - ta;
    });
}

/** Header counters: open PRs and those still needing review. */
export function pullCounts(pulls: readonly PrMeta[]): { open: number; needsReview: number } {
  return {
    open: pulls.filter((p) => OPEN_STATUSES.has(p.status)).length,
    needsReview: pulls.filter((p) => p.status === "needs_review").length,
  };
}
