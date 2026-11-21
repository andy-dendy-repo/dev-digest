import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
  } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  sevGroup: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  /** Severity counter pill: border in the severity colour; filled when active;
   *  dimmed when another severity is the active filter. State-driven, not hover. */
  sevChip: (color: string, active: boolean, dimmed: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: active ? color : "transparent",
    color: active ? "var(--bg-primary)" : color,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    cursor: "pointer",
    opacity: dimmed ? 0.45 : 1,
    transition: "opacity .12s, background .12s",
  }),
} as const;
