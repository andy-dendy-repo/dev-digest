import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({
  opts: undefined as { onSettled?: () => void } | undefined,
  running: false,
}));
vi.mock("@/lib/hooks/reviews", () => ({
  useRunEvents: (_ids: string[], opts?: { onSettled?: () => void }) => {
    h.opts = opts;
    return {
      events: [{ runId: "r1", seq: 1, t: "00.10", kind: "info", msg: "Starting review" }],
      running: h.running,
    };
  },
}));

import { RunStatus } from "./RunStatus";

describe("RunStatus", () => {
  it("renders nothing when there are no run ids", () => {
    renderWithProviders(<RunStatus runIds={[]} />);
    expect(screen.queryByText("Starting review")).not.toBeInTheDocument();
  });

  it("streams the live log with the running-agents label", () => {
    h.running = true;
    renderWithProviders(<RunStatus runIds={["r1", "r2"]} />);
    expect(screen.getByText("Starting review")).toBeInTheDocument();
    expect(screen.getByText("Running · 2 agent(s)")).toBeInTheDocument();
  });

  it("reports done when the runs settle", () => {
    const onDone = vi.fn();
    renderWithProviders(<RunStatus runIds={["r1"]} onDone={onDone} />);
    h.opts?.onSettled?.();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
