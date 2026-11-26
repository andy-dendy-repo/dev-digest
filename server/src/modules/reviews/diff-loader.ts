import type { UnifiedDiff } from '@devdigest/shared';
import { parseUnifiedDiff } from './diff.js';
import type { PrFilePatch, ReviewPull, ReviewRepoRef } from './domain.js';
import type { DiffLoaderDeps, DiffSource } from './ports.js';

/**
 * Load the unified diff for a PR. Prefers a real `git diff base...head`; falls
 * back to assembling a synthetic unified diff from the persisted pr_files
 * patches (so the reviewer works even before a clone completes / in tests).
 */
export class DiffLoader implements DiffSource {
  constructor(private readonly deps: DiffLoaderDeps) {}

  async load(pull: ReviewPull, repo: ReviewRepoRef): Promise<UnifiedDiff> {
    try {
      const diff = await this.deps
        .git()
        .diff({ owner: repo.owner, name: repo.name }, pull.base, pull.headSha);
      if (diff.files.length > 0) return diff;
    } catch {
      /* fall through to pr_files reconstruction */
    }
    return diffFromPrFiles(await this.deps.pulls.getPrFiles(pull.id));
  }
}

/** Reconstruct a UnifiedDiff from persisted pr_files patches. */
export function diffFromPrFiles(files: PrFilePatch[]): UnifiedDiff {
  const parts: string[] = [];
  for (const f of files) {
    if (!f.patch) continue;
    parts.push(`diff --git a/${f.path} b/${f.path}`);
    parts.push(`--- a/${f.path}`);
    parts.push(`+++ b/${f.path}`);
    parts.push(f.patch);
  }
  return parseUnifiedDiff(parts.join('\n'));
}
