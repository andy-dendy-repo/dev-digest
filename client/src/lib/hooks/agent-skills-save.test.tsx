import React from "react";
import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AgentSkillView } from "@devdigest/shared";
import { agentKeys, useSetAgentSkills } from "./agents";

const h = vi.hoisted(() => ({ resolvers: [] as ((v: unknown) => void)[], bodies: [] as unknown[] }));
vi.mock("@/lib/api", () => ({
  api: {
    put: vi.fn((_url: string, body: unknown) => {
      h.bodies.push(body);
      return new Promise((resolve) => h.resolvers.push(resolve));
    }),
    get: vi.fn(),
  },
}));

const view = (skill_id: string, enabled: boolean): AgentSkillView => ({
  agent_id: "a1",
  skill_id,
  order: 0,
  enabled,
  name: skill_id,
  description: "",
  type: "rubric",
  source: "manual",
  skill_enabled: true,
});

describe("useSetAgentSkills", () => {
  it("applies each click at once, sends saves in click order, and lets only the last one settle the cache", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = agentKeys.skills("a1");
    qc.setQueryData(key, [view("s1", false)]);
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetAgentSkills("a1"), { wrapper });

    act(() => result.current.save([view("s1", true)]));
    act(() => result.current.save([view("s1", true), view("s2", true)]));
    // The second click is visible at once, although the first save is still in flight.
    expect(qc.getQueryData<AgentSkillView[]>(key)).toHaveLength(2);
    await waitFor(() => expect(h.resolvers).toHaveLength(1)); // second PUT waits for the first

    await act(async () => h.resolvers[0]!([view("s1", true)]));
    // The first response does not overwrite the queued second click, and nothing is refetched yet.
    expect(qc.getQueryData<AgentSkillView[]>(key)).toHaveLength(2);
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: key });

    await waitFor(() => expect(h.resolvers).toHaveLength(2));
    await act(async () => h.resolvers[1]!([view("s1", true), view("s2", true)]));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: key }));
    expect(h.bodies).toEqual([
      { skills: [{ skill_id: "s1", enabled: true }] },
      { skills: [{ skill_id: "s1", enabled: true }, { skill_id: "s2", enabled: true }] },
    ]);
  });
});
