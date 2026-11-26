/* hooks/repos.ts — connected repositories (GET/POST /repos, refresh, delete)
   and their project-context files (GET /repos/:id/context, reindex). */
"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { pullKeys } from "@/lib/hooks/pulls";
import type { IndexStatus, Repo, SpecFile } from "@devdigest/shared";

export const repoKeys = {
  all: ["repos"] as const,
  list: () => [...repoKeys.all, "list"] as const,
  context: (repoId: string) => [...repoKeys.all, "context", repoId] as const,
};

export const reposOptions = () =>
  queryOptions({
    queryKey: repoKeys.list(),
    queryFn: () => api.get<Repo[]>("/repos"),
  });

export const contextFilesOptions = (repoId: string) =>
  queryOptions({
    queryKey: repoKeys.context(repoId),
    queryFn: () => api.get<SpecFile[]>(`/repos/${repoId}/context`),
  });

export function useRepos() {
  return useQuery(reposOptions());
}

export function useAddRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api.post<Repo>("/repos", { url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: repoKeys.list() }),
    // AddRepoView shows the failure inline next to the URL field (form error).
    meta: { errorToast: false },
  });
}

export function useRefreshRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => api.post<Repo>(`/repos/${repoId}/refresh`),
    onSuccess: (_d, repoId) => {
      qc.invalidateQueries({ queryKey: repoKeys.list() });
      qc.invalidateQueries({ queryKey: pullKeys.list(repoId) });
    },
  });
}

export function useDeleteRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => api.del<{ deleted: string }>(`/repos/${repoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: repoKeys.list() }),
  });
}

// ---- Project Context (A3 contract; safe to call once API exposes it) ----
export function useContextFiles(repoId: string | null | undefined) {
  return useQuery({ ...contextFilesOptions(repoId ?? ""), enabled: !!repoId });
}

export function useReindexContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => api.post<IndexStatus>(`/repos/${repoId}/context/reindex`),
    onSuccess: (_d, repoId) => qc.invalidateQueries({ queryKey: repoKeys.context(repoId) }),
  });
}
