import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { Agent, AgentSkillLink, AgentSkillView, AgentVersion, SkillSource, SkillType } from '@devdigest/shared';
import type { DbOrTx } from '../../db/client.js';
import type { AgentRow } from '../../db/rows.js';
import * as t from '../../db/schema.js';
import { DEFAULT_AGENT_DESCRIPTION, INITIAL_AGENT_VERSION } from './constants.js';
import { isConfigChange, toAgentDto, toAgentVersionDto } from './helpers.js';
import type { AgentPatch, AgentsPort, NewAgent } from './ports.js';

/**
 * A2 — agents data-access. Owns `agents`, `agent_versions`, and the
 * `agent_skills` link table (shared with A1's skills repository, but A2 owns the
 * agent side: link/reorder/list for an agent). Workspace-scoped throughout.
 * Implements `AgentsPort`: rows are mapped to the domain DTOs here.
 */

/** A skill linked to an agent (with its order + per-agent flag), joined from agent_skills. */
interface LinkedSkillRow {
  skill: typeof t.skills.$inferSelect;
  order: number;
  enabled: boolean;
}

export class AgentsRepository implements AgentsPort {
  /** `db` is the shared client or a unit-of-work transaction (see db/unit-of-work.ts). */
  constructor(private db: DbOrTx) {}

  async list(workspaceId: string): Promise<Agent[]> {
    const rows = await this.db.select().from(t.agents).where(eq(t.agents.workspaceId, workspaceId));
    return this.withSkillCounts(rows);
  }

  async listEnabled(workspaceId: string): Promise<Agent[]> {
    const rows = await this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.enabled, true)));
    return this.withSkillCounts(rows);
  }

  async getById(workspaceId: string, id: string): Promise<Agent | undefined> {
    const [row] = await this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)));
    return row ? (await this.withSkillCounts([row]))[0] : undefined;
  }

  /** Map rows to DTOs with `skill_count` (links enabled for the agent AND globally). */
  private async withSkillCounts(rows: AgentRow[]): Promise<Agent[]> {
    if (rows.length === 0) return [];
    const counts = await this.db
      .select({ agentId: t.agentSkills.agentId, n: count() })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          inArray(
            t.agentSkills.agentId,
            rows.map((r) => r.id),
          ),
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
        ),
      )
      .groupBy(t.agentSkills.agentId);
    const byAgent = new Map(counts.map((c) => [c.agentId, Number(c.n)]));
    return rows.map((r) => toAgentDto(r, byAgent.get(r.id) ?? 0));
  }

  /** Delete an agent (scoped to workspace). Versions/skill-links cascade;
   *  agent_runs keep their history with agent_id set null. Returns false if
   *  no such agent existed in the workspace. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
      .returning({ id: t.agents.id });
    return rows.length > 0;
  }

  /**
   * Insert an agent AND record version 1 in agent_versions (immutable snapshot).
   * One transaction: an agent never exists without its v1 snapshot.
   */
  async insert(values: NewAgent): Promise<Agent> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.agents)
        .values({
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description ?? DEFAULT_AGENT_DESCRIPTION,
          provider: values.provider,
          model: values.model,
          systemPrompt: values.systemPrompt,
          outputSchema: (values.outputSchema as object | undefined) ?? null,
          ...(values.strategy !== undefined ? { strategy: values.strategy } : {}),
          ...(values.ciFailOn !== undefined ? { ciFailOn: values.ciFailOn } : {}),
          ...(values.repoIntel !== undefined ? { repoIntel: values.repoIntel } : {}),
          enabled: values.enabled ?? true,
          version: INITIAL_AGENT_VERSION,
          createdBy: values.createdBy ?? null,
        })
        .returning();
      await new AgentsRepository(tx).snapshotVersion(row!, INITIAL_AGENT_VERSION);
      return toAgentDto(row!, 0);
    });
  }

  /**
   * Update an agent. Any config change bumps the version and snapshots the new
   * config into agent_versions (reproducibility for eval).
   *
   * Read-modify-write under a row lock (`SELECT … FOR UPDATE`) in one
   * transaction: two concurrent edits serialize, so each gets its own version
   * (N+1, then N+2) and its own snapshot, and the agent row never moves to a
   * version whose snapshot was not written.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: AgentPatch,
  ): Promise<Agent | undefined> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(t.agents)
        .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
        .for('update');
      if (!existing) return undefined;

      // A config-affecting change (anything except just toggling enabled) bumps version.
      const configChanged = isConfigChange(existing, patch);
      const nextVersion = configChanged ? existing.version + 1 : existing.version;

      const [row] = await tx
        .update(t.agents)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
          ...(patch.model !== undefined ? { model: patch.model } : {}),
          ...(patch.systemPrompt !== undefined ? { systemPrompt: patch.systemPrompt } : {}),
          ...(patch.outputSchema !== undefined
            ? { outputSchema: patch.outputSchema as object }
            : {}),
          ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
          ...(patch.ciFailOn !== undefined ? { ciFailOn: patch.ciFailOn } : {}),
          ...(patch.repoIntel !== undefined ? { repoIntel: patch.repoIntel } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(configChanged ? { version: nextVersion } : {}),
        })
        .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
        .returning();

      if (configChanged && row) await new AgentsRepository(tx).snapshotVersion(row, nextVersion);
      return row ? (await new AgentsRepository(tx).withSkillCounts([row]))[0] : undefined;
    });
  }

  private async snapshotVersion(row: AgentRow, version: number): Promise<void> {
    // The skills that would take part in a run at this version (enabled for the
    // agent), in order — what a replay of this version needs.
    const skills = (await this.linkedSkills(row.id)).filter((l) => l.enabled).map((l) => l.skill.id);
    await this.db
      .insert(t.agentVersions)
      .values({
        agentId: row.id,
        version,
        configJson: {
          provider: row.provider,
          model: row.model,
          system_prompt: row.systemPrompt,
          output_schema: row.outputSchema,
          strategy: row.strategy,
          ci_fail_on: row.ciFailOn,
          repo_intel: row.repoIntel,
          skills,
        },
      });
    // No ON CONFLICT: versions are allocated under the agent row lock (see
    // `update`), so a duplicate (agent_id, version) is a bug and must fail the
    // transaction instead of silently dropping this snapshot.
  }

  // ---- agent_versions (immutable config snapshots) ------------------------

  /** All config snapshots for an agent, newest version first. */
  async listVersions(agentId: string): Promise<AgentVersion[]> {
    const rows = await this.db
      .select()
      .from(t.agentVersions)
      .where(eq(t.agentVersions.agentId, agentId))
      .orderBy(desc(t.agentVersions.version));
    return rows.map(toAgentVersionDto);
  }

  /** A single config snapshot, or undefined if that version was never recorded. */
  async getVersion(agentId: string, version: number): Promise<AgentVersion | undefined> {
    const [row] = await this.db
      .select()
      .from(t.agentVersions)
      .where(and(eq(t.agentVersions.agentId, agentId), eq(t.agentVersions.version, version)));
    return row ? toAgentVersionDto(row) : undefined;
  }

  // ---- agent_skills link table (A2 owns the agent side) -------------------

  /** Skill links of an agent as `AgentSkillLink`s, in `order` ascending. */
  async skillLinks(agentId: string): Promise<AgentSkillLink[]> {
    const links = await this.linkedSkills(agentId);
    return links.map((l) => ({
      agent_id: agentId,
      skill_id: l.skill.id,
      order: l.order,
      enabled: l.enabled,
    }));
  }

  async skillViews(agentId: string): Promise<AgentSkillView[]> {
    const links = await this.linkedSkills(agentId);
    return links.map((l) => ({
      agent_id: agentId,
      skill_id: l.skill.id,
      order: l.order,
      enabled: l.enabled,
      name: l.skill.name,
      description: l.skill.description,
      type: l.skill.type as SkillType,
      source: l.skill.source as SkillSource,
      skill_enabled: l.skill.enabled,
    }));
  }

  async foreignSkillIds(workspaceId: string, skillIds: string[]): Promise<string[]> {
    if (skillIds.length === 0) return [];
    const own = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, skillIds)));
    const ownIds = new Set(own.map((r) => r.id));
    return skillIds.filter((id) => !ownIds.has(id));
  }

  /**
   * Replace the agent's links (order = index, per-agent `enabled`) and record a
   * new agent version, so `agent_versions` reflects which skills a run used.
   * Under the agent row lock, like `update`.
   */
  async replaceSkillLinks(
    workspaceId: string,
    agentId: string,
    links: { skillId: string; enabled: boolean }[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(t.agents)
        .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, agentId)))
        .for('update');
      if (!existing) return;
      await tx.delete(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
      if (links.length > 0) {
        await tx.insert(t.agentSkills).values(
          links.map((l, i) => ({ agentId, skillId: l.skillId, order: i, enabled: l.enabled })),
        );
      }
      const version = existing.version + 1;
      const [row] = await tx
        .update(t.agents)
        .set({ version })
        .where(eq(t.agents.id, agentId))
        .returning();
      await new AgentsRepository(tx).snapshotVersion(row!, version);
    });
  }

  /** Skills linked to an agent, in `order` ascending. */
  private async linkedSkills(agentId: string): Promise<LinkedSkillRow[]> {
    const rows = await this.db
      .select({ skill: t.skills, order: t.agentSkills.order, enabled: t.agentSkills.enabled })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.agentSkills.agentId, agentId))
      .orderBy(asc(t.agentSkills.order));
    return rows.map((r) => ({ skill: r.skill, order: r.order, enabled: r.enabled }));
  }

  async skillIdsForAgent(agentId: string): Promise<string[]> {
    const links = await this.linkedSkills(agentId);
    return links.map((l) => l.skill.id);
  }

  /** Link a skill to an agent at a given order (idempotent: upserts order). */
  async linkSkill(agentId: string, skillId: string, order: number): Promise<void> {
    await this.db
      .insert(t.agentSkills)
      .values({ agentId, skillId, order })
      .onConflictDoUpdate({
        target: [t.agentSkills.agentId, t.agentSkills.skillId],
        set: { order },
      });
  }

  async unlinkSkill(agentId: string, skillId: string): Promise<void> {
    await this.db
      .delete(t.agentSkills)
      .where(and(eq(t.agentSkills.agentId, agentId), eq(t.agentSkills.skillId, skillId)));
  }

  /**
   * Replace the full set of linked skills for an agent with `skillIds`, assigning
   * order = index. Used by the "Skills" editor tab (attach/reorder). Skills not in
   * the list are unlinked.
   */
  async setSkills(agentId: string, skillIds: string[]): Promise<void> {
    // One transaction: a failed insert (e.g. unknown skill id) restores the old
    // links instead of leaving the agent with none.
    await this.db.transaction(async (tx) => {
      await tx.delete(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
      if (skillIds.length === 0) return;
      await tx
        .insert(t.agentSkills)
        .values(skillIds.map((skillId, i) => ({ agentId, skillId, order: i })));
    });
  }
}
