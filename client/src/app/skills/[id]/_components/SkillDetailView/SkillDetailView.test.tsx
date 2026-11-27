import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { Skill } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const SKILL: Skill = {
  id: "s1",
  name: "pr-quality-rubric",
  description: "Rubric for overall PR quality.",
  type: "rubric",
  source: "manual",
  body: "# PR Quality Rubric\n\nCorrectness first.",
  enabled: true,
  version: 5,
  token_count: 166,
};

const h = vi.hoisted(() => ({ search: new URLSearchParams(), replace: vi.fn(), update: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => h.search,
  useRouter: () => ({ replace: h.replace, push: vi.fn() }),
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: [SKILL] }),
  useSkill: () => ({ data: SKILL, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: h.update, isPending: false, isSuccess: false }),
  useDeleteSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSkill: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
  usePreviewSkillImport: () => ({ mutateAsync: vi.fn(), reset: vi.fn() }),
}));

import { SkillDetailView } from "./SkillDetailView";

beforeEach(() => {
  vi.clearAllMocks();
  h.search = new URLSearchParams();
});

describe("SkillDetailView", () => {
  it("shows the header (version, tokens) and saves only the edited body", async () => {
    const { user } = renderWithProviders(<SkillDetailView id="s1" />);
    expect(screen.getByRole("heading", { name: "pr-quality-rubric" })).toBeInTheDocument();
    expect(screen.getByText("v5")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save skill" });
    expect(save).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Skill body" }), "\nTests second.");
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    await user.click(save);
    expect(h.update).toHaveBeenCalledWith(
      { id: "s1", patch: { body: "# PR Quality Rubric\n\nCorrectness first.\nTests second." } },
      expect.anything(),
    );
  });

  it("the description field tells the author to write a directive", () => {
    renderWithProviders(<SkillDetailView id="s1" />);
    expect(screen.getByText(/The skill's interface: one directive sentence/)).toBeInTheDocument();
  });

  it("Preview renders the skill body as markdown", async () => {
    h.search = new URLSearchParams("tab=preview");
    renderWithProviders(<SkillDetailView id="s1" />);
    expect(screen.getByRole("heading", { name: "PR Quality Rubric" })).toBeInTheDocument();
    await screen.findByText("Correctness first.");
  });
});
