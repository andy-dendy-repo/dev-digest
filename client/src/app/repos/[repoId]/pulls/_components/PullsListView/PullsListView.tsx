/* PR list view — /repos/:repoId/pulls. Fetches GET /repos/:id/pulls; the
   status filter lives in the query (?status), search and sort are local. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Skeleton, EmptyState, ErrorState, AutoTriggerStatus } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { usePulls } from "@/lib/hooks/pulls";
import { useRefreshRepo } from "@/lib/hooks/repos";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ApiError } from "@/lib/api";
import { COLUMN_KEYS, DEFAULT_STATUS_FILTER, SKELETON_ROWS, type PullsSort } from "../../constants";
import { pullCounts, visiblePulls } from "../../helpers";
import { s } from "../../styles";
import { PRRow } from "../PRRow";
import { FilterBar } from "../FilterBar";

export function PullsListView({ repoId }: { repoId: string }) {
  const t = useTranslations("prReview");
  const search = useSearchParams();
  const router = useRouter();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { data: pulls, isLoading, isError, error, refetch } = usePulls(repoId);
  const refresh = useRefreshRepo();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<PullsSort>("newest");

  const status = search.get("status") ?? DEFAULT_STATUS_FILTER;
  const setStatus = (key: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("status", key); // always explicit so "all" sticks over the default
    router.replace(`/repos/${repoId}/pulls?${sp.toString()}`);
  };

  const rows = visiblePulls(pulls ?? [], { status, query, sort });
  const counts = pullCounts(pulls ?? []);
  const crumb = [{ label: activeRepo?.full_name ?? repoId, mono: true }, { label: t("list.breadcrumb") }];

  // Stale/unknown :repoId → friendly empty state instead of a 404 error.
  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>{t("list.title")}</h1>
          <p style={s.pageSubtitle}>
            {pulls ? t("list.summary", counts) : t("list.loading")}
          </p>
        </div>
        <div style={s.headerActions}>
          <AutoTriggerStatus on={false} />
        </div>
      </div>

      <div style={s.tableCard}>
        <FilterBar
          active={status}
          onActive={setStatus}
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={(v) => setSort(v === "oldest" ? "oldest" : "newest")}
          onRefresh={() => refresh.mutate(repoId)}
          refreshing={refresh.isPending}
        />
        <div style={s.headRow}>
          {COLUMN_KEYS.map((key, i) => (
            <div key={key} style={s.headCell(i === COLUMN_KEYS.length - 1)}>
              {t(`list.columns.${key}`)}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div style={s.loadingStack}>
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <Skeleton key={i} height={28} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title={t("list.errorTitle")}
            body={error instanceof ApiError ? error.message : t("list.errorBody")}
            onRetry={() => refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="GitPullRequest"
            title={t("list.emptyTitle")}
            body={status === "all" ? t("list.emptyAllBody") : t("list.emptyStatusBody", { status })}
          />
        ) : (
          rows.map((pr) => <PRRow key={pr.number} pr={pr} repoId={repoId} />)
        )}
      </div>
    </AppShell>
  );
}
