import { and, eq } from 'drizzle-orm';
import { Octokit, RequestError } from 'octokit';
import * as t from '../../db/schema.js';
import type { Container } from '../../platform/container.js';
import { PrMeta } from '@devdigest/shared';
import { PullRepository } from '../reviews/repository/pull.repo.js';
import { NotFoundError } from '../../platform/errors.js';

/**
 * Re-sync every open PR of a repo from GitHub and mark PRs that were closed upstream.
 */
export class RepoSyncService {
  constructor(private container: Container) {}

  async syncOpenPulls(workspaceId: string, repoId: string): Promise<PrMeta[]> {
    const [repo] = await this.container.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    if (!repo) throw new NotFoundError('Repo not found');

    const token = await this.container.secrets.get('GITHUB_TOKEN');
    const octokit = new Octokit({ auth: token });

    let remote;
    try {
      remote = await octokit.rest.pulls.list({ owner: repo.owner, repo: repo.name, state: 'open' });
    } catch (err) {
      if (err instanceof RequestError && err.status === 404) return [];
      throw err;
    }

    const pulls = new PullRepository(this.container.db);
    const local = await pulls.listByRepo(repo.id);
    const openNumbers = new Set(remote.data.map((p) => p.number));
    for (const pr of local) {
      if (pr.status === 'open' && !openNumbers.has(pr.number)) {
        await this.container.db
          .update(t.pullRequests)
          .set({ status: 'closed' })
          .where(eq(t.pullRequests.id, pr.id));
      }
    }

    const rows = await pulls.listByRepo(repo.id);
    return rows.map((r) => PrMeta.parse(r));
  }
}
