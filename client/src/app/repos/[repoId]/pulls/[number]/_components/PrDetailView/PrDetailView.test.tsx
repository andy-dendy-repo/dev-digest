import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { PrDetail, PrMeta } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";
import { finding, review, runSummary } from "../test-fixtures";

const h = vi.hoisted(() => ({
  search: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  deleteRun: vi.fn(),
  detail: {} as { data?: unknown; isLoading: boolean; isError: boolean; error?: unknown },
  repoNotFound: false,
  reviews: [] as unknown[],
  activeRuns: [] as unknown[],
  prRuns: [] as unknown[],
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ repoId: "repo-1", number: "482" }),
  useSearchParams: () => h.search,
  useRouter: () => ({ replace: h.replace, push: h.push }),
  usePathname: () => "/repos/repo-1/pulls/482",
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { id: "repo-1", full_name: "acme/api" } }),
  useRepoNotFound: () => h.repoNotFound,
}));
vi.mock("@/lib/hooks/pulls", () => ({
  usePulls: () => ({ data: [{ id: "pr-uuid", number: 482 } as PrMeta], isLoading: false }),
  usePullDetail: () => ({ ...h.detail, refetch: h.refetch }),
  usePrComments: () => ({ data: [] }),
  useCreatePrComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/hooks/agents", () => ({ useAgents: () => ({ data: [] }) }));
vi.mock("@/lib/hooks/trace", () => ({ useRunTrace: () => ({ data: undefined, isLoading: false }) }));
vi.mock("@/lib/hooks/reviews", () => ({
  runKeys: {
    active: (id: string) => ["runs", "active", id],
    history: (id: string) => ["runs", "history", id],
  },
  usePrReviews: () => ({ data: h.reviews, refetch: vi.fn() }),
  usePrActiveRuns: () => ({ data: h.activeRuns }),
  usePrRuns: () => ({ data: h.prRuns }),
  useDeleteRun: () => ({ mutate: h.deleteRun }),
  useCancelRun: () => ({ mutate: vi.fn(), isPending: false }),
  useRunEvents: () => ({ events: [], running: false }),
  useRunReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: vi.fn(), isPending: false }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import PRDetailPage from "../../page";

const PR: PrDetail = {
  id: "pr-uuid",
  number: 482,
  title: "Add rate limiting",
  author: "octocat",
  branch: "feat/rate-limit",
  base: "main",
  head_sha: "abc123",
  additions: 10,
  deletions: 2,
  files_count: 1,
  status: "open",
  body: "Adds a limiter to the public API.",
  files: [],
  commits: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  h.search = new URLSearchParams();
  h.detail = { data: PR, isLoading: false, isError: false };
  h.repoNotFound = false;
  h.reviews = [];
  h.activeRuns = [];
  h.prRuns = [];
});

describe("PR detail page", () => {
  it("shows the PR with its description on the overview tab", () => {
    renderWithProviders(<PRDetailPage />);
    expect(screen.getByText("#482")).toBeInTheDocument();
    expect(screen.getByText("Add rate limiting")).toBeInTheDocument();
    expect(screen.getByText("Adds a limiter to the public API.")).toBeInTheDocument();
  });

  it("keeps the selected tab in the URL", async () => {
    const { user } = renderWithProviders(<PRDetailPage />);
    await user.click(screen.getByRole("button", { name: /Agent runs/ }));
    expect(h.replace).toHaveBeenCalledWith("/repos/repo-1/pulls/482?tab=findings");
  });

  it("counts findings of every review run in the Agent runs tab", () => {
    h.reviews = [
      review({ id: "1", findings: [finding({ id: "f1" })] }),
      review({ id: "2", findings: [finding({ id: "f2" }), finding({ id: "f3" })] }),
    ];
    renderWithProviders(<PRDetailPage />);
    expect(screen.getByRole("button", { name: /Agent runs/ })).toHaveTextContent("3");
  });

  it("deletes a run from the timeline only after confirmation", async () => {
    h.search = new URLSearchParams("tab=findings");
    h.prRuns = [runSummary({ run_id: "run-1" })];
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { user } = renderWithProviders(<PRDetailPage />);

    await user.click(screen.getByRole("button", { name: "Delete run" }));
    expect(h.deleteRun).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete run" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(h.deleteRun).toHaveBeenCalledWith("run-1");
  });

  it("opens the run trace drawer from the trace query param and closes it", async () => {
    h.search = new URLSearchParams("tab=findings&trace=run-1");
    const { user } = renderWithProviders(<PRDetailPage />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(h.replace).toHaveBeenCalledWith("/repos/repo-1/pulls/482?tab=findings");
  });

  it("offers a retry when the PR cannot be loaded", async () => {
    h.detail = { data: undefined, isLoading: false, isError: true, error: new Error("boom") };
    const { user } = renderWithProviders(<PRDetailPage />);
    expect(screen.getByText("Couldn't load this pull request")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("shows the repo-not-found state for an unknown repo", () => {
    h.repoNotFound = true;
    renderWithProviders(<PRDetailPage />);
    expect(screen.getByText("No repo selected")).toBeInTheDocument();
    expect(screen.queryByText("Add rate limiting")).not.toBeInTheDocument();
  });
});
