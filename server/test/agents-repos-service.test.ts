import { describe, it, expect } from 'vitest';
import type { Agent, AgentSkillLink, AgentVersion, LLMProvider } from '@devdigest/shared';
import { MockGitClient, MockJobQueue, MockLLMProvider } from '../src/adapters/mocks.js';
import { AgentsService } from '../src/modules/agents/service.js';
import type { AgentPatch, AgentsPort, NewAgent } from '../src/modules/agents/ports.js';
import { RepoService } from '../src/modules/repos/service.js';
import type { NewRepo, RepoRecord, ReposPort } from '../src/modules/repos/ports.js';
import { CLONE_JOB_KIND } from '../src/modules/repos/constants.js';
import { INDEX_JOB_KIND, REFRESH_JOB_KIND } from '../src/modules/repo-intel/constants.js';

/** Hermetic use-case tests: AgentsService / RepoService over in-memory port fakes. */

// ---------------------------------------------------------------- agents

class FakeAgents implements AgentsPort {
  agents: (Agent & { workspaceId: string })[] = [];
  links: AgentSkillLink[] = [];
  lastInsert?: NewAgent;
  lastPatch?: AgentPatch;

  async list(ws: string) {
    return this.agents.filter((a) => a.workspaceId === ws);
  }
  async listEnabled(ws: string) {
    return (await this.list(ws)).filter((a) => a.enabled);
  }
  async getById(ws: string, id: string) {
    return this.agents.find((a) => a.workspaceId === ws && a.id === id);
  }
  async deleteById() {
    return false;
  }
  async insert(values: NewAgent) {
    this.lastInsert = values;
    const agent = {
      workspaceId: values.workspaceId,
      id: `a${this.agents.length + 1}`,
      name: values.name,
      description: values.description ?? '',
      provider: values.provider,
      model: values.model,
      system_prompt: values.systemPrompt,
      output_schema: values.outputSchema ?? null,
      enabled: values.enabled ?? true,
      version: 1,
      strategy: values.strategy ?? 'single-pass',
      ci_fail_on: values.ciFailOn ?? 'critical',
      repo_intel: values.repoIntel ?? true,
    } satisfies Agent & { workspaceId: string };
    this.agents.push(agent);
    return agent;
  }
  async update(ws: string, id: string, patch: AgentPatch) {
    this.lastPatch = patch;
    return this.getById(ws, id);
  }
  async listVersions(): Promise<AgentVersion[]> {
    return [];
  }
  async getVersion() {
    return undefined;
  }
  async skillLinks(agentId: string) {
    return this.links.filter((l) => l.agent_id === agentId);
  }
  async linkSkill(agentId: string, skillId: string, order: number) {
    this.links.push({ agent_id: agentId, skill_id: skillId, order });
  }
  async setSkills(agentId: string, skillIds: string[]) {
    this.links = this.links.filter((l) => l.agent_id !== agentId);
    skillIds.forEach((skill_id, order) => this.links.push({ agent_id: agentId, skill_id, order }));
  }
}

function agentsService(llm: () => Promise<LLMProvider> = async () => new MockLLMProvider('openai')) {
  const agents = new FakeAgents();
  return { agents, service: new AgentsService({ agents, llm }) };
}

describe('AgentsService', () => {
  it('create maps the API input onto the port (snake_case → camelCase) and records the author', async () => {
    const { agents, service } = agentsService();
    const agent = await service.create(
      'ws',
      { name: 'Sec', provider: 'openai', model: 'gpt-4.1', system_prompt: 'p', ci_fail_on: 'warning' },
      'user-1',
    );
    expect(agent.ci_fail_on).toBe('warning');
    expect(agents.lastInsert).toMatchObject({
      workspaceId: 'ws',
      systemPrompt: 'p',
      ciFailOn: 'warning',
      createdBy: 'user-1',
    });
    expect(agents.lastInsert).not.toHaveProperty('strategy');
  });

  it('update passes only the fields that were sent', async () => {
    const { agents, service } = agentsService();
    const created = await service.create('ws', { name: 'A', provider: 'openai', model: 'm', system_prompt: 'p' });
    await service.update('ws', created.id, { system_prompt: 'q', enabled: false });
    expect(agents.lastPatch).toEqual({ systemPrompt: 'q', enabled: false });
  });

  it('skills: foreign agent → undefined; linkSkill appends at the end by default', async () => {
    const { service } = agentsService();
    const created = await service.create('ws', { name: 'A', provider: 'openai', model: 'm', system_prompt: 'p' });
    expect(await service.setSkills('other-ws', created.id, ['s1'])).toBeUndefined();
    await service.setSkills('ws', created.id, ['s1', 's2']);
    const links = await service.linkSkill('ws', created.id, 's3');
    expect(links!.map((l) => [l.skill_id, l.order])).toEqual([
      ['s1', 0],
      ['s2', 1],
      ['s3', 2],
    ]);
  });

  it('listModels degrades to [] when the provider key is missing', async () => {
    const { service } = agentsService(async () => {
      throw new Error('OPENAI_API_KEY is not configured');
    });
    expect(await service.listModels('openai')).toEqual([]);
  });
});

// ---------------------------------------------------------------- repos

class FakeRepos implements ReposPort {
  rows: RepoRecord[] = [];
  clonePaths = new Map<string, string>();

  async list(ws: string) {
    return this.rows.filter((r) => r.workspaceId === ws);
  }
  async getById(ws: string, id: string) {
    return this.rows.find((r) => r.workspaceId === ws && r.id === id);
  }
  async findByFullName(ws: string, fullName: string) {
    return this.rows.find((r) => r.workspaceId === ws && r.fullName === fullName);
  }
  async insert(values: NewRepo) {
    const row: RepoRecord = {
      ...values,
      id: `r${this.rows.length + 1}`,
      defaultBranch: 'main',
      clonePath: null,
      lastPolledAt: null,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }
  async workspaceIdFor(repoId: string) {
    return this.rows.find((r) => r.id === repoId)?.workspaceId ?? null;
  }
  async updateClonePath(repoId: string, path: string) {
    this.clonePaths.set(repoId, path);
  }
  async remove(ws: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.workspaceId === ws && r.id === id));
    return this.rows.length < before;
  }
}

function repoService(jobs = new MockJobQueue({ strict: false })) {
  const repos = new FakeRepos();
  const git = new MockGitClient();
  return { repos, git, jobs, service: new RepoService({ repos, jobs, git: () => git }) };
}

describe('RepoService', () => {
  it('add persists once and enqueues a clone; a second add of the same repo is a no-op', async () => {
    const { service, jobs } = repoService();
    const first = await service.add('ws', 'u', 'https://github.com/acme/api');
    const again = await service.add('ws', 'u', 'https://github.com/acme/api.git');
    expect(first.created).toBe(true);
    expect(again).toMatchObject({ created: false, repo: { id: first.repo.id } });
    expect(jobs.enqueued.map((j) => j.kind)).toEqual([CLONE_JOB_KIND]);
  });

  it('refresh enqueues a clone and an incremental index refresh; unknown repo → 404', async () => {
    const { service, jobs } = repoService();
    const { repo } = await service.add('ws', 'u', 'https://github.com/acme/api');
    jobs.enqueued.length = 0;
    expect(await service.refresh('ws', repo.id)).toEqual({ status: 'refreshing' });
    expect(jobs.enqueued.map((j) => j.kind)).toEqual([CLONE_JOB_KIND, REFRESH_JOB_KIND]);
    await expect(service.refresh('ws', 'nope')).rejects.toThrow('Repo not found');
  });

  it('runCloneJob clones from the canonical URL, stores the path and enqueues indexing', async () => {
    const { service, repos, git, jobs } = repoService();
    const { repo } = await service.add('ws', 'u', 'https://github.com/acme/api');
    await service.runCloneJob({ repoId: repo.id, owner: 'acme', name: 'api', url: 'https://evil.example/x' });
    expect(git.cloned[0]!.url).toBe('https://github.com/acme/api.git');
    expect(repos.clonePaths.get(repo.id)).toBeTruthy();
    expect(jobs.enqueued.at(-1)).toMatchObject({ workspaceId: 'ws', kind: INDEX_JOB_KIND });
  });

  it('runCloneJob keeps the clone when no index handler is registered', async () => {
    const { service, repos } = repoService(new MockJobQueue({ strict: true }));
    const row = await repos.insert({ workspaceId: 'ws', owner: 'acme', name: 'api', fullName: 'acme/api', createdBy: 'u' });
    await expect(
      service.runCloneJob({ repoId: row.id, owner: 'acme', name: 'api', url: '' }),
    ).resolves.toBeUndefined();
    expect(repos.clonePaths.has(row.id)).toBe(true);
  });

  it('runCloneJob refuses an invalid owner/name', async () => {
    const { service } = repoService();
    await expect(
      service.runCloneJob({ repoId: 'r', owner: '../etc', name: 'x', url: '' }),
    ).rejects.toMatchObject({ code: 'invalid_repo_url' });
  });
});
