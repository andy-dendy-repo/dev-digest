import type { ReposPort } from '../repos/ports.js';

/** `GET /workspace` payload: where clones live + a summary of the workspace's repos. */
export interface WorkspaceSummary {
  workspaceId: string;
  cloneDir: string;
  repos: {
    id: string;
    full_name: string;
    clone_path: string | null;
    last_polled_at: string | null;
    cloned: boolean;
  }[];
}

export interface WorkspaceServiceDeps {
  repos: Pick<ReposPort, 'list'>;
  cloneDir: string;
}

/**
 * F1 — workspace manager overview. Cleanup / re-pull of individual repos is
 * the repos module's job (refresh/delete); this only summarises.
 */
export class WorkspaceService {
  constructor(private deps: WorkspaceServiceDeps) {}

  async summary(workspaceId: string): Promise<WorkspaceSummary> {
    const repos = await this.deps.repos.list(workspaceId);
    return {
      workspaceId,
      cloneDir: this.deps.cloneDir,
      repos: repos.map((r) => ({
        id: r.id,
        full_name: r.fullName,
        clone_path: r.clonePath,
        last_polled_at: r.lastPolledAt?.toISOString() ?? null,
        cloned: Boolean(r.clonePath),
      })),
    };
  }
}
