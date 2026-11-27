import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeleteRun, reviewKeys, runKeys } from "./reviews";
import { useRefreshRepo, repoKeys } from "./repos";
import { pullKeys } from "./pulls";
import { useTestConnection, settingsKeys } from "./settings";
import { agentKeys, providerModelKeys } from "./agents";
import { skillKeys, useUpdateSkill } from "./skills";

vi.mock("@/lib/api", () => ({
  API_BASE: "http://api.test",
  api: {
    get: vi.fn(),
    put: vi.fn(async () => ({ id: "s1", name: "x" })),
    patch: vi.fn(),
    post: vi.fn(async () => ({ ok: true })),
    del: vi.fn(async () => ({ ok: true })),
  },
}));

/** Seeds every key with data so we can read which ones a mutation invalidated. */
function setup(keys: readonly (readonly unknown[])[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of keys) qc.setQueryData(key, []);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const isInvalidated = (key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated ?? false;
  return { wrapper, isInvalidated };
}

describe("mutations invalidate through the key factories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deleting a run refreshes that PR's history and reviews, not its active runs or other PRs", async () => {
    const { wrapper, isInvalidated } = setup([
      runKeys.history("pr-1"),
      runKeys.active("pr-1"),
      reviewKeys.byPr("pr-1"),
      runKeys.history("pr-2"),
    ]);
    const { result } = renderHook(() => useDeleteRun("pr-1"), { wrapper });

    result.current.mutate("run-9");

    await waitFor(() => expect(isInvalidated(runKeys.history("pr-1"))).toBe(true));
    expect(isInvalidated(reviewKeys.byPr("pr-1"))).toBe(true);
    expect(isInvalidated(runKeys.active("pr-1"))).toBe(false);
    expect(isInvalidated(runKeys.history("pr-2"))).toBe(false);
  });

  it("refreshing a repo refreshes the repo list and that repo's pulls only", async () => {
    const { wrapper, isInvalidated } = setup([
      repoKeys.list(),
      pullKeys.list("repo-a"),
      pullKeys.list("repo-b"),
    ]);
    const { result } = renderHook(() => useRefreshRepo(), { wrapper });

    result.current.mutate("repo-a");

    await waitFor(() => expect(isInvalidated(pullKeys.list("repo-a"))).toBe(true));
    expect(isInvalidated(repoKeys.list())).toBe(true);
    expect(isInvalidated(pullKeys.list("repo-b"))).toBe(false);
  });

  it("a successful key test refreshes every provider's models and the key status, not settings", async () => {
    const { wrapper, isInvalidated } = setup([
      providerModelKeys.byProvider("openai"),
      providerModelKeys.byProvider("anthropic"),
      settingsKeys.secretsStatus(),
      settingsKeys.detail(),
    ]);
    const { result } = renderHook(() => useTestConnection(), { wrapper });

    result.current.mutate("openai");

    await waitFor(() => expect(isInvalidated(settingsKeys.secretsStatus())).toBe(true));
    expect(isInvalidated(providerModelKeys.byProvider("openai"))).toBe(true);
    expect(isInvalidated(providerModelKeys.byProvider("anthropic"))).toBe(true);
    expect(isInvalidated(settingsKeys.detail())).toBe(false);
  });

  it("editing a skill refreshes the skill list and every agent query, not other skills' details", async () => {
    const { wrapper, isInvalidated } = setup([
      skillKeys.list(),
      skillKeys.detail("s2"),
      agentKeys.list(),
      agentKeys.detail("a1"),
    ]);
    const { result } = renderHook(() => useUpdateSkill(), { wrapper });

    result.current.mutate({ id: "s1", patch: { enabled: false } });

    await waitFor(() => expect(isInvalidated(skillKeys.list())).toBe(true));
    expect(isInvalidated(agentKeys.list())).toBe(true);
    expect(isInvalidated(agentKeys.detail("a1"))).toBe(true);
    expect(isInvalidated(skillKeys.detail("s2"))).toBe(false);
  });
});
