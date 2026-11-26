/** Constants for AgentCard. */

/** Model → chip colour token. Falls back to --text-secondary for unknown models. */
export const MODEL_COLOR: Record<string, string> = {
  "gpt-4.1": "var(--accent)",
  "gpt-4o": "var(--ok)",
  "gpt-4o-mini": "var(--violet)",
  o1: "var(--warn)",
};
