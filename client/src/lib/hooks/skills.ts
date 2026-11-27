/* hooks/skills.ts — React Query hooks for the Skills pages (M2). */
"use client";

import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreateSkillRequest,
  Skill,
  SkillImportPreview,
  SkillImportRequest,
  UpdateSkillRequest,
} from "@devdigest/shared";
import { agentKeys } from "./agents";

export const skillKeys = {
  all: ["skills"] as const,
  list: () => [...skillKeys.all, "list"] as const,
  detail: (id: string) => [...skillKeys.all, "detail", id] as const,
};

export const skillsOptions = () =>
  queryOptions({
    queryKey: skillKeys.list(),
    queryFn: () => api.get<Skill[]>("/skills"),
  });

export const skillOptions = (id: string) =>
  queryOptions({
    queryKey: skillKeys.detail(id),
    queryFn: () => api.get<Skill>(`/skills/${id}`),
  });

export function useSkills() {
  return useQuery(skillsOptions());
}

export function useSkill(id: string | null | undefined) {
  return useQuery({ ...skillOptions(id ?? ""), enabled: !!id });
}

/**
 * A skill change can change what every agent runs with (skill_count, the agent
 * Skills tab), so agent queries are refreshed too.
 */
function useInvalidateSkillConsumers() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: skillKeys.list() });
    qc.invalidateQueries({ queryKey: agentKeys.all });
  };
}

export function useCreateSkill() {
  const invalidate = useInvalidateSkillConsumers();
  return useMutation({
    mutationFn: (input: CreateSkillRequest) => api.post<Skill>("/skills", input),
    onSuccess: invalidate,
    // The create and import modals show the error (e.g. a taken name) inline.
    meta: { errorToast: false },
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: UpdateSkillRequest;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  const invalidate = useInvalidateSkillConsumers();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.setQueryData(skillKeys.detail(data.id), data);
      invalidate();
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  const invalidate = useInvalidateSkillConsumers();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: skillKeys.detail(id) });
      invalidate();
    },
  });
}

/** Parse an upload server-side for the confirmation preview. Stores nothing. */
export function usePreviewSkillImport() {
  return useMutation({
    mutationFn: (input: SkillImportRequest) => api.post<SkillImportPreview>("/skills/import/preview", input),
    // The import modal shows the error inline.
    meta: { errorToast: false },
  });
}
