import type { PrMeta, ReviewRecord } from "@devdigest/shared";

/** The route is keyed by PR number, but every PR API by the row's uuid. */
export function prIdForNumber(pulls: readonly PrMeta[] | undefined, number: number): string | null {
  return pulls?.find((p) => p.number === number)?.id ?? null;
}

/** Findings across every review run (the "Agent runs" tab counter). */
export function countFindings(reviews: readonly ReviewRecord[]): number {
  return reviews.reduce((n, r) => n + r.findings.length, 0);
}

/** This PR page's URL with one query param set, or removed when `value` is null. */
export function prDetailHref(
  repoId: string,
  number: string | number,
  search: { toString(): string },
  key: string,
  value: string | null,
): string {
  const sp = new URLSearchParams(search.toString());
  if (value == null) sp.delete(key);
  else sp.set(key, value);
  const qs = sp.toString();
  return `/repos/${repoId}/pulls/${number}${qs ? `?${qs}` : ""}`;
}
