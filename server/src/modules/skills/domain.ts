/**
 * Skills domain: the request shapes of the Skills API live in the shared
 * contracts (the client builds the same bodies); re-exported here so the route
 * and the service share one definition.
 */
export {
  CreateSkillRequest as CreateSkillBody,
  UpdateSkillRequest as UpdateSkillBody,
  SkillImportRequest as SkillImportBody,
} from '@devdigest/shared';
export type {
  CreateSkillRequest as CreateSkillInput,
  UpdateSkillRequest as UpdateSkillInput,
  SkillImportRequest as SkillImportInput,
} from '@devdigest/shared';
