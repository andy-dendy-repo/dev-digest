import { z } from 'zod';
import { CiFailOn, Provider, ReviewStrategy } from '@devdigest/shared';

/**
 * Agents domain: the request shapes of the Agents API. The route validates
 * with these schemas and the service takes the inferred types, so the two can
 * never drift apart.
 */

export const CreateAgentBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  provider: Provider,
  model: z.string().min(1),
  system_prompt: z.string().min(1),
  output_schema: z.unknown().optional(),
  strategy: ReviewStrategy.optional(),
  ci_fail_on: CiFailOn.optional(),
  repo_intel: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type CreateAgentInput = z.infer<typeof CreateAgentBody>;

export const UpdateAgentBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  provider: Provider.optional(),
  model: z.string().min(1).optional(),
  system_prompt: z.string().min(1).optional(),
  output_schema: z.unknown().optional(),
  strategy: ReviewStrategy.optional(),
  ci_fail_on: CiFailOn.optional(),
  repo_intel: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentBody>;
