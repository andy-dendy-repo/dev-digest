/* usePrDetail — data, URL state and run wiring of the PR detail screen. */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePullDetail, usePulls } from "@/lib/hooks/pulls";
import { runKeys, useDeleteRun, usePrActiveRuns, usePrReviews, usePrRuns } from "@/lib/hooks/reviews";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { countFindings, prDetailHref, prIdForNumber } from "./helpers";

export function usePrDetail(repoId: string, number: string) {
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);

  // Resolve number → uuid via the (cached) pulls list before fetching the PR.
  const { data: pulls, isLoading: pullsLoading } = usePulls(repoId);
  const prId = prIdForNumber(pulls, Number(number));
  const detail = usePullDetail(prId);
  const { data: reviews = [], refetch: refetchReviews } = usePrReviews(prId);

  // Live run tracking is SERVER-SOURCED (agent_runs status='running'): survives
  // navigation AND reload, and self-clears via polling when runs finish.
  const { data: activeRuns } = usePrActiveRuns(prId);
  const { data: prRuns } = usePrRuns(prId);
  const deleteRun = useDeleteRun(prId);
  const liveRunIds = (activeRuns ?? []).map((r) => r.run_id);

  const setParam = (key: string, value: string | null) =>
    router.replace(prDetailHref(repoId, number, search, key, value));

  const refreshActiveRuns = () => {
    if (prId) qc.invalidateQueries({ queryKey: runKeys.active(prId) });
  };

  return {
    repoNotFound,
    /** "owner/repo"; null until the repo is loaded (no GitHub links yet). */
    repoFullName: activeRepo?.full_name ?? null,
    prId,
    pr: detail.data,
    isLoading: pullsLoading || (prId != null && detail.isLoading),
    isError: detail.isError,
    error: detail.error,
    refetch: detail.refetch,
    reviews,
    findingsCount: countFindings(reviews),
    prRuns,
    liveRunIds,
    tab: search.get("tab") ?? "overview",
    setTab: (tab: string) => setParam("tab", tab),
    traceRunId: search.get("trace"),
    openTrace: (runId: string) => setParam("trace", runId),
    closeTrace: () => setParam("trace", null),
    deleteRun: (runId: string) => deleteRun.mutate(runId),
    /** A review was started: pick up its in-flight runs now instead of on the next poll. */
    onRunsStarted: refreshActiveRuns,
    /** Live runs settled (done OR failed): refresh the history too, so a just-failed
        run shows up in the timeline without a reload. */
    onRunDone: () => {
      refreshActiveRuns();
      if (prId) qc.invalidateQueries({ queryKey: runKeys.history(prId) });
      refetchReviews();
    },
  };
}
