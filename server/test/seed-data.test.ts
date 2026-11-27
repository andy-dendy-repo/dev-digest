import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CreateSkillRequest } from '@devdigest/shared';
import { SEED_SKILLS, SEED_AGENT_SKILLS } from '../src/db/seed-skills.js';
import * as prompts from '../src/db/seed-prompts.js';

/**
 * Seed data without a DB: built-in skills pass the same contract a user's skill
 * must pass, links only reference seeded skills, and every built-in prompt is
 * identical to its reviewable copy in docs/agent-prompts/.
 */
describe('seed data', () => {
  it('every seeded skill is a valid CreateSkillRequest with a directive one-sentence description', () => {
    for (const s of SEED_SKILLS) {
      const parsed = CreateSkillRequest.safeParse(s);
      expect(parsed.success, `${s.name}: ${parsed.error?.message}`).toBe(true);
      expect(s.description, s.name).toMatch(/^(Flag|Use when)\b/);
      expect(s.description.trim().endsWith('.'), s.name).toBe(true);
      const lines = s.body.split('\n').length;
      expect(lines, `${s.name} body lines`).toBeGreaterThanOrEqual(15);
      expect(lines, `${s.name} body lines`).toBeLessThanOrEqual(45);
    }
    const names = SEED_SKILLS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('agent links reference seeded skills once each', () => {
    const names = new Set(SEED_SKILLS.map((s) => s.name));
    for (const [agent, links] of Object.entries(SEED_AGENT_SKILLS)) {
      for (const l of links) expect(names.has(l.skill), `${agent} → ${l.skill}`).toBe(true);
      expect(new Set(links.map((l) => l.skill)).size, agent).toBe(links.length);
    }
    const linked = new Set(Object.values(SEED_AGENT_SKILLS).flat().map((l) => l.skill));
    expect(linked.has('api-breaking-changes')).toBe(false);
  });

  it.each([
    ['GENERAL_REVIEWER_PROMPT', 'general-reviewer.md'],
    ['SECURITY_REVIEWER_PROMPT', 'security-reviewer.md'],
    ['PERFORMANCE_REVIEWER_PROMPT', 'performance-reviewer.md'],
    ['TEST_QUALITY_REVIEWER_PROMPT', 'test-quality-reviewer.md'],
  ] as const)('%s matches docs/agent-prompts/%s', (constant, file) => {
    const doc = readFileSync(fileURLToPath(new URL(`../../docs/agent-prompts/${file}`, import.meta.url)), 'utf8');
    expect(prompts[constant]).toBe(doc.replace(/\n$/, ''));
  });
});
