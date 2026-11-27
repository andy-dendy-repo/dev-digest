import { and, asc, count, eq, inArray, ne } from 'drizzle-orm';
import type { Skill } from '@devdigest/shared';
import type { DbOrTx } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { toSkillDto } from './helpers.js';
import type { NewSkill, SkillPatch, SkillsPort } from './ports.js';

/**
 * M2 — skills data-access. Owns `skills` and `skill_versions`; reads
 * `agent_skills` for usage counts and an agent's effective skills (the agents
 * repository owns writes to the link table). Workspace-scoped throughout.
 */
export class SkillsRepository implements SkillsPort {
  /** `db` is the shared client or a unit-of-work transaction (see db/unit-of-work.ts). */
  constructor(private db: DbOrTx) {}

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
    const counts = await this.agentCounts(rows.map((r) => r.id));
    return rows.map((r) => toSkillDto(r, counts.get(r.id) ?? 0));
  }

  async getById(workspaceId: string, id: string): Promise<Skill | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    if (!row) return undefined;
    const counts = await this.agentCounts([row.id]);
    return toSkillDto(row, counts.get(row.id) ?? 0);
  }

  async nameTaken(workspaceId: string, name: string, exceptId?: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(
        and(
          eq(t.skills.workspaceId, workspaceId),
          eq(t.skills.name, name),
          ...(exceptId ? [ne(t.skills.id, exceptId)] : []),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  /** Insert a skill AND its version-1 body snapshot, in one transaction. */
  async insert(values: NewSkill): Promise<Skill> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(t.skills).values({ ...values, version: 1 }).returning();
      await tx.insert(t.skillVersions).values({ skillId: row!.id, version: 1, body: row!.body });
      return toSkillDto(row!, 0);
    });
  }

  /**
   * Update a skill. A body change bumps the version and snapshots the new body.
   * Read-modify-write under a row lock so concurrent edits get distinct versions.
   */
  async update(workspaceId: string, id: string, patch: SkillPatch): Promise<Skill | undefined> {
    const updated = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(t.skills)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .for('update');
      if (!existing) return undefined;

      const bodyChanged = patch.body !== undefined && patch.body !== existing.body;
      const version = bodyChanged ? existing.version + 1 : existing.version;
      const [row] = await tx
        .update(t.skills)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          version,
        })
        .where(eq(t.skills.id, id))
        .returning();
      if (bodyChanged) {
        await tx.insert(t.skillVersions).values({ skillId: id, version, body: row!.body });
      }
      return row;
    });
    if (!updated) return undefined;
    const counts = await this.agentCounts([id]);
    return toSkillDto(updated, counts.get(id) ?? 0);
  }

  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  async effectiveForAgent(agentId: string): Promise<Skill[]> {
    const rows = await this.db
      .select({ skill: t.skills })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          eq(t.agentSkills.agentId, agentId),
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
        ),
      )
      .orderBy(asc(t.agentSkills.order));
    return rows.map((r) => toSkillDto(r.skill));
  }

  private async agentCounts(skillIds: string[]): Promise<Map<string, number>> {
    if (skillIds.length === 0) return new Map();
    const rows = await this.db
      .select({ skillId: t.agentSkills.skillId, n: count() })
      .from(t.agentSkills)
      .where(inArray(t.agentSkills.skillId, skillIds))
      .groupBy(t.agentSkills.skillId);
    return new Map(rows.map((r) => [r.skillId, Number(r.n)]));
  }
}
