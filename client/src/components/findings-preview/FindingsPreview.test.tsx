/**
 * FindingsPreview — severity icons + counts that open a brief, read-only
 * findings panel (timeline + PR list). The panel is portalled, so the click
 * must not bubble to a clickable parent (a PR list row navigates).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/prReview.json";
import { FindingsPreview } from "./FindingsPreview";
import type { FindingPreviewItem } from "./helpers";

afterEach(cleanup);

function f(id: string, severity: FindingPreviewItem["severity"], title: string, confidence = 0.8): FindingPreviewItem {
  return {
    id,
    severity,
    category: "security",
    title,
    file: "src/api/users.ts",
    start_line: 45,
    end_line: 52,
    confidence,
    rationale: `Why ${title} matters.`,
  };
}

const FINDINGS = [
  f("w1", "WARNING", "Date-range boundary is inclusive", 0.85),
  f("c1", "CRITICAL", "Endpoints are unauthenticated", 0.95),
  f("w2", "WARNING", "No tests for AnalyticsService", 0.95),
];

function renderPreview(findings: FindingPreviewItem[], onParentClick = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <div onClick={onParentClick}>
        <FindingsPreview findings={findings} />
        <span>outside</span>
      </div>
    </NextIntlClientProvider>,
  );
  return onParentClick;
}

describe("FindingsPreview", () => {
  it("shows icons for present severities and opens/closes a brief preview without leaking clicks", async () => {
    const user = userEvent.setup();
    const onParentClick = renderPreview(FINDINGS);

    const trigger = screen.getByRole("button", { name: "Show 3 findings" });
    // Only severities that occur: 1 critical, 2 warnings, no suggestion icon.
    expect(trigger).toHaveTextContent(/^12$/);
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "3 findings in this run" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Most severe first, then by confidence.
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Endpoints are unauthenticated");
    expect(items[1]).toHaveTextContent("No tests for AnalyticsService");
    expect(items[2]).toHaveTextContent("Date-range boundary is inclusive");
    expect(within(items[0]!).getByText("src/api/users.ts:45-52")).toBeInTheDocument();
    expect(within(items[0]!).getByText("95% conf")).toBeInTheDocument();

    // Clicking inside the panel keeps it open and does not reach the parent.
    await user.click(within(dialog).getByText("Why Endpoints are unauthenticated matters."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByText("outside"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Only the final click on "outside" reached the parent.
    expect(onParentClick).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there are no findings", () => {
    renderPreview([]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
