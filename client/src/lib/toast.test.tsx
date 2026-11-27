import { describe, it, expect, vi, afterEach } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { notify, TOAST_TTL_MS } from "./toast";

afterEach(() => vi.useRealTimers());

describe("ToastProvider", () => {
  it("shows a toast, dismisses it by hand or after its TTL", async () => {
    const { user } = renderWithProviders(<div />);
    act(() => notify.error("Push failed"));
    expect(screen.getByText("Push failed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Push failed")).not.toBeInTheDocument();

    vi.useFakeTimers();
    act(() => notify.info("Saved"));
    act(() => vi.advanceTimersByTime(TOAST_TTL_MS));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("clears pending auto-dismiss timers on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = renderWithProviders(<div />);
    act(() => notify.success("Saved"));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
