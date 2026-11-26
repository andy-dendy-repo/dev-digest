import { z } from 'zod';

/**
 * Shared route param schemas. Most `/:id` routes address a DB row whose primary
 * key is a uuid (see db/schema/*), so validate that shape at the edge — an
 * invalid id becomes a clean 422 instead of a downstream DB/500.
 *
 * NOTE: not every `:id` is a uuid (e.g. `/providers/:id` where id is a provider
 * name like "openai"); those routes use their own schema.
 */
export const IdParams = z.object({ id: z.string().uuid() });
export type IdParams = z.infer<typeof IdParams>;

/** `{ ok: true }` — acknowledgement body of delete/cancel style routes. */
export const OkResponse = z.object({ ok: z.literal(true) });

/** `{ ok }` — acknowledgement that reports whether anything was affected. */
export const OkFlagResponse = z.object({ ok: z.boolean() });
