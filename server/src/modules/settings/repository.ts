import { eq, sql } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SettingsRow } from './helpers.js';
import type { SettingsPort } from './ports.js';

/** Drizzle implementation of `SettingsPort` over the `settings` key/value table. */
export class DrizzleSettingsRepository implements SettingsPort {
  constructor(private db: DbOrTx) {}

  async list(workspaceId: string): Promise<SettingsRow[]> {
    return this.db
      .select({ key: t.settings.key, value: t.settings.value })
      .from(t.settings)
      .where(eq(t.settings.workspaceId, workspaceId));
  }

  async upsertMany(workspaceId: string, userId: string, entries: SettingsRow[]): Promise<void> {
    // Last write wins for a key repeated in one call (one statement can't
    // upsert the same row twice).
    const byKey = new Map(entries.map((e) => [e.key, e.value]));
    if (byKey.size === 0) return;
    await this.db
      .insert(t.settings)
      .values([...byKey].map(([key, value]) => ({ workspaceId, userId, key, value })))
      .onConflictDoUpdate({
        target: [t.settings.workspaceId, t.settings.userId, t.settings.key],
        set: { value: sql`excluded.value` },
      });
  }
}
