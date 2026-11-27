import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { VerdictBanner } from "./VerdictBanner";

afterEach(cleanup);

const renderWithIntl = (ui: React.ReactElement) => renderWithProviders(ui);

describe("VerdictBanner (smoke)", () => {
  it("shows verdict label + score + finding/blocker counts", () => {
    renderWithIntl(
      <VerdictBanner
        verdict="request_changes"
        summary="Hardcoded secret introduced."
        score={42}
        findingsCount={1}
        blockers={1}
        agentName="Security Reviewer"
      />,
    );
    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/1 findings · 1 blockers/)).toBeInTheDocument();
    // no run cost passed → no cost badge
    expect(screen.queryByTestId("run-cost")).not.toBeInTheDocument();
  });

  it("shows the run cost with the token split (M1 run cost badge)", () => {
    renderWithIntl(
      <VerdictBanner
        verdict="comment"
        summary={null}
        score={80}
        findingsCount={0}
        blockers={0}
        cost={{ costUsd: 0.014, tokensIn: 8210, tokensOut: 1290 }}
      />,
    );
    expect(screen.getByTestId("run-cost")).toHaveTextContent("$0.014 · 8.2K→1.3K");
  });
});
