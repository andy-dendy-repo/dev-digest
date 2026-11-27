import { describe, it, expect } from 'vitest';
import type { Skill } from '@devdigest/shared';
import { SkillsService } from '../src/modules/skills/service.js';
import { parseSkillImport, splitFrontmatter } from '../src/modules/skills/import-parser.js';
import type { NewSkill, SkillPatch, SkillsPort } from '../src/modules/skills/ports.js';

/** Hermetic: the import parser (pure) and SkillsService over an in-memory port. */

describe('parseSkillImport', () => {
  it('takes SKILL.md (shallowest) as the core and reads its frontmatter', () => {
    const preview = parseSkillImport({
      filename: 'pack.zip',
      entries: [
        { path: 'pack/nested/SKILL.md', content: '---\nname: wrong\n---\nbody' },
        {
          path: 'pack/SKILL.md',
          content:
            '---\nname: Flaky Test Patterns\ndescription: >\n  Flag tests that depend on\n  time or order.\ntype: rubric\nmetadata:\n  version: "1.0"\n---\n# Flaky tests\n\nLook for sleeps.\n',
        },
        { path: 'pack/references.md', content: '# refs' },
      ],
      skipped: ['pack/scripts/detect.sh'],
    });
    expect(preview.core_path).toBe('pack/SKILL.md');
    expect(preview.draft).toEqual({
      name: 'flaky-test-patterns',
      description: 'Flag tests that depend on time or order.',
      type: 'rubric',
      body: '# Flaky tests\n\nLook for sleeps.',
    });
    expect(preview.ignored).toEqual(
      expect.arrayContaining([
        { path: 'pack/scripts/detect.sh', reason: 'not_text' },
        { path: 'pack/references.md', reason: 'not_core' },
        { path: 'pack/nested/SKILL.md', reason: 'not_core' },
      ]),
    );
  });

  it('falls back to the only markdown file, its heading and first paragraph', () => {
    const preview = parseSkillImport({
      filename: 'rules.md',
      entries: [{ path: 'rules.md', content: '# No Then Chains\n\nUse async/await, never .then().\n' }],
      skipped: [],
    });
    expect(preview.draft).toMatchObject({
      name: 'no-then-chains',
      description: 'Use async/await, never .then().',
      type: 'custom',
    });
  });

  it('rejects an archive with no SKILL.md and several markdown files', () => {
    expect(() =>
      parseSkillImport({
        filename: 'x.zip',
        entries: [
          { path: 'a.md', content: 'a' },
          { path: 'b.md', content: 'b' },
        ],
        skipped: [],
      }),
    ).toThrow(/SKILL\.md/);
  });

  it('never treats a non-text entry as the core', () => {
    expect(() =>
      parseSkillImport({
        filename: 'x.zip',
        entries: [{ path: 'SKILL.md.sh', content: 'rm -rf /' }],
        skipped: [],
      }),
    ).toThrow(/No skill found/);
  });

  it('splitFrontmatter leaves a body without frontmatter untouched', () => {
    expect(splitFrontmatter('# Title\n---\nnot yaml')).toEqual({ frontmatter: {}, body: '# Title\n---\nnot yaml' });
  });
});

class FakeSkills implements SkillsPort {
  rows: (Skill & { workspaceId: string })[] = [];
  async list(ws: string) {
    return this.rows.filter((r) => r.workspaceId === ws);
  }
  async getById(ws: string, id: string) {
    return this.rows.find((r) => r.workspaceId === ws && r.id === id);
  }
  async nameTaken(ws: string, name: string, exceptId?: string) {
    return this.rows.some((r) => r.workspaceId === ws && r.name === name && r.id !== exceptId);
  }
  async insert(v: NewSkill) {
    const row = { ...v, id: `s${this.rows.length + 1}`, version: 1, evidence_files: null };
    this.rows.push(row);
    return row;
  }
  async update(ws: string, id: string, patch: SkillPatch) {
    const row = await this.getById(ws, id);
    if (!row) return undefined;
    Object.assign(row, patch);
    return row;
  }
  async deleteById() {
    return true;
  }
  async effectiveForAgent() {
    return [];
  }
}

describe('SkillsService', () => {
  const make = () => {
    const skills = new FakeSkills();
    return { skills, service: new SkillsService({ skills, countTokens: (t) => t.length }) };
  };
  const body = { name: 'test-corner-cases', description: 'Flag missing edge cases.', type: 'rubric' as const, body: 'Check empty input.' };

  it('stores an imported skill disabled even when asked to enable it (vetting gate)', async () => {
    const { service } = make();
    const skill = await service.create('ws', { ...body, source: 'imported_file', enabled: true });
    expect(skill.enabled).toBe(false);
    expect(skill.source).toBe('imported_file');
  });

  it('keeps a manual skill enabled by default and counts the tokens of its prompt block', async () => {
    const { service } = make();
    const skill = await service.create('ws', body);
    expect(skill.enabled).toBe(true);
    // '### test-corner-cases\n> Flag missing edge cases.\n\nCheck empty input.'
    expect(skill.token_count).toBe(68);
  });

  it('rejects a duplicate name in the workspace with 409 (create and rename)', async () => {
    const { service } = make();
    await service.create('ws', body);
    const other = await service.create('ws', { ...body, name: 'other' });
    await expect(service.create('ws', body)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.update('ws', other.id, { name: body.name })).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.create('ws2', body)).resolves.toMatchObject({ name: body.name });
  });
});
