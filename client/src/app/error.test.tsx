import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import RouteError from "./error";

describe("route error boundary", () => {
  it("explains the failure and retries by resetting the segment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const { user } = renderWithProviders(<RouteError error={new Error("boom")} reset={reset} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(reset).toHaveBeenCalled();
  });
});
