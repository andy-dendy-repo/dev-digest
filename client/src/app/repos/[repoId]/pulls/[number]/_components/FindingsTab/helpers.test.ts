import { describe, it, expect } from "vitest";
import { finding, review, runSummary } from "../test-fixtures";
import { findingsByRun, lethalTrifectaFindings, runsById } from "./helpers";

describe("FindingsTab helpers", () => {
  const reviews = [
    review({ id: "1", run_id: "run-1", findings: [finding({ id: "a", kind: "lethal_trifecta" }), finding({ id: "b" })] }),
    review({ id: "2", run_id: null, findings: [finding({ id: "c", kind: "lethal_trifecta" })] }),
  ];

  it("collects lethal-trifecta findings from every run", () => {
    expect(lethalTrifectaFindings(reviews).map((f) => f.id)).toEqual(["a", "c"]);
  });

  it("indexes findings by run, skipping reviews without a run", () => {
    const byRun = findingsByRun(reviews);
    expect([...byRun.keys()]).toEqual(["run-1"]);
    expect(byRun.get("run-1")?.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("indexes runs by id", () => {
    expect(runsById([runSummary({ run_id: "r1" })]).get("r1")?.run_id).toBe("r1");
  });
});
