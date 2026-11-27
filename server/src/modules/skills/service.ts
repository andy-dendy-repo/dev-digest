import type { Skill, SkillImportPreview } from '@devdigest/shared';
import { ConflictError } from '../../platform/errors.js';
import type { CreateSkillInput, SkillImportInput, UpdateSkillInput } from './domain.js';
import { isUntrustedSource, withTokenCount } from './helpers.js';
import { parseSkillImport } from './import-parser.js';
import type { SkillsServiceDeps } from './ports.js';

/**
 * M2 — skills service. A skill is text only (name · description · type · body)
 * that agents link and the run executor injects into the prompt. The DB is the
 * source of truth; a body change is versioned in `skill_versions`.
 */
export class SkillsService {
  constructor(private deps: SkillsServiceDeps) {}

  private get repo() {
    return this.deps.skills;
  }

  private withTokens = (skill: Skill): Skill => withTokenCount(skill, this.deps.countTokens);

  async list(workspaceId: string): Promise<Skill[]> {
    return (await this.repo.list(workspaceId)).map(this.withTokens);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const skill = await this.repo.getById(workspaceId, id);
    return skill && this.withTokens(skill);
  }

  /**
   * Create a skill. Imported sources are always stored disabled (vetting gate):
   * someone else's text must be enabled by a user before it reaches a prompt.
   */
  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    await this.assertNameFree(workspaceId, input.name);
    const source = input.source ?? 'manual';
    const skill = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source,
      body: input.body,
      enabled: isUntrustedSource(source) ? false : (input.enabled ?? true),
    });
    return this.withTokens(skill);
  }

  async update(workspaceId: string, id: string, patch: UpdateSkillInput): Promise<Skill | undefined> {
    if (patch.name !== undefined) await this.assertNameFree(workspaceId, patch.name, id);
    const skill = await this.repo.update(workspaceId, id, patch);
    return skill && this.withTokens(skill);
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /** Parse an upload into a draft for confirmation. Stores nothing. */
  previewImport(input: SkillImportInput): SkillImportPreview {
    return parseSkillImport(input);
  }

  private async assertNameFree(workspaceId: string, name: string, exceptId?: string) {
    if (await this.repo.nameTaken(workspaceId, name, exceptId)) {
      throw new ConflictError(`A skill named "${name}" already exists`);
    }
  }
}
