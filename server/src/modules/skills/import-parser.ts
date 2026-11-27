import { SkillType, type SkillImportPreview, type SkillImportRequest } from '@devdigest/shared';
import { ValidationError } from '../../platform/errors.js';

/**
 * Skill import — extract the skill "core" from an uploaded `.md` file or the
 * text entries of an archive. Pure: nothing is stored or executed here.
 *
 * Core = `SKILL.md` (any case, shallowest path) → else the only markdown file.
 * Its YAML frontmatter gives `name` / `description` / optional `type`; the rest
 * of the file is the body. Every other entry is reported as ignored: other
 * text files as `not_core`, executable/binary entries (paths the browser
 * skipped without reading) as `not_text`.
 */

const TEXT_EXT = /\.(md|markdown|txt)$/i;
const MARKDOWN_EXT = /\.(md|markdown)$/i;
const MAX_BODY_CHARS = 65_536;
const MAX_DESCRIPTION_CHARS = 500;
const MAX_NAME_CHARS = 64;

type Frontmatter = Record<string, string>;

export function parseSkillImport(req: SkillImportRequest): SkillImportPreview {
  const entries = req.entries.map((e) => ({ path: normalizePath(e.path), content: e.content }));
  const ignored: SkillImportPreview['ignored'] = req.skipped.map((p) => ({
    path: normalizePath(p),
    reason: 'not_text' as const,
  }));

  const text = entries.filter((e) => TEXT_EXT.test(e.path));
  for (const e of entries) {
    if (!TEXT_EXT.test(e.path)) ignored.push({ path: e.path, reason: 'not_text' });
  }

  const core = pickCore(text);
  if (!core) {
    throw new ValidationError(
      'No skill found: the archive needs a SKILL.md (or exactly one markdown file).',
    );
  }
  for (const e of text) if (e !== core) ignored.push({ path: e.path, reason: 'not_core' });

  const { frontmatter, body } = splitFrontmatter(core.content);
  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) throw new ValidationError(`${core.path} has no body.`);
  if (trimmedBody.length > MAX_BODY_CHARS) {
    throw new ValidationError(`${core.path} is too long (max ${MAX_BODY_CHARS} characters).`);
  }

  const type = SkillType.safeParse(frontmatter.type?.toLowerCase());
  return {
    draft: {
      name: deriveName(frontmatter.name, trimmedBody, core.path, req.filename),
      description: deriveDescription(frontmatter.description, trimmedBody),
      type: type.success ? type.data : 'custom',
      body: trimmedBody,
    },
    core_path: core.path,
    ignored,
  };
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
}

function depth(p: string): number {
  return p.split('/').length;
}

function basename(p: string): string {
  return p.split('/').pop() ?? p;
}

function pickCore<T extends { path: string }>(text: T[]): T | undefined {
  const skillMd = text
    .filter((e) => basename(e.path).toLowerCase() === 'skill.md')
    .sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path));
  if (skillMd[0]) return skillMd[0];
  const markdown = text.filter((e) => MARKDOWN_EXT.test(e.path));
  return markdown.length === 1 ? markdown[0] : undefined;
}

/** Split a leading `---` YAML block from the body. Only flat string keys are read. */
export function splitFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const text = content.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return { frontmatter: {}, body: text };
  return { frontmatter: parseFlatYaml(m[1]!), body: text.slice(m[0].length) };
}

/**
 * Minimal YAML for skill frontmatter: top-level `key: value` (quoted or not)
 * and block scalars (`key: >` folded, `key: |` literal, or a bare `key:`
 * followed by indented lines). Nested maps are skipped.
 */
function parseFlatYaml(src: string): Frontmatter {
  const out: Frontmatter = {};
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const key = m[1]!;
    const raw = m[2]!.trim();
    if (raw === '' || /^[>|][+-]?$/.test(raw)) {
      const block: string[] = [];
      while (i + 1 < lines.length && /^([ \t]+|$)/.test(lines[i + 1]!) && !/^\S/.test(lines[i + 1]!)) {
        block.push(lines[++i]!.trim());
      }
      // A bare `key:` whose lines are `sub: value` is a nested map — not a string.
      if (raw === '' && block.some((l) => /^[\w-]+:/.test(l))) continue;
      const joined = raw.startsWith('|') ? block.join('\n') : block.filter(Boolean).join(' ');
      out[key] = joined.trim();
    } else {
      out[key] = unquote(raw);
    }
  }
  return out;
}

function unquote(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_CHARS)
    .replace(/-+$/, '');
}

function deriveName(fm: string | undefined, body: string, corePath: string, filename: string): string {
  const heading = /^#\s+(.+)$/m.exec(body)?.[1];
  const parts = corePath.split('/');
  const file = basename(corePath).replace(/\.[^.]+$/, '');
  // `pack/SKILL.md` → the folder name; a lone SKILL.md → the uploaded file's name.
  const fromPath =
    file.toLowerCase() === 'skill'
      ? (parts.length > 1 ? parts[parts.length - 2]! : filename.replace(/\.[^.]+$/, ''))
      : file;
  for (const candidate of [fm, heading, fromPath]) {
    const slug = candidate ? slugify(candidate) : '';
    if (slug) return slug;
  }
  return 'imported-skill';
}

function deriveDescription(fm: string | undefined, body: string): string {
  const fromBody = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith('#'));
  const d = (fm ?? fromBody ?? '').replace(/\s+/g, ' ').trim();
  return d.slice(0, MAX_DESCRIPTION_CHARS);
}
