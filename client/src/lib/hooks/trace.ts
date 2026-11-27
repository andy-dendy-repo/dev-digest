/* hooks/trace.ts — A5 Run Trace. GET /runs/:id/trace returns the ENTIRE
   trace of one run as a single document (config + stats + prompt_assembly +
   tool_calls[] + raw_output + memory_pulled[] + full log). Registered by A2;
   A5 enriches the document it returns. Live events stream via useRunEvents
   (hooks/reviews.ts) — the drawer combines both. */
"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { runKeys } from "@/lib/hooks/reviews";
import type { RunTrace } from "@devdigest/shared";

export const runTraceOptions = (runId: string) =>
  queryOptions({
    queryKey: runKeys.trace(runId),
    queryFn: () => api.get<RunTrace>(`/runs/${runId}/trace`),
    retry: false,
  });

export function useRunTrace(runId: string | null | undefined, enabled = true) {
  return useQuery({ ...runTraceOptions(runId ?? ""), enabled: !!runId && enabled });
}
