import type { CSSProperties } from "react";

/** Co-located styles for the agent SkillsTab. */
export const s = {
  wrap: { maxWidth: 1000 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  filter: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    width: 260,
  } satisfies CSSProperties,
  filterIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  filterInput: {
    flex: 1,
    fontSize: 13,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", marginBottom: 16 } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  row: (dragOver: boolean, dimmed: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid " + (dragOver ? "var(--accent)" : "var(--border)"),
    background: "var(--bg-elevated)",
    opacity: dimmed ? 0.55 : 1,
  }),
  handle: (disabled: boolean): CSSProperties => ({
    display: "inline-flex",
    padding: 2,
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: disabled ? "default" : "grab",
  }),
  name: { fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0 } satisfies CSSProperties,
  off: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  /** Visually hidden, still read by screen readers (the checkbox's name). */
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
} as const;
