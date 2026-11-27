import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { changedFields, draftOf } from "./helpers";

const SKILL: Skill = {
  id: "s1",
  name: "test-corner-cases",
  description: "Flag edge cases.",
  type: "rubric",
  source: "manual",
  body: "# Rule",
  enabled: true,
  version: 2,
};

describe("changedFields", () => {
  it("is empty for an untouched draft and lists only edited fields", () => {
    expect(changedFields(SKILL, draftOf(SKILL))).toEqual({});
    expect(changedFields(SKILL, { ...draftOf(SKILL), description: " Flag boundaries. " })).toEqual({
      description: "Flag boundaries.",
    });
  });
});
