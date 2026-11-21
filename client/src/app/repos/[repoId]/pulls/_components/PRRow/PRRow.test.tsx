/**
 * PRRow — the PR list COST column (M1 run cost badge): the row renders the
 * PR's total cost (sum of completed runs, computed server-side) and "—" when
 * the PR has no costed run.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { PRRow } from "./PRRow";

afterEach(cleanup);

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
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={p} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
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
