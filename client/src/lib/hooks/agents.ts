/* hooks/agents.ts — React Query hooks for the A2 Agents tab + Agent Editor. */
"use client";

import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Agent, AgentSkillView, ModelInfo, Provider, ReviewStrategy, SetAgentSkillsRequest } from "@devdigest/shared";

export const agentKeys = {
  all: ["agents"] as const,
  list: () => [...agentKeys.all, "list"] as const,
  detail: (id: string) => [...agentKeys.all, "detail", id] as const,
  skills: (id: string) => [...agentKeys.all, "skills", id] as const,
};

/** Model lists per provider. Settings invalidates them when a provider key changes. */
export const providerModelKeys = {
  all: ["provider-models"] as const,
  byProvider: (provider: Provider | null) => [...providerModelKeys.all, provider] as const,
};

export const agentsOptions = () =>
  queryOptions({
    queryKey: agentKeys.list(),
    queryFn: () => api.get<Agent[]>("/agents"),
  });

export const agentOptions = (id: string) =>
  queryOptions({
    queryKey: agentKeys.detail(id),
    queryFn: () => api.get<Agent>(`/agents/${id}`),
  });

export const providerModelsOptions = (provider: Provider | null) =>
  queryOptions({
    queryKey: providerModelKeys.byProvider(provider),
    queryFn: () => api.get<ModelInfo[]>(`/providers/${provider}/models`),
    enabled: provider != null,
    staleTime: 5 * 60_000,
  });

export function useAgents() {
  return useQuery(agentsOptions());
}

export function useAgent(id: string | null | undefined) {
  return useQuery({ ...agentOptions(id ?? ""), enabled: !!id });
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  system_prompt: string;
  output_schema?: unknown;
  strategy?: ReviewStrategy;
  enabled?: boolean;
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => api.post<Agent>("/agents", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeys.list() }),
  });
}

export interface UpdateAgentInput {
  id: string;
  patch: Partial<
    Pick<
      Agent,
      | "name"
      | "description"
      | "provider"
      | "model"
      | "system_prompt"
      | "output_schema"
      | "strategy"
      | "ci_fail_on"
      | "repo_intel"
      | "enabled"
    >
  >;
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateAgentInput) => api.put<Agent>(`/agents/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: agentKeys.list() });
      qc.setQueryData(agentKeys.detail(data.id), data);
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/agents/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: agentKeys.list() });
      qc.removeQueries({ queryKey: agentKeys.detail(id) });
    },
  });
}

/** Dynamic model list for a provider (editor model picker). */
export function useProviderModels(provider: Provider | null | undefined) {
  return useQuery(providerModelsOptions(provider ?? null));
}

export const agentSkillsOptions = (agentId: string) =>
  queryOptions({
    queryKey: agentKeys.skills(agentId),
    queryFn: () => api.get<AgentSkillView[]>(`/agents/${agentId}/skills`),
  });

/** The agent's linked skills, in prompt order (Skills tab). */
export function useAgentSkills(agentId: string) {
  return useQuery(agentSkillsOptions(agentId));
}

/**
 * Replace the agent's ordered skill list with `next` (its linked skills, in
 * prompt order). Optimistic: the tab reorders/toggles at once and rolls back if
 * the server refuses.
 */
export function useSetAgentSkills(agentId: string) {
  const qc = useQueryClient();
  const key = agentKeys.skills(agentId);
  return useMutation({
    // Saves for one agent run one after another, so an earlier response can't
    // overwrite the optimistic state of a later click.
    scope: { id: `agent-skills-${agentId}` },
    mutationFn: (next: AgentSkillView[]) => {
      const body: SetAgentSkillsRequest = {
        skills: next.map((v) => ({ skill_id: v.skill_id, enabled: v.enabled })),
      };
      return api.put<AgentSkillView[]>(`/agents/${agentId}/skills`, body);
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AgentSkillView[]>(key);
      qc.setQueryData(key, next);
      return { previous };
    },
    onError: (_e, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      // skill_count on the cards + the new agent version.
      qc.invalidateQueries({ queryKey: agentKeys.list() });
      qc.invalidateQueries({ queryKey: agentKeys.detail(agentId) });
    },
  });
}
