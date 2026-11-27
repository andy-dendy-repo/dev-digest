import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Agent, AgentSkillView, Skill } from "@devdigest/shared";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({ mutate: vi.fn(), push: vi.fn() }));

const AGENT = { id: "a1", name: "Security Reviewer" } as Agent;
const skill = (id: string, type: Skill["type"], enabled = true): Skill => ({
  id,
  name: id,
  description: `Flag ${id}.`,
  type,
  source: "manual",
  body: "b",
  enabled,
  version: 1,
});
const SKILLS = [
  skill("pr-quality-rubric", "rubric"),
  skill("no-then-chains", "convention"),
  skill("secret-leakage-gate", "security"),
  skill("phantom-api-gate", "security", false),
];
const view = (sk: Skill, order: number, enabled: boolean): AgentSkillView => ({
  agent_id: "a1",
  skill_id: sk.id,
  order,
  enabled,
  name: sk.name,
  description: sk.description,
  type: sk.type,
  source: sk.source,
  skill_enabled: sk.enabled,
});
const LINKS = [view(SKILLS[0]!, 0, true), view(SKILLS[1]!, 1, false), view(SKILLS[3]!, 2, true)];

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: LINKS, isLoading: false, isError: false }),
  useSetAgentSkills: () => ({ mutate: h.mutate }),
}));
vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false, isError: false }),
}));

import { SkillsTab } from "./SkillsTab";

const order = () => (h.mutate.mock.lastCall![0] as AgentSkillView[]).map((l) => [l.skill_id, l.enabled]);

beforeEach(() => vi.clearAllMocks());

describe("agent SkillsTab", () => {
  it("lists linked skills in prompt order then the rest, and counts skills that will run", () => {
    renderWithProviders(<SkillsTab agent={AGENT} />);
    const items = within(screen.getByRole("list", { name: "Skills" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("pr-quality-rubric"),
      expect.stringContaining("no-then-chains"),
      expect.stringContaining("phantom-api-gate"),
      expect.stringContaining("secret-leakage-gate"),
    ]);
    // phantom-api-gate is enabled here but off globally → it does not count.
    expect(screen.getByText("1 of 4 enabled")).toBeInTheDocument();
    expect(within(items[2]!).getByText("off globally")).toBeInTheDocument();
  });

  it("checking an unattached skill attaches and enables it for this agent", async () => {
    const { user } = renderWithProviders(<SkillsTab agent={AGENT} />);
    await user.click(screen.getByRole("checkbox", { name: "Enable secret-leakage-gate for this agent" }));
    expect(order()).toEqual([
      ["pr-quality-rubric", true],
      ["no-then-chains", false],
      ["phantom-api-gate", true],
      ["secret-leakage-gate", true],
    ]);
  });

  it("unchecking keeps the skill attached (and its place) but disabled", async () => {
    const { user } = renderWithProviders(<SkillsTab agent={AGENT} />);
    await user.click(screen.getByRole("checkbox", { name: "Enable pr-quality-rubric for this agent" }));
    expect(order()[0]).toEqual(["pr-quality-rubric", false]);
  });

  it("Alt+↓ on a handle moves the skill one place down (keyboard reorder)", async () => {
    const { user } = renderWithProviders(<SkillsTab agent={AGENT} />);
    screen.getByRole("button", { name: "Reorder pr-quality-rubric" }).focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(order().map(([id]) => id)).toEqual(["no-then-chains", "pr-quality-rubric", "phantom-api-gate"]);
  });

  it("filtering narrows the list and turns reordering off", async () => {
    const { user } = renderWithProviders(<SkillsTab agent={AGENT} />);
    await user.type(screen.getByRole("textbox", { name: "Filter skills…" }), "security");
    const items = within(screen.getByRole("list", { name: "Skills" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Reorder secret-leakage-gate" })).toBeDisabled();
  });
});
