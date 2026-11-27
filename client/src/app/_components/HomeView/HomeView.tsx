/* Root — sends the user to the first repo's PR list, or onboarding if no repos. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { EmptyState, Button, Skeleton } from "@devdigest/ui";
import { useRepos } from "@/lib/hooks/repos";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-shell";
import { s } from "./styles";

export function HomeView() {
  const router = useRouter();
  const { data: repos, isLoading, isError } = useRepos();
  const first = repos?.[0];

  React.useEffect(() => {
    if (first) router.replace(`/repos/${first.id}/pulls`);
  }, [first, router]);

  return (
    <AppShell crumb={[{ label: "DevDigest" }]}>
      <PageContainer title="Welcome to DevDigest" subtitle="Local-first AI PR review">
        {isLoading ? (
          <div style={s.loading}>
            <Skeleton height={20} width={240} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : isError || !first ? (
          <EmptyState
            icon="GitBranch"
            title="No repositories yet"
            body="Add a repository to start reviewing pull requests. Set your API keys once in Settings → API Keys."
            cta="Add repository"
            onCta={() => router.push("/onboarding")}
          />
        ) : (
          <div>
            <p style={s.redirecting}>Taking you to your repository…</p>
            <Button kind="primary" onClick={() => router.push(`/repos/${first.id}/pulls`)}>
              Open {first.full_name}
            </Button>
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
