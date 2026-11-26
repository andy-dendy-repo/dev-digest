import { describe, it, expect, vi, afterEach } from "vitest";
import type { PrMeta } from "@devdigest/shared";
import { pullCounts, relativeTime, sizeOf, visiblePulls } from "./helpers";

function pr(o: Partial<PrMeta> & { number: number }): PrMeta {
  return {
    id: `pr-${o.number}`,
    title: `PR ${o.number}`,
    author: "octocat",
    branch: "feat/x",
    base: "main",
    head_sha: "abc",
    additions: 0,
    deletions: 0,
    files_count: 1,
    status: "needs_review",
    ...o,
  };
}

const PULLS = [
  pr({ number: 1, title: "Add Rate limiting", status: "needs_review", updated_at: "2026-06-01T00:00:00Z" }),
  pr({ number: 12, title: "Fix login", status: "reviewed", updated_at: "2026-06-03T00:00:00Z" }),
  pr({ number: 3, title: "Bump deps", status: "merged", updated_at: null }),
];

describe("visiblePulls", () => {
  it("filters by status, newest first; undated PRs sort last", () => {
    expect(visiblePulls(PULLS, { status: "all", query: "", sort: "newest" }).map((p) => p.number)).toEqual([12, 1, 3]);
    expect(visiblePulls(PULLS, { status: "reviewed", query: "", sort: "newest" }).map((p) => p.number)).toEqual([12]);
  });

  it("matches the title case-insensitively or the number", () => {
    expect(visiblePulls(PULLS, { status: "all", query: " rate ", sort: "newest" }).map((p) => p.number)).toEqual([1]);
    expect(visiblePulls(PULLS, { status: "all", query: "1", sort: "oldest" }).map((p) => p.number)).toEqual([1, 12]);
  });

  it("does not reorder the input", () => {
    const input = [...PULLS];
    visiblePulls(input, { status: "all", query: "", sort: "newest" });
    expect(input).toEqual(PULLS);
  });
});

describe("pullCounts", () => {
  it("counts open (derived review statuses) and needs-review PRs", () => {
    expect(pullCounts(PULLS)).toEqual({ open: 2, needsReview: 1 });
  });
});

describe("sizeOf", () => {
  it.each([
    [99, "S"],
    [100, "M"],
    [399, "M"],
    [400, "L"],
  ])("%i changed lines → %s", (lines, size) => {
    expect(sizeOf(pr({ number: 1, additions: lines, deletions: 0 }))).toEqual({ size, lines });
  });
});

describe("relativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("shows a dash for a missing or unparseable time", () => {
    expect(relativeTime(null)).toBe("—");
    expect(relativeTime("soon")).toBe("—");
  });

  it("rounds to minutes, hours and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
    expect(relativeTime("2026-06-10T11:59:50Z")).toBe("now");
    expect(relativeTime("2026-06-10T11:15:00Z")).toBe("45m");
    expect(relativeTime("2026-06-10T07:00:00Z")).toBe("5h");
    expect(relativeTime("2026-06-07T12:00:00Z")).toBe("3d");
  });
});
