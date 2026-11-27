import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Skill } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({ push: vi.fn(), update: vi.fn(), del: vi.fn(), skills: [] as unknown[] }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }) }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: h.skills, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: h.update }),
  useDeleteSkill: () => ({ mutate: h.del, isPending: false }),
  useCreateSkill: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
  usePreviewSkillImport: () => ({ mutateAsync: vi.fn(), reset: vi.fn() }),
}));

import { SkillsListView } from "./SkillsListView";

const skill = (over: Partial<Skill>): Skill => ({
  id: "s1",
  name: "pr-quality-rubric",
  description: "Rubric for overall PR quality.",
  type: "rubric",
  source: "manual",
  body: "# Rubric",
  enabled: true,
  version: 5,
  agent_count: 3,
  token_count: 166,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.skills = [
    skill({}),
    skill({ id: "s2", name: "phantom-api-gate", type: "security", source: "imported_file", enabled: false, agent_count: 0 }),
  ];
});

describe("SkillsListView", () => {
  it("renders a card per skill with type, source, usage and the vetting badge for an imported skill", () => {
    renderWithProviders(<SkillsListView />);
    const cards = screen.getAllByTestId("skill-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText("rubric")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("3 agents · 166 tokens")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("needs vetting")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("Imported")).toBeInTheDocument();
  });

  it("filters by search and opens a skill in the editor", async () => {
    const { user } = renderWithProviders(<SkillsListView />);
    await user.type(screen.getByRole("textbox", { name: "Search skills…" }), "phantom");
    expect(screen.getAllByTestId("skill-card")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /phantom-api-gate/ }));
    expect(h.push).toHaveBeenCalledWith("/skills/s2?tab=config");
  });

  it("enabling an imported skill asks for confirmation first; declining changes nothing", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user } = renderWithProviders(<SkillsListView />);
    const imported = screen.getAllByTestId("skill-card")[1]!;
    await user.click(within(imported).getByRole("switch", { name: "Enable phantom-api-gate for all agents" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("was imported from someone else"));
    expect(h.update).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(within(imported).getByRole("switch"));
    expect(h.update).toHaveBeenCalledWith({ id: "s2", patch: { enabled: true } });
  });

  it("disabling a manual skill needs no confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const { user } = renderWithProviders(<SkillsListView />);
    await user.click(within(screen.getAllByTestId("skill-card")[0]!).getByRole("switch"));
    expect(confirm).not.toHaveBeenCalled();
    expect(h.update).toHaveBeenCalledWith({ id: "s1", patch: { enabled: false } });
  });
});
