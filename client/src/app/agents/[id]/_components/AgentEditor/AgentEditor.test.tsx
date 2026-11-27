import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import type { Agent } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

// Mock the data hooks so the editor renders without a network/query client.
vi.mock("@/lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, data: undefined }),
  useProviderModels: () => ({ data: [{ id: "gpt-4.1", provider: "openai" }] }),
}));

import { AgentEditor } from "./AgentEditor";

afterEach(cleanup);

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

describe("A2 Agent Editor (smoke)", () => {
  it("renders the Config tab fields", () => {
    renderWithProviders(<AgentEditor agent={AGENT} tab="config" onTab={() => {}} />);
    expect(screen.getByText("Config")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Save agent")).toBeInTheDocument();
  });
});

describe("A2 Agent Editor — switching agents", () => {
  const wrap = (agent: Agent) => <AgentEditor agent={agent} tab="config" onTab={() => {}} />;

  it("discards unsaved edits and shows the new agent's values", async () => {
    const { user, rerender } = renderWithProviders(wrap(AGENT));
    const name = screen.getByDisplayValue("Security Reviewer");
    await user.clear(name);
    await user.type(name, "Unsaved draft");
    expect(screen.getByDisplayValue("Unsaved draft")).toBeInTheDocument();

    rerender(wrap({ ...AGENT, id: "ag2", name: "Perf Reviewer", system_prompt: "Find slow code." }));

    expect(screen.getByDisplayValue("Perf Reviewer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Find slow code.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Unsaved draft")).not.toBeInTheDocument();
  });

  it("keeps edits when the same agent re-renders (e.g. a refetch)", async () => {
    const { user, rerender } = renderWithProviders(wrap(AGENT));
    const name = screen.getByDisplayValue("Security Reviewer");
    await user.clear(name);
    await user.type(name, "Draft");
    rerender(wrap({ ...AGENT }));
    expect(screen.getByDisplayValue("Draft")).toBeInTheDocument();
  });
});
