import type { CSSProperties } from "react";

const LINE_HEIGHT = 20;

/** Co-located styles for MarkdownEditor. Gutter and textarea share one line height. */
export const s = {
  frame: {
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    background: "var(--code-bg)",
    overflow: "hidden",
  } satisfies CSSProperties,
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 12,
  } satisfies CSSProperties,
  filename: { color: "var(--text-secondary)" } satisfies CSSProperties,
  tokens: { marginLeft: "auto", color: "var(--text-muted)" } satisfies CSSProperties,
  scroller: { display: "flex", overflow: "auto", maxHeight: 520 } satisfies CSSProperties,
  gutter: {
    flexShrink: 0,
    padding: "10px 10px 10px 12px",
    textAlign: "right",
    color: "var(--text-muted)",
    fontSize: 13,
    lineHeight: `${LINE_HEIGHT}px`,
    userSelect: "none",
    borderRight: "1px solid var(--border)",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    fontSize: 13,
    lineHeight: `${LINE_HEIGHT}px`,
    border: "none",
    outline: "none",
    resize: "none",
    background: "transparent",
    color: "var(--text-primary)",
    whiteSpace: "pre",
    overflow: "hidden",
  } satisfies CSSProperties,
} as const;
