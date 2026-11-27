import type { Finding, FindingRecord, ReviewRecord } from '@devdigest/shared';
import type { FindingRow, PullRow } from '../../../db/rows.js';
import type * as t from '../../../db/schema.js';
import type { PrFilePatch, ReviewPull, ReviewRepoRef } from '../domain.js';

/** Row → domain mapping for the reviews module (the core never sees a row). */

export type ReviewRow = typeof t.reviews.$inferSelect;

export function toFindingRecord(row: FindingRow): FindingRecord {
  return {
    id: row.id,
    severity: row.severity as Finding['severity'],
    category: row.category as Finding['category'],
    title: row.title,
    file: row.file,
    start_line: row.startLine,
    end_line: row.endLine,
    rationale: row.rationale,
    suggestion: row.suggestion ?? null,
    confidence: row.confidence,
    kind: (row.kind as Finding['kind']) ?? 'finding',
    trifecta_components: (row.trifectaComponents as Finding['trifecta_components']) ?? null,
    evidence: null,
    review_id: row.reviewId,
    accepted_at: row.acceptedAt?.toISOString() ?? null,
    dismissed_at: row.dismissedAt?.toISOString() ?? null,
  };
}

/** `agent_name` is resolved by the service (agents live in another module). */
export function toReviewRecord(review: ReviewRow, findings: FindingRow[]): ReviewRecord {
  return {
    id: review.id,
    pr_id: review.prId,
    agent_id: review.agentId,
    run_id: review.runId,
    agent_name: null,
    kind: review.kind as ReviewRecord['kind'],
    verdict: review.verdict as ReviewRecord['verdict'],
    summary: review.summary,
    score: review.score,
    model: review.model,
    created_at: review.createdAt.toISOString(),
    findings: findings.map(toFindingRecord),
  };
}

export function toReviewPull(row: PullRow): ReviewPull {
  return {
    id: row.id,
    repoId: row.repoId,
    number: row.number,
    title: row.title,
    author: row.author,
    base: row.base,
    headSha: row.headSha,
    body: row.body,
  };
}

export function toReviewRepoRef(row: typeof t.repos.$inferSelect): ReviewRepoRef {
  return { id: row.id, owner: row.owner, name: row.name };
}

export function toPrFilePatch(row: typeof t.prFiles.$inferSelect): PrFilePatch {
  return { path: row.path, patch: row.patch };
}
