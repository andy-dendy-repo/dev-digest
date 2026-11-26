import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, Severity } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate, isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mutate.mockClear();
});

function finding(id: string, severity: Severity, title: string, confidence: number): FindingRecord {
  return {
    id,
    severity,
    category: "security",
    title,
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: `Rationale for ${title}.`,
    suggestion: null,
    confidence,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  };
}

// 1 CRITICAL · 3 WARNING · 1 SUGGESTION; two of them below the 0.65 confidence threshold.
const FINDINGS: FindingRecord[] = [
  finding("c1", "CRITICAL", "Hardcoded secret", 0.95),
  finding("w1", "WARNING", "POST with body IDs", 0.8),
  finding("w2", "WARNING", "No rate limiting", 0.9),
  finding("w3", "WARNING", "Leaky error messages", 0.5),
  finding("s1", "SUGGESTION", "Magic number", 0.6),
];
const ALL_TITLES = FINDINGS.map((f) => f.title);

function ui(findings: FindingRecord[]) {
  return (
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FindingsPanel findings={findings} prId="pr1" />
    </NextIntlClientProvider>
  );
}

const counter = (name: RegExp) => screen.getByRole("button", { name });
const expectTitles = (visible: string[]) => {
  for (const title of ALL_TITLES) {
    if (visible.includes(title)) expect(screen.getByText(title)).toBeInTheDocument();
    else expect(screen.queryByText(title)).not.toBeInTheDocument();
  }
};

describe("FindingsPanel", () => {
  it("renders the toolbar + a finding card", () => {
    render(ui(FINDINGS.slice(0, 1)));
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    render(ui([]));
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    // A level without findings still renders its counter as 0.
    expect(counter(/^0 critical$/i)).toBeInTheDocument();
  });

  it("counts findings per severity and filters by a single severity without any request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();
    render(ui(FINDINGS));

    expect(screen.getByRole("group", { name: "Filter by severity" })).toBeInTheDocument();
    for (const name of [/^1 critical$/i, /^3 warning$/i, /^1 suggestion$/i]) {
      expect(counter(name)).toHaveAttribute("aria-pressed", "false");
    }

    await user.click(counter(/3 warning/i));
    expect(counter(/3 warning/i)).toHaveAttribute("aria-pressed", "true");
    expectTitles(["POST with body IDs", "No rate limiting", "Leaky error messages"]);

    // Clicking another level moves the filter (only one is active).
    await user.click(counter(/1 critical/i));
    expect(counter(/1 critical/i)).toHaveAttribute("aria-pressed", "true");
    expect(counter(/3 warning/i)).toHaveAttribute("aria-pressed", "false");
    expectTitles(["Hardcoded secret"]);

    // Clicking the active level again clears the filter.
    await user.click(counter(/1 critical/i));
    expect(counter(/1 critical/i)).toHaveAttribute("aria-pressed", "false");
    expectTitles(ALL_TITLES);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("combines with Hide low confidence and shows the empty state for an emptied level", async () => {
    const user = userEvent.setup();
    render(ui(FINDINGS));

    await user.click(screen.getByRole("switch"));
    // Counters follow the confidence filter, so they always match the list.
    expect(counter(/^1 critical$/i)).toBeInTheDocument();
    expect(counter(/^2 warning$/i)).toBeInTheDocument();
    expect(counter(/^0 suggestion$/i)).toBeInTheDocument();

    await user.click(counter(/2 warning/i));
    expectTitles(["POST with body IDs", "No rate limiting"]);

    await user.click(counter(/0 suggestion/i));
    expectTitles([]);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });

  it("keeps counters and the active filter in sync when findings refresh after a dismiss", async () => {
    const user = userEvent.setup();
    const { rerender } = render(ui(FINDINGS));

    await user.click(counter(/3 warning/i));

    // Simulate the refetch after dismissing w1 and a re-run dropping w3.
    const refreshed = FINDINGS.filter((f) => f.id !== "w3").map((f) =>
      f.id === "w1" ? { ...f, dismissed_at: "2026-11-21T10:00:00Z" } : f,
    );
    rerender(ui(refreshed));

    expect(counter(/^2 warning$/i)).toHaveAttribute("aria-pressed", "true");
    expectTitles(["POST with body IDs", "No rate limiting"]);
    expect(screen.getByText(/^dismissed$/i)).toBeInTheDocument();
  });
});

describe("FindingsPanel — keyboard shortcuts", () => {
  const ONE = [finding("p1-f", "CRITICAL", "Panel one finding", 0.95)];
  const TWO = [finding("p2-f", "WARNING", "Panel two finding", 0.95)];

  function twoPanels() {
    return render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <div data-testid="panel-one">
          <FindingsPanel findings={ONE} prId="pr1" />
        </div>
        <div data-testid="panel-two">
          <FindingsPanel findings={TWO} prId="pr1" />
        </div>
      </NextIntlClientProvider>,
    );
  }

  it("`a` accepts the focused finding", async () => {
    const user = userEvent.setup();
    render(ui(FINDINGS));
    await user.keyboard("a");
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ findingId: "c1", action: "accept", prId: "pr1" });
  });

  it("acts in ONE panel only when several are open (the most recently opened)", async () => {
    const user = userEvent.setup();
    twoPanels();
    await user.keyboard("d");
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ findingId: "p2-f", action: "dismiss", prId: "pr1" });
  });

  it("moves the shortcuts to the panel the user last interacted with", async () => {
    const user = userEvent.setup();
    twoPanels();
    await user.click(screen.getByText("Panel one finding"));
    mutate.mockClear();
    await user.keyboard("a");
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({ findingId: "p1-f", action: "accept", prId: "pr1" });
  });

  it("ignores browser chords such as Cmd/Ctrl+A and Ctrl+D", async () => {
    const user = userEvent.setup();
    render(ui(FINDINGS));
    await user.keyboard("{Meta>}a{/Meta}{Control>}a{/Control}{Control>}d{/Control}{Alt>}d{/Alt}");
    expect(mutate).not.toHaveBeenCalled();
  });
});
