/* hooks/pulls.ts — pull requests of a repo (GET /repos/:id/pulls, GET /pulls/:id)
   and their inline GitHub review comments (GET/POST /pulls/:id/comments). */
"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PrCommentInput, PrDetail, PrMeta, PrReviewComment } from "@devdigest/shared";

export const pullKeys = {
  all: ["pulls"] as const,
  list: (repoId: string) => [...pullKeys.all, "list", repoId] as const,
  detail: (prId: string) => [...pullKeys.all, "detail", prId] as const,
  comments: (prId: string) => [...pullKeys.all, "comments", prId] as const,
};

export const pullsOptions = (repoId: string) =>
  queryOptions({
    queryKey: pullKeys.list(repoId),
    queryFn: () => api.get<PrMeta[]>(`/repos/${repoId}/pulls`),
    // Auto-refresh PR statuses: re-sync from GitHub every 60s while the page is
    // open, and whenever the window regains focus.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

export const pullDetailOptions = (prId: string) =>
  queryOptions({
    queryKey: pullKeys.detail(prId),
    queryFn: () => api.get<PrDetail>(`/pulls/${prId}`),
  });

/** Existing GitHub PR review comments, fetched live. */
export const prCommentsOptions = (prId: string) =>
  queryOptions({
    queryKey: pullKeys.comments(prId),
    queryFn: () => api.get<PrReviewComment[]>(`/pulls/${prId}/comments`),
  });

export function usePulls(repoId: string | null | undefined) {
  return useQuery({ ...pullsOptions(repoId ?? ""), enabled: !!repoId });
}

export function usePullDetail(prId: string | null | undefined) {
  return useQuery({ ...pullDetailOptions(prId ?? ""), enabled: !!prId });
}

export function usePrComments(prId: string | null | undefined) {
  return useQuery({ ...prCommentsOptions(prId ?? ""), enabled: !!prId });
}

/** Post one inline comment (or reply) to GitHub; refreshes the thread list. */
export function useCreatePrComment(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PrCommentInput) =>
      api.post<PrReviewComment>(`/pulls/${prId}/comments`, input),
    onSuccess: () => {
      if (prId) qc.invalidateQueries({ queryKey: pullKeys.comments(prId) });
    },
  });
}
