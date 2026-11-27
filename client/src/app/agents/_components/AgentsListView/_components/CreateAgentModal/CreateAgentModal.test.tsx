import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({ push: vi.fn(), mutateAsync: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/lib/hooks/agents", () => ({
  useCreateAgent: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));

import { CreateAgentModal } from "./CreateAgentModal";

beforeEach(() => vi.clearAllMocks());

describe("CreateAgentModal", () => {
  it("creates the agent (default name when blank) and opens its editor", async () => {
    h.mutateAsync.mockResolvedValue({ id: "ag7" });
    const onClose = vi.fn();
    const { user } = renderWithProviders(<CreateAgentModal onClose={onClose} />);

    await user.type(screen.getByPlaceholderText("What this agent reviews"), "Checks auth");
    await user.click(screen.getByRole("button", { name: "Create agent" }));

    expect(h.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Agent", description: "Checks auth" }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(h.push).toHaveBeenCalledWith("/agents/ag7?tab=config");
  });

  it("closes without creating on Cancel", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(<CreateAgentModal onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });
});
