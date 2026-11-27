import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { ApiError } from "@/lib/api";

const h = vi.hoisted(() => ({ push: vi.fn(), mutateAsync: vi.fn(), isPending: false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/lib/hooks/repos", () => ({
  useAddRepo: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));

import { AddRepoView } from "./AddRepoView";

beforeEach(() => {
  vi.clearAllMocks();
  h.isPending = false;
});

const urlInput = () => screen.getByPlaceholderText("https://github.com/owner/repo");

describe("AddRepoView", () => {
  it("adds the repository and opens its PR list", async () => {
    h.mutateAsync.mockResolvedValue({ id: "repo-9" });
    const { user } = renderWithProviders(<AddRepoView />);

    const add = screen.getByRole("button", { name: "Add repository" });
    expect(add).toBeDisabled();
    await user.type(urlInput(), "  https://github.com/acme/api  ");
    await user.click(add);

    expect(h.mutateAsync).toHaveBeenCalledWith("https://github.com/acme/api");
    expect(h.push).toHaveBeenCalledWith("/repos/repo-9/pulls");
  });

  it("submits with Enter and shows the API error inline", async () => {
    h.mutateAsync.mockRejectedValue(new ApiError("Repository not found", 404));
    const { user } = renderWithProviders(<AddRepoView />);

    await user.type(urlInput(), "https://github.com/acme/nope{Enter}");

    expect(await screen.findByText("Repository not found")).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });

  it("falls back to a translated message for non-API errors", async () => {
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    const { user } = renderWithProviders(<AddRepoView />);
    await user.type(urlInput(), "x{Enter}");
    expect(await screen.findByText("Could not add repository")).toBeInTheDocument();
  });

  it("links to the API key settings and closes with Escape", async () => {
    const { user } = renderWithProviders(<AddRepoView />);
    await user.click(screen.getByRole("link", { name: "Settings → API Keys" }));
    expect(h.push).toHaveBeenCalledWith("/settings/api-keys");
    await user.keyboard("{Escape}");
    expect(h.push).toHaveBeenLastCalledWith("/");
  });

  it("shows progress while cloning", () => {
    h.isPending = true;
    renderWithProviders(<AddRepoView />);
    expect(screen.getByRole("button", { name: "Cloning…" })).toBeDisabled();
  });
});
