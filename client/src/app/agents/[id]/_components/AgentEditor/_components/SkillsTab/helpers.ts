import type { AgentSkillView, Skill } from "@devdigest/shared";

/** One row of the Skills tab: a workspace skill and its state for this agent. */
export interface SkillRow {
  skill_id: string;
  name: string;
  description: string;
  type: Skill["type"];
  source: Skill["source"];
  /** Linked to this agent (an unlinked skill becomes linked when enabled or moved). */
  linked: boolean;
  /** Enabled for this agent. */
  enabled: boolean;
  /** The skill's global switch. */
  skill_enabled: boolean;
}

/** Linked skills in prompt order, then the workspace's other skills by name. */
export function buildRows(links: AgentSkillView[], skills: Skill[]): SkillRow[] {
  const linkedIds = new Set(links.map((l) => l.skill_id));
  const linked = [...links]
    .sort((a, b) => a.order - b.order)
    .map((l) => ({
      skill_id: l.skill_id,
      name: l.name,
      description: l.description,
      type: l.type,
      source: l.source,
      linked: true,
      enabled: l.enabled,
      skill_enabled: l.skill_enabled,
    }));
  const others = skills
    .filter((sk) => !linkedIds.has(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((sk) => ({
      skill_id: sk.id,
      name: sk.name,
      description: sk.description,
      type: sk.type,
      source: sk.source,
      linked: false,
      enabled: false,
      skill_enabled: sk.enabled,
    }));
  return [...linked, ...others];
}

/** The agent's new link list (prompt order) for PUT /agents/:id/skills. */
export function toLinks(rows: SkillRow[], agentId: string): AgentSkillView[] {
  return rows
    .filter((r) => r.linked)
    .map((r, order) => ({
      agent_id: agentId,
      skill_id: r.skill_id,
      order,
      enabled: r.enabled,
      name: r.name,
      description: r.description,
      type: r.type,
      source: r.source,
      skill_enabled: r.skill_enabled,
    }));
}

/** Toggle a row for this agent (enabling links it). */
export function toggleRow(rows: SkillRow[], skillId: string, enabled: boolean): SkillRow[] {
  return rows.map((r) => (r.skill_id === skillId ? { ...r, enabled, linked: r.linked || enabled } : r));
}

/** Move a row from one index to another; the moved row becomes linked so its place sticks. */
export function moveRow(rows: SkillRow[], from: number, to: number): SkillRow[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows;
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, { ...row!, linked: true });
  // Everything above a linked row must be linked too, or the order would not persist.
  const lastLinked = next.reduce((acc, r, i) => (r.linked ? i : acc), -1);
  return next.map((r, i) => (i <= lastLinked ? { ...r, linked: true } : r));
}

/** Skills that will run for this agent: enabled here AND globally. */
export function effectiveCount(rows: SkillRow[]): number {
  return rows.filter((r) => r.enabled && r.skill_enabled).length;
}

export function matchesFilter(row: SkillRow, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  return !q || `${row.name} ${row.description} ${row.type}`.toLowerCase().includes(q);
}
