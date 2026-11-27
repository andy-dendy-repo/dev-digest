import type { GitClient, JobQueue } from '@devdigest/shared';

/**
 * Ports of the repos module (Application ring). Domain types only; the Drizzle
 * implementation (`repository.ts`) returns rows that satisfy these shapes.
 */

/** A stored repository (`repos` row, camelCase domain shape). */
export interface RepoRecord {
  id: string;
  workspaceId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  clonePath: string | null;
  lastPolledAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface NewRepo {
  workspaceId: string;
  owner: string;
  name: string;
  fullName: string;
  createdBy: string;
}

/** Persistence of repos. Every workspace-facing query is scoped by `workspaceId`. */
export interface ReposPort {
  list(workspaceId: string): Promise<RepoRecord[]>;
  getById(workspaceId: string, id: string): Promise<RepoRecord | undefined>;
  findByFullName(workspaceId: string, fullName: string): Promise<RepoRecord | undefined>;
  insert(values: NewRepo): Promise<RepoRecord>;
  /** Owning workspace of a repo (unscoped; for job follow-ups). */
  workspaceIdFor(repoId: string): Promise<string | null>;
  /** Persist the clone path and bump `last_polled_at` once a clone completes. */
  updateClonePath(repoId: string, clonePath: string): Promise<void>;
  remove(workspaceId: string, id: string): Promise<boolean>;
}

export interface RepoServiceDeps {
  repos: ReposPort;
  jobs: JobQueue;
  /** Resolved per call (the container builds the git adapter lazily). */
  git: () => GitClient;
}
