import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';

/**
 * 404 unless the repo belongs to the workspace. For routes whose use case is
 * tenant-agnostic (the repo-intel facade takes a bare repo id), so a foreign
 * or unknown id never reaches it.
 */
export async function assertRepoInWorkspace(
  container: Container,
  workspaceId: string,
  repoId: string,
): Promise<void> {
  const repo = await container.reposRepo.getById(workspaceId, repoId);
  if (!repo) throw new NotFoundError('Repo not found');
}
