import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { MarkdownEditor } from "./MarkdownEditor";

describe("MarkdownEditor", () => {
  it("shows the file name, an unsaved badge, a token estimate and reports edits", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <MarkdownEditor value={"# Rule\nCheck it."} onChange={onChange} filename="rule.md" label="Skill body" dirty />,
    );
    expect(screen.getByText("rule.md")).toBeInTheDocument();
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByText("≈4 tokens")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Skill body" }), "!");
    expect(onChange).toHaveBeenLastCalledWith("# Rule\nCheck it.!");
  });
});
