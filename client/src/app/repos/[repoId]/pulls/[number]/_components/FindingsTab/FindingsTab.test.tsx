import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { finding, review, runSummary } from "../test-fixtures";

const { cancel, deleteReview, findingAction } = vi.hoisted(() => ({
  cancel: vi.fn(),
  deleteReview: vi.fn(),
  findingAction: vi.fn(),
}));
vi.mock("@/lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running: true }),
  useCancelRun: () => ({ mutate: cancel, isPending: false }),
  useDeleteReview: () => ({ mutate: deleteReview, isPending: false }),
  useFindingAction: () => ({ mutate: findingAction, isPending: false }),
}));

import { FindingsTab } from "./FindingsTab";
import { PrProvider } from "../pr-context";

type Props = Partial<React.ComponentProps<typeof FindingsTab>>;

function renderTab(props: Props = {}) {
  const onOpenTrace = vi.fn();
  const onDelete = vi.fn();
  const onRunDone = vi.fn();
  const utils = renderWithProviders(
    <PrProvider value={{ prId: "pr-1", repoFullName: "acme/api", headSha: "abc123" }}>
      <FindingsTab
        liveRunIds={[]}
        reviews={[]}
        prRuns={[]}
        prCommits={[]}
        onOpenTrace={onOpenTrace}
        onDelete={onDelete}
        onRunDone={onRunDone}
        {...props}
      />
    </PrProvider>,
  );
  return { ...utils, onOpenTrace, onDelete, onRunDone };
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("FindingsTab", () => {
  it("invites a first review when there are no runs", () => {
    renderTab();
    expect(screen.getByText("No findings yet")).toBeInTheDocument();
    expect(screen.queryByText("Live review")).not.toBeInTheDocument();
  });

  it("shows live-run controls that cancel every live run and open the first trace", async () => {
    const { user, onOpenTrace } = renderTab({ liveRunIds: ["run-a", "run-b"] });

    expect(screen.getByText("Live review")).toBeInTheDocument();
    expect(screen.getByText("Review in progress…")).toBeInTheDocument();
    expect(screen.queryByText("No findings yet")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledWith("run-a");
    expect(cancel).toHaveBeenCalledWith("run-b");

    await user.click(screen.getByRole("button", { name: "Open run trace" }));
    expect(onOpenTrace).toHaveBeenCalledWith("run-a");
  });

  it("warns about lethal-trifecta findings across all runs", () => {
    renderTab({
      reviews: [
        review({ id: "1", findings: [finding({ id: "f1", kind: "lethal_trifecta" })] }),
        review({ id: "2", findings: [finding({ id: "f2", kind: "lethal_trifecta" }), finding({ id: "f3" })] }),
      ],
    });
    expect(screen.getByText("Lethal Trifecta detected")).toBeInTheDocument();
    expect(screen.getByText("2 finding(s)")).toBeInTheDocument();
  });

  it("opens the newest review run and keeps older ones collapsed", () => {
    renderTab({
      reviews: [
        review({ id: "new", agent_name: "Newest", findings: [finding({ id: "f1", title: "Newest finding" })] }),
        review({ id: "old", agent_name: "Oldest", findings: [finding({ id: "f2", title: "Oldest finding" })] }),
      ],
    });
    expect(screen.getByText("Newest finding")).toBeInTheDocument();
    expect(screen.queryByText("Oldest finding")).not.toBeInTheDocument();
  });

  it("jumps from a timeline run to its review run", async () => {
    const { user } = renderTab({
      reviews: [
        review({ id: "new", agent_name: "Newest", findings: [finding({ id: "f1", title: "Newest finding" })] }),
        review({ id: "old", agent_name: "Oldest", findings: [finding({ id: "f2", title: "Oldest finding" })] }),
      ],
      prRuns: [runSummary({ run_id: "run-old", agent_name: "Oldest" })],
    });

    await user.click(screen.getByRole("button", { name: "Oldest" }));

    expect(screen.getByText("Oldest finding")).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("deletes a timeline run through onDelete", async () => {
    const { user, onDelete } = renderTab({
      prRuns: [runSummary({ run_id: "run-x" })],
    });
    await user.click(screen.getByRole("button", { name: "Delete run" }));
    expect(onDelete).toHaveBeenCalledWith("run-x");
  });
});
