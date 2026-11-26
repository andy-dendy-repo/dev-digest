/* hooks/settings.ts — settings and provider-key status
   (GET/PUT /settings, POST /settings/test-connection, GET /settings/secrets-status). */
"use client";

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { providerModelKeys } from "@/lib/hooks/agents";
import type {
  ConnTestProvider,
  ConnTestResult,
  SecretsStatus,
  Settings,
  SettingsUpdate,
} from "@devdigest/shared";

export const settingsKeys = {
  all: ["settings"] as const,
  detail: () => [...settingsKeys.all, "detail"] as const,
  secretsStatus: () => [...settingsKeys.all, "secrets-status"] as const,
};

export const settingsOptions = () =>
  queryOptions({
    queryKey: settingsKeys.detail(),
    queryFn: () => api.get<Settings>("/settings"),
  });

/** Which provider keys are configured (booleans only — never the values). */
export const secretsStatusOptions = () =>
  queryOptions({
    queryKey: settingsKeys.secretsStatus(),
    queryFn: () => api.get<SecretsStatus>("/settings/secrets-status"),
    staleTime: 30_000,
  });

export function useSettings() {
  return useQuery(settingsOptions());
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsUpdate) => api.put<Settings>("/settings", patch),
    onSuccess: (data) => qc.setQueryData(settingsKeys.detail(), data),
  });
}

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnTestProvider | { provider: ConnTestProvider; key?: string }) => {
      const body = typeof input === "string" ? { provider: input } : input;
      return api.post<ConnTestResult>("/settings/test-connection", body);
    },
    // Saving/validating a provider key can change which models resolve — drop the
    // cached (possibly empty) model lists so the agent picker refetches, and
    // refresh the "Configured / Not set" key-status badges.
    onSuccess: (res) => {
      if (res.ok) {
        qc.invalidateQueries({ queryKey: providerModelKeys.all });
        qc.invalidateQueries({ queryKey: settingsKeys.secretsStatus() });
      }
    },
  });
}

export function useSecretsStatus() {
  return useQuery(secretsStatusOptions());
}
