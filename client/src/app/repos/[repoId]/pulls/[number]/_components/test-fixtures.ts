/* Test fixtures shared by the PR-detail component tests. */
import type { FindingRecord, ReviewRecord, RunSummary, Severity } from "@devdigest/shared";

export function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "WARNING" as Severity,
    category: "security",
    title: `Finding ${o.id}`,
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "Because.",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

export function review(o: Partial<ReviewRecord> & { id: string }): ReviewRecord {
  return {
    pr_id: "pr-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    run_id: `run-${o.id}`,
    kind: "review",
    verdict: "comment",
    summary: "Looks mostly fine.",
    score: 80,
    model: "deepseek/deepseek-v4-flash",
    created_at: "2026-06-11T18:44:34.000Z",
    findings: [],
    ...o,
  };
}

export function runSummary(o: Partial<RunSummary> & { run_id: string }): RunSummary {
  return {
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}
