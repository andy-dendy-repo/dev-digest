/* PR Detail view — /repos/:repoId/pulls/:number. Header + Overview / Agent
   runs / Files changed tabs + the run trace drawer. Tab and open trace live in
   the query string (?tab, ?trace). */
"use client";

import React from "react";
import { Skeleton, ErrorState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { ApiError } from "@/lib/api";
import { githubPrUrl } from "@/lib/github-urls";
import { PrDetailHeader } from "../PrDetailHeader";
import { OverviewTab } from "../OverviewTab";
import { FindingsTab } from "../FindingsTab";
import { DiffTab } from "../DiffTab";
import { RunTraceDrawer } from "../RunTraceDrawer";
import { PrProvider } from "../pr-context";
import { usePrDetail } from "./usePrDetail";
import { s } from "./styles";

export function PrDetailView({ repoId, number }: { repoId: string; number: string }) {
  const d = usePrDetail(repoId, number);
  const { pr, prId, reviews, liveRunIds, traceRunId } = d;

  const crumb = [
    { label: d.repoFullName ?? repoId, mono: true, href: `/repos/${repoId}/pulls` },
    { label: "Pull Requests", href: `/repos/${repoId}/pulls` },
    { label: `#${number}`, mono: true },
  ];

  // Stale/unknown :repoId → friendly empty state instead of a 404 error.
  if (d.repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  if (d.isLoading) {
    return (
      <AppShell crumb={crumb}>
        <div style={s.loading}>
          <Skeleton height={28} width={420} />
          <Skeleton height={16} width={300} />
          <Skeleton height={200} />
        </div>
      </AppShell>
    );
  }

  if (d.isError || !pr || !prId) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title="Couldn't load this pull request"
          body={d.error instanceof ApiError ? d.error.message : `PR #${number} could not be loaded.`}
          onRetry={() => d.refetch()}
        />
      </AppShell>
    );
  }

  const traceReview = traceRunId ? reviews.find((r) => r.run_id === traceRunId) : undefined;

  return (
    <AppShell crumb={crumb}>
      <PrProvider value={{ prId, repoFullName: d.repoFullName, headSha: pr.head_sha }}>
        <PrDetailHeader
          pr={pr}
          prId={prId}
          tab={d.tab}
          findingsCount={d.findingsCount}
          githubUrl={d.repoFullName ? githubPrUrl(d.repoFullName, pr.number) : null}
          onSetTab={d.setTab}
          onRunStart={() => d.setTab("findings")}
          onRunsStarted={d.onRunsStarted}
        />

        <div style={s.body}>
          {d.tab === "overview" && <OverviewTab prBody={pr.body} />}

          {d.tab === "findings" && (
            <FindingsTab
              liveRunIds={liveRunIds}
              reviews={reviews}
              prRuns={d.prRuns}
              prCommits={pr.commits}
              onOpenTrace={d.openTrace}
              onDelete={(runId) => {
                if (window.confirm("Delete this run from history? (its logs are removed too)"))
                  d.deleteRun(runId);
              }}
              onRunDone={d.onRunDone}
            />
          )}

          {d.tab === "diff" && (
            <DiffTab prId={prId} filesCount={pr.files_count} files={pr.files} canComment={pr.status === "open"} />
          )}
        </div>

        {traceRunId && (
          <RunTraceDrawer
            key={traceRunId}
            runId={traceRunId}
            // A live run streams its log over SSE; the drawer falls back to the
            // persisted trace once the run leaves `activeRuns`.
            running={liveRunIds.includes(traceRunId)}
            prNumber={pr.number}
            findings={traceReview?.findings ?? []}
            agentName={traceReview?.agent_name ?? null}
            onClose={d.closeTrace}
          />
        )}
      </PrProvider>
    </AppShell>
  );
}
