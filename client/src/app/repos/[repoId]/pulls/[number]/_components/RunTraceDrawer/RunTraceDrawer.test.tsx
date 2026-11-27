import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import type { RunTrace } from "@devdigest/shared";

// Mock the trace hooks so the drawer renders without a query client / SSE.
const TRACE: RunTrace = {
  config: { agent: "Security", version: "1", provider: "openai", model: "gpt-4.1", pr: 482, source: "local" },
  stats: { duration_ms: 8200, tokens_in: 12000, tokens_out: 1500, cost_usd: 0.0123, findings: 2, grounding: "2/2 passed" },
  prompt_assembly: {
    system: "You are a reviewer.",
    skills: "### test-corner-cases",
    memory: null,
    specs: null,
    user: "Review PR #482",
    section_tokens: { system: 40, skills: 212, user: 900 },
    skills_detail: [{ id: "s1", name: "test-corner-cases", version: 3, tokens: 212 }],
  },
  tool_calls: [{ tool: "review_file", args: "src/config.ts", meta: "single-pass", ms: 1200 }],
  raw_output: '{"verdict":"request_changes"}',
  memory_pulled: [{ pr: 471, text: "rate-limit public endpoints" }],
  specs_read: [],
  log: [
    { t: "00.10", kind: "info", msg: "Starting review with agent Security" },
    { t: "00.90", kind: "result", msg: "Citation grounding: 2/2 passed" },
  ],
};

vi.mock("@/lib/hooks/trace", () => ({
  useRunTrace: () => ({ data: TRACE, isLoading: false }),
}));
vi.mock("@/lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running: false }),
}));

import { RunTraceDrawer } from "./RunTraceDrawer";

afterEach(cleanup);

const renderDrawer = () =>
  renderWithProviders(
    <div data-theme="dark">
      <RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />
    </div>,
  );

describe("A5 Run Trace drawer (smoke)", () => {
  it("renders the trace tabs and stats", () => {
    renderDrawer();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();
    expect(screen.getByText("2/2 passed")).toBeInTheDocument();
    expect(screen.getByText("Tool calls")).toBeInTheDocument();
    // M1 run cost badge — COST stat with ≥ 3 decimals
    expect(screen.getByText("COST")).toBeInTheDocument();
    expect(screen.getByText("$0.012")).toBeInTheDocument();
    // duration and tokens use the shared formatters (one token style app-wide)
    expect(screen.getByText("8.2s")).toBeInTheDocument();
    expect(screen.getByText("12.0K→1.5K")).toBeInTheDocument();
  });

  it("prompt assembly shows tokens per block and the skills in the skills block", async () => {
    const { user } = renderDrawer();
    await user.click(screen.getByText("Prompt assembly"));
    expect(screen.getByText("Skills (dynamic)")).toBeInTheDocument();
    expect(screen.getByText("212 tok")).toBeInTheDocument();
    expect(screen.getByText("40 tok")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Skills in this prompt" });
    expect(list).toHaveTextContent("test-corner-cases · v3 · 212 tok");
  });

  it("switches to the live log tab", async () => {
    const { user } = renderDrawer();
    await user.click(screen.getByText("log"));
    // LiveLogStream renders its filter input
    expect(screen.getByPlaceholderText("Filter log…")).toBeInTheDocument();
  });
});
