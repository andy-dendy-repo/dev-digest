/* skill-archive.ts — turn an uploaded `.md` file or `.zip`/`.skill` archive into
   the text entries the server's import preview parses. Runs in the browser so
   that executable/binary archive entries are never inflated, read or sent:
   only their paths travel, as `skipped`. Nothing here executes anything. */
import { unzipSync } from "fflate";
import type { SkillImportRequest } from "@devdigest/shared";

/* Same limits as the server's `SkillImportRequest` contract. Copied, not imported:
   the client may only `import type` from @devdigest/shared — its barrel uses `.js`
   specifiers that Next's webpack cannot resolve (Vitest can, so tests won't catch it). */
const SKILL_IMPORT_MAX_ENTRIES = 50;
const SKILL_IMPORT_MAX_ENTRY_CHARS = 262_144;

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** Cap on the total inflated size of the text entries (zip-bomb guard). */
const MAX_INFLATED_BYTES = 4 * 1024 * 1024;
const TEXT_EXT = /\.(md|markdown|txt)$/i;
const ARCHIVE_EXT = /\.(zip|skill)$/i;
/** OS metadata that is neither a skill file nor worth listing. */
const NOISE = /(^|\/)(__MACOSX\/|\.DS_Store$)/;

export type SkillUploadErrorCode = "too_large" | "unsupported" | "bad_archive" | "no_text";

export class SkillUploadError extends Error {
  constructor(public readonly code: SkillUploadErrorCode) {
    super(code);
    this.name = "SkillUploadError";
  }
}

export const ACCEPTED_UPLOAD_TYPES = ".md,.markdown,.zip,.skill";

export async function readSkillUpload(file: File): Promise<SkillImportRequest> {
  if (file.size > MAX_UPLOAD_BYTES) throw new SkillUploadError("too_large");
  if (TEXT_EXT.test(file.name)) {
    const content = await file.text();
    if (content.length > SKILL_IMPORT_MAX_ENTRY_CHARS) throw new SkillUploadError("too_large");
    return { filename: file.name, entries: [{ path: file.name, content }], skipped: [] };
  }
  if (!ARCHIVE_EXT.test(file.name)) throw new SkillUploadError("unsupported");
  return readArchive(file.name, new Uint8Array(await file.arrayBuffer()));
}

/** Exported for tests: unzip text entries only; everything else is just a path. */
export function readArchive(filename: string, bytes: Uint8Array): SkillImportRequest {
  const skipped: string[] = [];
  let inflated = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Decide per entry BEFORE inflating it: a script or binary is never decompressed.
      filter: (f) => {
        if (f.name.endsWith("/") || NOISE.test(f.name)) return false;
        const keep =
          TEXT_EXT.test(f.name) &&
          f.originalSize <= SKILL_IMPORT_MAX_ENTRY_CHARS &&
          inflated + f.originalSize <= MAX_INFLATED_BYTES;
        if (keep) inflated += f.originalSize;
        else skipped.push(f.name);
        return keep;
      },
    });
  } catch {
    throw new SkillUploadError("bad_archive");
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries: SkillImportRequest["entries"] = [];
  for (const [path, data] of Object.entries(files)) {
    if (entries.length >= SKILL_IMPORT_MAX_ENTRIES) {
      skipped.push(path);
      continue;
    }
    try {
      entries.push({ path, content: decoder.decode(data) });
    } catch {
      skipped.push(path); // not valid UTF-8 → treat as binary
    }
  }
  if (entries.length === 0) throw new SkillUploadError("no_text");
  return { filename, entries, skipped };
}
