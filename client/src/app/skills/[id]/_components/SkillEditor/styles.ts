import type { CSSProperties } from "react";

/** Co-located styles for the SkillEditor shell. */
export const s = {
  header: { display: "flex", alignItems: "center", gap: 10, padding: "16px 28px 0", flexWrap: "wrap" } satisfies CSSProperties,
  icon: { color: "var(--accent)" } satisfies CSSProperties,
  name: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  enabled: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  tabsBar: { marginTop: 14 } satisfies CSSProperties,
  body: { padding: 28 } satisfies CSSProperties,
} as const;
