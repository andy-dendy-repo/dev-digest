/**
 * clone-reader adapter — the repo-intel `CloneReader` port over the local
 * filesystem.
 *
 * A cloned repo is untrusted input: every read goes through
 * `readContainedFile` (the resolved path must stay inside the clone, be a
 * regular file and fit the size cap), and the walk never follows symlinks.
 */
import { readContainedFile } from '../../platform/contained-read.js';
import type { CloneReader, WalkResult } from '../../modules/repo-intel/ports.js';
import { walkClone } from './walk.js';

export class FsCloneReader implements CloneReader {
  readFile(clonePath: string, relPath: string): Promise<string | null> {
    return readContainedFile(clonePath, relPath);
  }

  walk(clonePath: string): Promise<WalkResult> {
    return walkClone(clonePath);
  }
}
