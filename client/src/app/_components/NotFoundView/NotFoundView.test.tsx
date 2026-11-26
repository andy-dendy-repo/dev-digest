import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { NotFoundView } from "./NotFoundView";

describe("NotFoundView", () => {
  it("says the page does not exist and leads back home", async () => {
    const { user } = renderWithProviders(<NotFoundView />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to DevDigest" }));
    expect(push).toHaveBeenCalledWith("/");
  });
});
