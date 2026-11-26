import { describe, it, expect } from "vitest";
import type { PrMeta } from "@devdigest/shared";
import { finding, review } from "../test-fixtures";
import { countFindings, prDetailHref, prIdForNumber } from "./helpers";

describe("prIdForNumber", () => {
  it("resolves the PR number to its row id, null until the list loads", () => {
    const pulls = [{ id: "uuid-482", number: 482 }] as PrMeta[];
    expect(prIdForNumber(pulls, 482)).toBe("uuid-482");
    expect(prIdForNumber(pulls, 1)).toBeNull();
    expect(prIdForNumber(undefined, 482)).toBeNull();
  });
});

describe("countFindings", () => {
  it("adds up findings of every run", () => {
    expect(
      countFindings([
        review({ id: "1", findings: [finding({ id: "a" })] }),
        review({ id: "2", findings: [finding({ id: "b" }), finding({ id: "c" })] }),
      ]),
    ).toBe(3);
  });
});

describe("prDetailHref", () => {
  it("sets a param and keeps the others", () => {
    expect(prDetailHref("r1", 482, new URLSearchParams("tab=findings"), "trace", "run-1")).toBe(
      "/repos/r1/pulls/482?tab=findings&trace=run-1",
    );
  });

  it("drops the query string when the last param is removed", () => {
    expect(prDetailHref("r1", 482, new URLSearchParams("trace=run-1"), "trace", null)).toBe(
      "/repos/r1/pulls/482",
    );
  });
});
