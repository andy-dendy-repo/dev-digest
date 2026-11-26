/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RunSummary } from "@devdigest/shared";
import type { FindingPreviewItem } from "@/components/findings-preview";
import { renderWithProviders } from "@/test/render";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[], findingsByRun?: Map<string, FindingPreviewItem[]>) {
  return renderWithProviders(<RunHistory runs={runs} onOpenTrace={() => {}} findingsByRun={findingsByRun} />);
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — run cost badge (M1)", () => {
  it("a done run shows total tokens · cost", () => {
    renderRuns([run({ status: "done", tokens_in: 9000, tokens_out: 119, cost_usd: 0.0013 })]);
    expect(screen.getByTitle(/^Run cost/)).toHaveTextContent("9,119 tok · $0.0013");
  });

  it("a done run without a known cost shows '—', never $0.00", () => {
    renderRuns([run({ status: "done", cost_usd: null })]);
    expect(screen.getByTitle(/^Run cost/)).toHaveTextContent(/^—$/);
  });

  it("running / failed runs show no price at all", () => {
    renderRuns([
      run({ run_id: "a", status: "running", cost_usd: 0.5 }),
      run({ run_id: "b", status: "failed", error: "boom", cost_usd: 0.5 }),
    ]);
    expect(screen.queryByTestId("run-cost")).not.toBeInTheDocument();
  });
});

describe("RunHistory — severity icons + findings preview (M1)", () => {
  const finding = (id: string, severity: FindingPreviewItem["severity"], title: string): FindingPreviewItem => ({
    id,
    severity,
    category: "perf",
    title,
    file: "src/api/users.ts",
    start_line: 46,
    end_line: 46,
    confidence: 0.86,
    rationale: "r",
  });

  it("a run with findings shows severity icons that open its preview; a run without keeps the text", async () => {
    const user = userEvent.setup();
    renderRuns(
      [
        run({ run_id: "with", findings_count: 2, blockers: 0 }),
        run({ run_id: "without", agent_name: "General Reviewer", findings_count: 0, blockers: 0 }),
      ],
      new Map([["with", [finding("f1", "WARNING", "N+1 query"), finding("f2", "SUGGESTION", "Magic number")]]]),
    );

    expect(screen.getByText("0 finding(s)")).toBeInTheDocument();
    expect(screen.queryByText("2 finding(s)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show 2 findings" }));
    expect(screen.getByRole("dialog", { name: "2 findings in this run" })).toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
  });
});

