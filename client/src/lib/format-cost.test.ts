import { describe, it, expect } from "vitest";
import { costParts, secondsOf, tokenParts } from "./format-cost";

describe("costParts", () => {
  it("no data is 'none', never a fake $0.00", () => {
    expect(costParts(null)).toEqual({ kind: "none" });
    expect(costParts(undefined)).toEqual({ kind: "none" });
    expect(costParts(Number.NaN)).toEqual({ kind: "none" });
  });

  it("a genuinely free run is 0", () => {
    expect(costParts(0)).toEqual({ kind: "usd", amount: "0" });
  });

  it("keeps ≥ 3 decimals for cents-level values (0.012, not 0.01)", () => {
    expect(costParts(0.0123)).toEqual({ kind: "usd", amount: "0.012" });
    expect(costParts(0.014)).toEqual({ kind: "usd", amount: "0.014" });
    expect(costParts(0.041)).toEqual({ kind: "usd", amount: "0.041" });
  });

  it("uses 2 significant digits below a cent", () => {
    expect(costParts(0.00131)).toEqual({ kind: "usd", amount: "0.0013" });
    expect(costParts(0.0014)).toEqual({ kind: "usd", amount: "0.0014" });
    expect(costParts(0.00004)).toEqual({ kind: "below", amount: "0.0001" });
  });

  it("uses 2 decimals from $1", () => {
    expect(costParts(1.234)).toEqual({ kind: "usd", amount: "1.23" });
  });
});

describe("tokenParts", () => {
  it("compacts counts", () => {
    expect(tokenParts(950)).toEqual({ value: "950", unit: "" });
    expect(tokenParts(8210)).toEqual({ value: "8.2", unit: "k" });
    expect(tokenParts(1_250_000)).toEqual({ value: "1.3", unit: "m" });
  });
});

describe("secondsOf", () => {
  it("keeps one decimal", () => {
    expect(secondsOf(1234)).toBe("1.2");
  });
});
