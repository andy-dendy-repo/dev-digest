/**
 * PRRow — the PR list COST column (M1 run cost badge): the row renders the
 * PR's total cost (sum of completed runs, computed server-side) and "—" when
 * the PR has no costed run.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PrMeta } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

import { PRRow } from "./PRRow";

afterEach(() => {
  cleanup();
  push.mockClear();
});

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit-public",
    base: "main",
    head_sha: "a1b2c3d",
    additions: 247,
    deletions: 38,
    files_count: 9,
    status: "needs_review",
    opened_at: null,
    updated_at: null,
    score: 61,
    cost_usd: null,
    ...o,
  };
}

function renderRow(p: PrMeta) {
  return renderWithProviders(<PRRow pr={p} repoId="repo-1" />);
}

describe("PRRow — COST column", () => {
  it("shows the PR's total cost with ≥ 3 decimals", () => {
    renderRow(pr({ cost_usd: 0.0123 }));
    expect(screen.getByTestId("run-cost")).toHaveTextContent(/^\$0\.012$/);
  });

  it("shows '—' (not $0.00) when the PR has no costed run", () => {
    renderRow(pr({ cost_usd: null, score: null }));
    expect(screen.getByTestId("run-cost")).toHaveTextContent(/^—$/);
  });

  it("treats a missing field (older API) as no data", () => {
    const { cost_usd: _omit, ...legacy } = pr({});
    renderRow(legacy as PrMeta);
    expect(screen.getByTestId("run-cost")).toHaveTextContent(/^—$/);
  });
});

describe("PRRow — FINDINGS column", () => {
  const brief = (id: string, severity: "CRITICAL" | "WARNING" | "SUGGESTION", title: string) => ({
    id,
    severity,
    category: "security" as const,
    title,
    file: "src/config.ts",
    start_line: 12,
    end_line: 12,
    confidence: 0.98,
    rationale: "r",
  });

  it("shows the latest review's severity icons; clicking them opens the preview, not the PR", async () => {
    const user = userEvent.setup();
    renderRow(
      pr({
        latest_findings: [brief("c1", "CRITICAL", "Hardcoded Stripe key"), brief("w1", "WARNING", "N+1 query")],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Show 2 findings" }));
    expect(screen.getByRole("dialog", { name: "2 findings in this run" })).toBeInTheDocument();
    expect(screen.getByText("Hardcoded Stripe key")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    // The rest of the row still opens the PR.
    await user.click(screen.getByText("Add rate limiting to public API endpoints"));
    expect(push).toHaveBeenCalledWith("/repos/repo-1/pulls/482");
  });

  it("shows '—' for an unreviewed PR and for a review without findings", () => {
    renderRow(pr({ id: "a", latest_findings: null }));
    renderRow(pr({ id: "b", latest_findings: [] }));
    expect(screen.queryByRole("button", { name: /show/i })).not.toBeInTheDocument();
  });
});

