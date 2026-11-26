import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { PrDetail } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/agents", () => ({ useAgents: () => ({ data: [] }) }));
vi.mock("@/lib/hooks/reviews", () => ({ useRunReview: () => ({ mutateAsync: vi.fn(), isPending: false }) }));

import { PrDetailHeader } from "./PrDetailHeader";

const PR: PrDetail = {
  id: "pr-1",
  number: 482,
  title: "Add rate limiting",
  author: "octocat",
  branch: "feat/limit",
  base: "main",
  head_sha: "abc",
  additions: 12,
  deletions: 3,
  files_count: 4,
  status: "open",
  files: [],
  commits: [],
};

function renderHeader(props: Partial<React.ComponentProps<typeof PrDetailHeader>> = {}) {
  const onSetTab = vi.fn();
  const utils = renderWithProviders(
    <PrDetailHeader
      pr={PR}
      prId="pr-1"
      tab="overview"
      findingsCount={0}
      githubUrl="https://github.com/acme/api/pull/482"
      onSetTab={onSetTab}
      onRunStart={vi.fn()}
      onRunsStarted={vi.fn()}
      {...props}
    />,
  );
  return { ...utils, onSetTab };
}

describe("PrDetailHeader", () => {
  it("shows the PR and switches tabs, with counts on Agent runs and Files changed", async () => {
    const { user, onSetTab } = renderHeader({ findingsCount: 3 });
    expect(screen.getByRole("heading", { name: /#482\s*Add rate limiting/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agent runs/ })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /Files changed/ })).toHaveTextContent("4");

    await user.click(screen.getByRole("button", { name: /Files changed/ }));
    expect(onSetTab).toHaveBeenCalledWith("diff");
  });

  it("opens the PR on GitHub in a new tab, disabled until the URL is known", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { user, unmount } = renderHeader();
    await user.click(screen.getByRole("button", { name: "View on GitHub" }));
    expect(open).toHaveBeenCalledWith("https://github.com/acme/api/pull/482", "_blank", "noopener,noreferrer");
    unmount();

    renderHeader({ githubUrl: null });
    expect(screen.getByRole("button", { name: "View on GitHub" })).toBeDisabled();
  });

  it("warns that reviewing a merged PR is informational", () => {
    renderHeader({ pr: { ...PR, status: "merged" } });
    expect(
      screen.getByText("This PR is already merged — running a review is informational and won't affect the merged code."),
    ).toBeInTheDocument();
  });
});
