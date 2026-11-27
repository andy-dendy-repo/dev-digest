import type { Skill, UpdateSkillRequest } from "@devdigest/shared";

/** The editable part of a skill. */
export type SkillDraft = Pick<Skill, "name" | "description" | "type" | "body">;

export function draftOf(skill: Skill): SkillDraft {
  return { name: skill.name, description: skill.description, type: skill.type, body: skill.body };
}

/** Only the fields that changed — so a rename never bumps the body version. */
export function changedFields(skill: Skill, draft: SkillDraft): UpdateSkillRequest {
  const patch: UpdateSkillRequest = {};
  if (draft.name !== skill.name) patch.name = draft.name.trim();
  if (draft.description !== skill.description) patch.description = draft.description.trim();
  if (draft.type !== skill.type) patch.type = draft.type;
  if (draft.body !== skill.body) patch.body = draft.body;
  return patch;
}
