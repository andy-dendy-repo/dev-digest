/**
 * Domain types of the reviews module: the shapes its use cases work with.
 * Persisted reviews/findings/runs use the shared contracts (`ReviewRecord`,
 * `FindingRecord`, `RunSummary`, `RunTrace`); the types below are the
 * module-internal views of a PR and its repo. `ReviewRepository` maps Drizzle
 * rows to them, so no core file sees a row type.
 */

/** A pull request as a review run needs it (workspace-scoped lookup). */
export interface ReviewPull {
  id: string;
  repoId: string;
  number: number;
  /** Author-controlled: fenced as untrusted in the prompt (`taskLine`). */
  title: string;
  /** Author-controlled: fenced as untrusted in the prompt (`taskLine`). */
  author: string;
  base: string;
  headSha: string;
  /** PR description; untrusted, wrapped + truncated by the engine. */
  body: string | null;
}

/** The repo a PR belongs to (git coordinates). */
export interface ReviewRepoRef {
  id: string;
  owner: string;
  name: string;
}

/** One persisted changed file of a PR (`pr_files`); `patch` is null for binaries/huge files. */
export interface PrFilePatch {
  path: string;
  patch: string | null;
}

/** An in-flight run of a PR (`GET /pulls/:id/runs/active`). */
export interface ActiveRun {
  run_id: string;
  agent_id: string | null;
  agent_name: string | null;
  ran_at: string | null;
}

/** Values for a new `agent_runs` row (created in `running` state). */
export interface NewAgentRun {
  workspaceId: string;
  agentId: string | null;
  prId: string;
  provider: string | null;
  model: string | null;
}
