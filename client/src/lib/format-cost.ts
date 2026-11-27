/**
 * Number parts for run cost / token / duration labels (spec:
 * specs/M1-run-cost-badge.md). These functions only decide the NUMBERS; the
 * words, symbols and unit letters live in `messages/en/common.json › format`,
 * applied by `useFormat()` (lib/use-format.ts).
 *
 * Rule: "no data" is NEVER rendered as a price — null/undefined → kind "none"
 * ("—"), so an unfinished, failed or pre-M1 run can't masquerade as "$0.00".
 */

export type CostParts =
  | { kind: "none" }
  /** Below the smallest shown amount: "<$0.0001". */
  | { kind: "below"; amount: string }
  | { kind: "usd"; amount: string };

/**
 * USD → amount digits, keeping ≥ 3 decimals for small values:
 *   null → none · 0 → "0" · 1.234 → "1.23" · 0.0123 → "0.012" · 0.00131 → "0.0013"
 */
export function costParts(usd: number | null | undefined): CostParts {
  if (usd == null || !Number.isFinite(usd) || usd < 0) return { kind: "none" };
  if (usd === 0) return { kind: "usd", amount: "0" };
  if (usd >= 1) return { kind: "usd", amount: usd.toFixed(2) };
  if (usd >= 0.01) return { kind: "usd", amount: usd.toFixed(3) };
  if (usd < 0.0001) return { kind: "below", amount: "0.0001" }; // avoid toPrecision's exponent form
  return { kind: "usd", amount: usd.toPrecision(2) };
}

export type TokenParts = { value: string; unit: "" | "k" | "m" };

/** Compact token count: 950 → 950 · 8_210 → 8.2 k · 1_250_000 → 1.3 m. */
export function tokenParts(n: number): TokenParts {
  if (n < 1000) return { value: String(n), unit: "" };
  if (n < 1_000_000) return { value: (n / 1000).toFixed(1), unit: "k" };
  return { value: (n / 1_000_000).toFixed(1), unit: "m" };
}

/** Milliseconds → seconds with one decimal ("1.2"). */
export function secondsOf(ms: number): string {
  return (ms / 1000).toFixed(1);
}
