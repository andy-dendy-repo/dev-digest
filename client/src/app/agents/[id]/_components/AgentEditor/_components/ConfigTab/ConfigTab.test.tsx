import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { Agent } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({
  mutate: vi.fn(),
  models: [{ id: "gpt-4.1", provider: "openai" }] as unknown[] | undefined,
}));
vi.mock("@/lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate: h.mutate, isPending: false, isSuccess: false, data: undefined }),
  useProviderModels: () => ({ data: h.models }),
}));

import { ConfigTab } from "./ConfigTab";

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.models = [{ id: "gpt-4.1", provider: "openai" }];
});

describe("ConfigTab", () => {
  it("saves the edited fields and confirms with a toast", async () => {
    h.mutate.mockImplementation((_input, opts) => opts?.onSuccess?.({ ...AGENT, version: 4 }));
    const { user } = renderWithProviders(<ConfigTab agent={AGENT} />);

    const name = screen.getByDisplayValue("Security Reviewer");
    await user.clear(name);
    await user.type(name, "Secrets Reviewer");
    // The header "Enabled" switch comes first (Toggle has no accessible name).
    await user.click(screen.getAllByRole("switch")[0]!);
    await user.click(screen.getByRole("button", { name: "Save agent" }));

    expect(h.mutate).toHaveBeenCalledWith(
      {
        id: "ag1",
        patch: expect.objectContaining({ name: "Secrets Reviewer", enabled: false, model: "gpt-4.1" }),
      },
      expect.anything(),
    );
    expect(await screen.findByText("Agent saved (v4)")).toBeInTheDocument();
  });

  it("points to Settings when the provider returns no models", () => {
    h.models = [];
    renderWithProviders(<ConfigTab agent={AGENT} />);
    expect(
      screen.getByText("No models loaded — set the openai API key in Settings → API Keys."),
    ).toBeInTheDocument();
  });
});
