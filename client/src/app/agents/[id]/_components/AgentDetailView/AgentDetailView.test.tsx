import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { Agent } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({
  search: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
  refetch: vi.fn(),
  update: vi.fn(),
  agent: {} as { data?: unknown; isLoading: boolean; isError: boolean; error?: unknown },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ag1" }),
  useSearchParams: () => h.search,
  useRouter: () => ({ replace: h.replace, push: h.push }),
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: [AGENT, OTHER] }),
  useAgent: () => ({ ...h.agent, refetch: h.refetch }),
  useUpdateAgent: () => ({ mutate: h.update, isPending: false, isSuccess: false }),
  useDeleteAgent: () => ({ mutate: vi.fn(), isPending: false }),
  useProviderModels: () => ({ data: [{ id: "gpt-4.1", provider: "openai" }] }),
}));

import AgentEditorPage from "../../page";

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
const OTHER: Agent = { ...AGENT, id: "ag2", name: "Style Reviewer", enabled: false };

beforeEach(() => {
  vi.clearAllMocks();
  h.search = new URLSearchParams();
  h.agent = { data: AGENT, isLoading: false, isError: false };
});

describe("Agent detail page", () => {
  it("shows the agent's header and its config editor", () => {
    renderWithProviders(<AgentEditorPage />);
    expect(screen.getByRole("heading", { name: "Security Reviewer" })).toBeInTheDocument();
    expect(screen.getByText("openai/gpt-4.1", { selector: "span *, span" })).toBeInTheDocument();
    expect(screen.getByText("Save agent")).toBeInTheDocument();
  });

  it("lists every agent and opens another one on the same tab", async () => {
    const { user } = renderWithProviders(<AgentEditorPage />);
    await user.click(screen.getByText("Style Reviewer"));
    expect(h.push).toHaveBeenCalledWith("/agents/ag2?tab=config");
  });

  it("marks a disabled agent", () => {
    h.agent = { data: OTHER, isLoading: false, isError: false };
    renderWithProviders(<AgentEditorPage />);
    expect(screen.getByText("disabled")).toBeInTheDocument();
  });

  it("offers a retry when the agent cannot be loaded", async () => {
    h.agent = { data: undefined, isLoading: false, isError: true, error: new Error("boom") };
    const { user } = renderWithProviders(<AgentEditorPage />);
    expect(screen.getByText("Couldn’t load this agent")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(h.refetch).toHaveBeenCalled();
  });
});
