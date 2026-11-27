import { describe, it, expect } from "vitest";
import type { PrReviewComment } from "@devdigest/shared";
import { buildThreads, commentTargetFor, keysForLine, partitionThreads } from "./comments";
import { lineReactKey, parsePatch } from "./helpers";

function comment(o: Partial<PrReviewComment> & { id: number }): PrReviewComment {
  return {
    path: "src/a.ts",
    line: 10,
    original_line: 10,
    side: "RIGHT",
    body: `comment ${o.id}`,
    user: "octocat",
    created_at: "2026-06-01T00:00:00Z",
    html_url: "https://github.com/x",
    in_reply_to_id: null,
    is_outdated: false,
    ...o,
  };
}

describe("buildThreads", () => {
  it("groups replies under their root, oldest first, anchored on the root's line", () => {
    const threads = buildThreads([
      comment({ id: 2, in_reply_to_id: 1, created_at: "2026-06-02T00:00:00Z", line: null }),
      comment({ id: 1, line: 12 }),
      comment({ id: 3, line: null, side: "LEFT" }),
    ]);
    expect(threads).toHaveLength(2);
    expect(threads[0]).toMatchObject({ rootId: 1, line: 12, side: "RIGHT", isOutdated: false });
    expect(threads[0]!.comments.map((c) => c.id)).toEqual([1, 2]);
    expect(threads[1]).toMatchObject({ rootId: 3, isOutdated: true });
  });
});

describe("line keys and targets", () => {
  const [hunk, ctx, del, add] = parsePatch("@@ -4,2 +4,2 @@\n same\n-old\n+new");

  it("lets context lines host threads on both sides, add/del on one", () => {
    expect(keysForLine(ctx!)).toEqual(["RIGHT:4", "LEFT:4"]);
    expect(keysForLine(del!)).toEqual(["LEFT:5"]);
    expect(keysForLine(add!)).toEqual(["RIGHT:5"]);
    expect(keysForLine(hunk!)).toEqual([]);
  });

  it("comments on the new line, or the old one for a deletion", () => {
    expect(commentTargetFor(add!)).toEqual({ line: 5, side: "RIGHT" });
    expect(commentTargetFor(del!)).toEqual({ line: 5, side: "LEFT" });
    expect(commentTargetFor(hunk!)).toBeNull();
  });

  it("gives every rendered line a distinct, position-based React key", () => {
    const keys = [hunk, ctx, del, add].map((l) => lineReactKey(l!));
    expect(new Set(keys).size).toBe(4);
    expect(lineReactKey(add!)).toBe("a:5");
  });
});

describe("partitionThreads", () => {
  it("matches threads to rendered lines and keeps the rest as outdated", () => {
    const threads = buildThreads([comment({ id: 1, line: 5 }), comment({ id: 2, line: 99 }), comment({ id: 3, line: null })]);
    const { matched, outdated } = partitionThreads(threads, new Set(["RIGHT:5"]));
    expect([...matched.keys()]).toEqual(["RIGHT:5"]);
    expect(outdated.map((t) => t.rootId)).toEqual([2, 3]);
  });
});
