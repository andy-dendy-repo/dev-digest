import { describe, it, expect } from "vitest";
import { formatCost, formatTokenCount, formatTokenSplit } from "./format-cost";

describe("formatCost", () => {
  it("no data is '—', never a fake $0.00", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(undefined)).toBe("—");
    expect(formatCost(Number.NaN)).toBe("—");
  });

  it("a genuinely free run is $0", () => {
    expect(formatCost(0)).toBe("$0");
  });

  it("keeps ≥ 3 decimals for cents-level values ($0.012, not $0.01)", () => {
    expect(formatCost(0.0123)).toBe("$0.012");
    expect(formatCost(0.014)).toBe("$0.014");
    expect(formatCost(0.041)).toBe("$0.041");
  });

  it("uses 2 significant digits below a cent", () => {
    expect(formatCost(0.00131)).toBe("$0.0013");
    expect(formatCost(0.0014)).toBe("$0.0014");
    expect(formatCost(0.00004)).toBe("<$0.0001");
  });

  it("uses 2 decimals from $1", () => {
    expect(formatCost(1.234)).toBe("$1.23");
  });
});

describe("token formatting", () => {
  it("compacts counts", () => {
    expect(formatTokenCount(950)).toBe("950");
    expect(formatTokenCount(8210)).toBe("8.2K");
    expect(formatTokenCount(1_250_000)).toBe("1.3M");
  });

  it("formats an in→out split", () => {
    expect(formatTokenSplit(8210, 1290)).toBe("8.2K→1.3K");
  });
});
