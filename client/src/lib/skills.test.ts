import { describe, it, expect } from "vitest";
import { estimateTokens, needsVetting } from "./skills";

describe("skills domain", () => {
  it("an imported skill needs vetting until it is enabled; a manual one never does", () => {
    expect(needsVetting({ source: "imported_file", enabled: false })).toBe(true);
    expect(needsVetting({ source: "imported_file", enabled: true })).toBe(false);
    expect(needsVetting({ source: "manual", enabled: false })).toBe(false);
  });

  it("estimates ~4 characters per token, rounding up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
