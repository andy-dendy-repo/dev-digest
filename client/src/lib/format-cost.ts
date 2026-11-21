/**
 * Formatting for the M1 run cost badge (spec: specs/M1-run-cost-badge.md).
 *
 * Rule: "no data" is NEVER rendered as a price — null/undefined → "—", so an
 * unfinished, failed or pre-M1 run can't masquerade as "$0.00".
 */

export const NO_COST = "—";

/**
 * USD → display string, keeping ≥ 3 decimals for small values:
 *   null → "—" · 0 → "$0" · 1.234 → "$1.23" · 0.0123 → "$0.012" · 0.00131 → "$0.0013"
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd < 0) return NO_COST;
  if (usd === 0) return "$0";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  if (usd < 0.0001) return "<$0.0001"; // avoid toPrecision's exponent form
  return `$${usd.toPrecision(2)}`;
}

/** Compact token count: 950 → "950", 8_210 → "8.2K", 1_250_000 → "1.3M". */
export function formatTokenCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Input→output tokens, e.g. "8.2K→1.3K". */
export function formatTokenSplit(tokensIn: number, tokensOut: number): string {
  return `${formatTokenCount(tokensIn)}→${formatTokenCount(tokensOut)}`;
}
