import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { finding, review, runSummary } from "../test-fixtures";

const { deleteReview } = vi.hoisted(() => ({ deleteReview: vi.fn() }));
vi.mock("@/lib/hooks/reviews", () => ({
  useDeleteReview: () => ({ mutate: deleteReview, isPending: false }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import React from "react";
import { act } from "@testing-library/react";
import { ReviewRunAccordion, type ReviewRunAccordionHandle } from "./ReviewRunAccordion";
import { PrProvider } from "../pr-context";

const REVIEW = review({
  id: "rv1",
  agent_name: "Security Reviewer",
  verdict: "request_changes",
  findings: [
    finding({ id: "c1", severity: "CRITICAL", title: "Hardcoded secret" }),
    finding({ id: "c2", severity: "CRITICAL", title: "Dismissed blocker", dismissed_at: "2026-06-11T18:50:00.000Z" }),
    finding({ id: "w1", severity: "WARNING", title: "No rate limiting" }),
  ],
});

function renderAccordion(props: Partial<React.ComponentProps<typeof ReviewRunAccordion>> = {}) {
  return renderWithProviders(
    <PrProvider value={{ prId: "pr-1", repoFullName: null, headSha: null }}>
      <ReviewRunAccordion review={REVIEW} {...props} />
    </PrProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("ReviewRunAccordion", () => {
  it("summarises the run in its header; a dismissed CRITICAL is not a blocker", () => {
    renderAccordion();
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("request changes")).toBeInTheDocument();
    expect(screen.getByText("3 findings · 1 blocker")).toBeInTheDocument();
  });

  it("uses the singular for one finding", () => {
    renderAccordion({ review: review({ id: "rv2", findings: [finding({ id: "w1" })] }) });
    expect(screen.getByText("1 finding")).toBeInTheDocument();
  });

  it("toggles its findings from the header, with the mouse and the keyboard", async () => {
    const { user } = renderAccordion();
    expect(screen.queryByText("No rate limiting")).not.toBeInTheDocument();

    // The verdict banner repeats the agent name once open; the header comes first.
    const header = () => screen.getAllByText("Security Reviewer")[0]!;
    await user.click(header());
    expect(screen.getByText("No rate limiting")).toBeInTheDocument();

    await user.click(header());
    expect(screen.queryByText("No rate limiting")).not.toBeInTheDocument();

    // Clicking left focus on the header: Enter re-opens it.
    await user.keyboard("{Enter}");
    expect(screen.getByText("No rate limiting")).toBeInTheDocument();
  });

  it("starts open with the verdict banner and the run cost when defaultOpen", () => {
    renderAccordion({
      defaultOpen: true,
      run: runSummary({ run_id: "run-rv1", cost_usd: 0.0123 }),
    });
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText(/\$0\.012/)).toBeInTheDocument();
  });

  it("deletes the review only after confirmation, without toggling", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { user } = renderAccordion();
    const del = screen.getByRole("button", { name: "Delete this review run" });

    await user.click(del);
    expect(deleteReview).not.toHaveBeenCalled();

    await user.click(del);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(deleteReview).toHaveBeenCalledWith("rv1");
    expect(screen.queryByText("No rate limiting")).not.toBeInTheDocument();
  });

  it("pressing Enter on the delete button does not also toggle the accordion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user } = renderAccordion();
    screen.getByRole("button", { name: "Delete this review run" }).focus();

    await user.keyboard("{Enter}");

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("No rate limiting")).not.toBeInTheDocument();
  });

  it("exposes its header as a real, labelled toggle button", async () => {
    const { user } = renderAccordion();
    const toggle = screen.getByRole("button", { expanded: false });
    expect(toggle).toHaveAccessibleName(/Security Reviewer/);
    await user.click(toggle);
    expect(screen.getByRole("button", { expanded: true })).toBe(toggle);
  });

  it("opens and scrolls into view when revealed through its handle", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const handle = React.createRef<ReviewRunAccordionHandle>();
    renderAccordion({ ref: handle });

    act(() => handle.current?.reveal());

    expect(screen.getByText("No rate limiting")).toBeInTheDocument();
    expect(scroll).toHaveBeenCalled();
  });
});
