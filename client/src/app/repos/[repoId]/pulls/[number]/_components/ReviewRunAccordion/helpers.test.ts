import { describe, it, expect } from "vitest";
import { countBlockers, formatWhen } from "./helpers";

describe("countBlockers", () => {
  it("counts CRITICAL findings that are not dismissed", () => {
    expect(
      countBlockers([
        { severity: "CRITICAL", dismissed_at: null },
        { severity: "CRITICAL", dismissed_at: "2026-06-11T00:00:00Z" },
        { severity: "WARNING", dismissed_at: null },
      ]),
    ).toBe(1);
  });
});

describe("formatWhen", () => {
  it("keeps an unparseable timestamp as is", () => {
    expect(formatWhen("not a date")).toBe("not a date");
  });
});
