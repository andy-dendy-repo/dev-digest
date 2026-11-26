import { z } from 'zod';

/** `GET /workspace` payload: where clones live + a summary of the workspace's repos. */
export const WorkspaceSummary = z.object({
  workspaceId: z.string(),
  cloneDir: z.string(),
  repos: z.array(
    z.object({
      id: z.string(),
      full_name: z.string(),
      clone_path: z.string().nullable(),
      last_polled_at: z.string().nullable(),
      cloned: z.boolean(),
    }),
  ),
});
export type WorkspaceSummary = z.infer<typeof WorkspaceSummary>;
