import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { PrFile, PrReviewComment } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const COMMENT: PrReviewComment = {
  id: 1,
  path: "src/a.ts",
  line: 2,
  original_line: 2,
  side: "RIGHT",
  body: "Why a constant here?",
  user: "octocat",
  created_at: "2026-06-01T00:00:00Z",
  html_url: "https://github.com/x",
  in_reply_to_id: null,
  is_outdated: false,
};
vi.mock("@/lib/hooks/pulls", () => ({
  usePrComments: () => ({ data: [COMMENT] }),
  useCreatePrComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { DiffTab } from "./DiffTab";

const FILES: PrFile[] = [
  { path: "src/a.ts", additions: 1, deletions: 0, patch: "@@ -1,1 +1,2 @@\n const a = 1;\n+const b = 2;" },
];

describe("DiffTab", () => {
  it("titles the diff and keeps GitHub comments hidden until asked", async () => {
    const { user } = renderWithProviders(<DiffTab prId="pr-1" filesCount={1} files={FILES} canComment />);
    expect(screen.getByText("Files changed · 1 files")).toBeInTheDocument();
    expect(screen.queryByText("Why a constant here?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show comments (1)" }));
    expect(screen.getByText("Why a constant here?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide comments (1)" })).toBeInTheDocument();
  });
});
