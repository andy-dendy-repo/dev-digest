import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { filterSkills } from "./helpers";

const sk = (name: string, description: string, type: Skill["type"] = "rubric"): Skill => ({
  id: name,
  name,
  description,
  type,
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
});

describe("filterSkills", () => {
  const all = [sk("test-corner-cases", "Flag missing edge cases"), sk("secret-leakage-gate", "Detect keys", "security")];
  it("matches name, description or type, case-insensitively; blank returns all", () => {
    expect(filterSkills(all, "EDGE").map((s) => s.name)).toEqual(["test-corner-cases"]);
    expect(filterSkills(all, "security").map((s) => s.name)).toEqual(["secret-leakage-gate"]);
    expect(filterSkills(all, "  ")).toHaveLength(2);
  });
});
