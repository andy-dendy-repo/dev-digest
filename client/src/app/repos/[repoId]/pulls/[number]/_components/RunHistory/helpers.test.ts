import { describe, it, expect } from "vitest";
import type { PrCommit } from "@devdigest/shared";
import { runSummary } from "../test-fixtures";
import { outcomeOf, timelineItems, tsOf } from "./helpers";

describe("outcomeOf", () => {
  it.each([
    [{ status: "running" }, "running"],
    [{ status: "failed" }, "error"],
    [{ status: "cancelled" }, "cancelled"],
    [{ status: "done", blockers: 2, findings_count: 5 }, "rejected"],
    [{ status: "done", blockers: 0, findings_count: 3 }, "reviewed"],
    [{ status: "done", blockers: null, findings_count: 0 }, "approved"],
  ] as const)("%o → %s", (run, outcome) => {
    expect(outcomeOf(runSummary({ run_id: "r", ...run }))).toBe(outcome);
  });
});

describe("timelineItems", () => {
  const commit = (sha: string, committed_at: string | null): PrCommit =>
    ({ sha, message: sha, author: "a", committed_at }) as PrCommit;

  it("interleaves runs and commits newest first, undated last", () => {
    const items = timelineItems(
      [runSummary({ run_id: "r1", ran_at: "2026-06-02T00:00:00Z" })],
      [commit("c-old", "2026-06-01T00:00:00Z"), commit("c-new", "2026-06-03T00:00:00Z"), commit("c-none", null)],
    );
    expect(items.map((i) => (i.kind === "run" ? i.run.run_id : i.commit.sha))).toEqual([
      "c-new",
      "r1",
      "c-old",
      "c-none",
    ]);
  });

  it("treats an unparseable timestamp as undated", () => {
    expect(tsOf("yesterday")).toBe(0);
  });
});
