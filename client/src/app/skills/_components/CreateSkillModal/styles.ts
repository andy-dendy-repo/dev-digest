import type { CSSProperties } from "react";

/** Co-located styles for CreateSkillModal. */
export const s = {
  error: { fontSize: 13, color: "var(--crit)", marginTop: 4 } satisfies CSSProperties,
  footer: { display: "flex", gap: 10, justifyContent: "flex-end" } satisfies CSSProperties,
} as const;
