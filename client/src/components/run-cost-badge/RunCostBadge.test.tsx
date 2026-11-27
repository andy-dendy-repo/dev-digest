/**
 * RunCostBadge — M1 run cost badge (specs/M1-run-cost-badge.md).
 * Each variant's exact text, and the rule that unknown cost is "—" with no
 * tokens (never a fake "$0.00").
 */
import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import prReview from "../../../messages/en/prReview.json";
import { RunCostBadge, type RunCostBadgeVariant } from "./RunCostBadge";

afterEach(cleanup);

function renderBadge(props: {
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  variant?: RunCostBadgeVariant;
}) {
  renderWithProviders(<RunCostBadge {...props} />);
  return screen.getByTitle(/^Run cost/);
}

describe("RunCostBadge — variants", () => {
  it("compact (default) shows the cost only", () => {
    expect(renderBadge({ costUsd: 0.014, tokensIn: 8210, tokensOut: 1290 })).toHaveTextContent(/^\$0\.014$/);
  });

  it("total shows total tokens · cost", () => {
    expect(
      renderBadge({ costUsd: 0.0013, tokensIn: 9000, tokensOut: 119, variant: "total" }),
    ).toHaveTextContent("9,119 tok · $0.0013");
  });

  it("split shows cost · in→out tokens", () => {
    expect(
      renderBadge({ costUsd: 0.014, tokensIn: 8210, tokensOut: 1290, variant: "split" }),
    ).toHaveTextContent("$0.014 · 8.2K→1.3K");
  });

  it("falls back to cost only when tokens are missing", () => {
    expect(renderBadge({ costUsd: 0.014, variant: "split" })).toHaveTextContent(/^\$0\.014$/);
  });
});

describe("RunCostBadge — no data", () => {
  it.each<RunCostBadgeVariant>(["compact", "total", "split"])(
    "unknown cost renders '—' without tokens (%s)",
    (variant) => {
      const el = renderBadge({ costUsd: null, tokensIn: 9000, tokensOut: 119, variant });
      expect(el).toHaveTextContent(/^—$/);
      expect(el).not.toHaveTextContent("$0.00");
    },
  );

  it("a genuinely free run is $0, not '—'", () => {
    expect(renderBadge({ costUsd: 0, tokensIn: 10, tokensOut: 5, variant: "total" })).toHaveTextContent(
      "15 tok · $0",
    );
  });

  it("explains the number in a tooltip", () => {
    expect(renderBadge({ costUsd: 0.014 })).toHaveAttribute("title", prReview.cost.title);
  });
});
