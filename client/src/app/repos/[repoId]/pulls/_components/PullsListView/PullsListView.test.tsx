import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { PrMeta } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({
  search: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  pulls: [] as unknown[],
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => h.search,
  useRouter: () => ({ replace: h.replace, push: h.push }),
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { id: "repo-1", full_name: "acme/api" } }),
  useRepoNotFound: () => false,
}));
vi.mock("@/lib/hooks/pulls", () => ({
  usePulls: () => ({ data: h.pulls, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/lib/hooks/repos", () => ({
  useRefreshRepo: () => ({ mutate: h.refresh, isPending: false }),
}));

import { PullsListView } from "./PullsListView";

const PullsPage = () => <PullsListView repoId="repo-1" />;

function pr(o: Partial<PrMeta> & { number: number }): PrMeta {
  return {
    id: `pr-${o.number}`,
    title: `PR ${o.number}`,
    author: "octocat",
    branch: "feat/x",
    base: "main",
    head_sha: "abc",
    additions: 1,
    deletions: 1,
    files_count: 1,
    status: "needs_review",
    opened_at: null,
    updated_at: null,
    score: null,
    cost_usd: null,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.search = new URLSearchParams();
  h.pulls = [
    pr({ number: 1, title: "Add rate limiting", status: "needs_review", updated_at: "2026-06-01T10:00:00Z" }),
    pr({ number: 2, title: "Fix login", status: "reviewed", updated_at: "2026-06-03T10:00:00Z" }),
    pr({ number: 3, title: "Bump deps", status: "needs_review", updated_at: "2026-06-02T10:00:00Z" }),
    pr({ number: 4, title: "Old work", status: "merged", updated_at: "2026-05-01T10:00:00Z" }),
  ];
});

const titles = () => screen.getAllByText(/^(Add rate limiting|Fix login|Bump deps|Old work)$/).map((e) => e.textContent);

describe("PullsListView", () => {
  it("counts open and needs-review PRs", () => {
    renderWithProviders(<PullsPage />);
    expect(screen.getByText("3 open · 2 need review")).toBeInTheDocument();
  });

  it("shows only PRs that need review by default, newest first", () => {
    renderWithProviders(<PullsPage />);
    expect(titles()).toEqual(["Bump deps", "Add rate limiting"]);
  });

  it("keeps the status filter in the URL", async () => {
    const { user } = renderWithProviders(<PullsPage />);
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(h.replace).toHaveBeenCalledWith("/repos/repo-1/pulls?status=all");
  });

  it("filters by title or number and sorts oldest first", async () => {
    h.search = new URLSearchParams("status=all");
    const { user } = renderWithProviders(<PullsPage />);
    expect(titles()).toEqual(["Fix login", "Bump deps", "Add rate limiting", "Old work"]);

    await user.selectOptions(screen.getByRole("combobox"), "oldest");
    expect(titles()).toEqual(["Old work", "Add rate limiting", "Bump deps", "Fix login"]);

    await user.type(screen.getByPlaceholderText("Filter pull requests…"), "2");
    expect(titles()).toEqual(["Fix login"]);
  });

  it("explains an empty filter", () => {
    h.search = new URLSearchParams("status=stale");
    renderWithProviders(<PullsPage />);
    expect(screen.getByText("No PRs with status “stale”.")).toBeInTheDocument();
  });

  it("refreshes the repo from GitHub", async () => {
    const { user } = renderWithProviders(<PullsPage />);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(h.refresh).toHaveBeenCalledWith("repo-1");
  });
});
