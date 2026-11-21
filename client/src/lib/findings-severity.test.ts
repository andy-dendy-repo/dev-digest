import { describe, it, expect } from "vitest";
import { bySeverityThenConfidence, countBySeverity } from "./findings-severity";

describe("findings-severity", () => {
  it("counts every severity and reports 0 for missing ones", () => {
    expect(
      countBySeverity([{ severity: "WARNING" }, { severity: "CRITICAL" }, { severity: "WARNING" }]),
    ).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 0 });
    expect(countBySeverity([])).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
  });

  it("orders most severe first, then by confidence", () => {
    const items = [
      { id: "s", severity: "SUGGESTION" as const, confidence: 0.99 },
      { id: "w-low", severity: "WARNING" as const, confidence: 0.6 },
      { id: "c", severity: "CRITICAL" as const, confidence: 0.5 },
      { id: "w-high", severity: "WARNING" as const, confidence: 0.9 },
    ];
    expect([...items].sort(bySeverityThenConfidence).map((i) => i.id)).toEqual(["c", "w-high", "w-low", "s"]);
  });
});
