import { describe, it, expect } from "vitest";
import type { AgentSkillView, Skill } from "@devdigest/shared";
import { buildRows, effectiveCount, moveRow, toggleRow, toLinks } from "./helpers";

const skill = (id: string, enabled = true): Skill => ({
  id,
  name: id,
  description: `Flag ${id}.`,
  type: "rubric",
  source: "manual",
  body: "b",
  enabled,
  version: 1,
});
const link = (id: string, order: number, enabled: boolean, skill_enabled = true): AgentSkillView => ({
  agent_id: "a1",
  skill_id: id,
  order,
  enabled,
  name: id,
  description: `Flag ${id}.`,
  type: "rubric",
  source: "manual",
  skill_enabled,
});

const skills = [skill("a"), skill("b"), skill("c", false), skill("d")];
const links = [link("b", 1, false), link("a", 0, true), link("c", 2, true, false)];

describe("Skills tab rows", () => {
  it("lists linked skills in prompt order, then the rest by name", () => {
    expect(buildRows(links, skills).map((r) => [r.skill_id, r.linked, r.enabled])).toEqual([
      ["a", true, true],
      ["b", true, false],
      ["c", true, true],
      ["d", false, false],
    ]);
  });

  it("counts only skills enabled here AND globally", () => {
    expect(effectiveCount(buildRows(links, skills))).toBe(1);
  });

  it("enabling an unlinked skill links it at the end of the linked block", () => {
    const rows = toggleRow(buildRows(links, skills), "d", true);
    expect(toLinks(rows, "a1").map((l) => [l.skill_id, l.order, l.enabled])).toEqual([
      ["a", 0, true],
      ["b", 1, false],
      ["c", 2, true],
      ["d", 3, true],
    ]);
  });

  it("moving a row reorders the prompt; moving an unlinked row links it (disabled)", () => {
    const moved = moveRow(buildRows(links, skills), 3, 0);
    expect(toLinks(moved, "a1").map((l) => [l.skill_id, l.enabled])).toEqual([
      ["d", false],
      ["a", true],
      ["b", false],
      ["c", true],
    ]);
    expect(moveRow(buildRows(links, skills), 0, 9)).toEqual(buildRows(links, skills));
  });
});
