/**
 * PR-list rollup helpers (`modules/pulls/status.ts`) — the pure derivation that
 * decides each PR's review STATUS and tallies its FINDINGS for the list. The DB
 * `status` column holds GitHub's merge state; the review status
 * (needs_review / reviewed / stale) is derived here from head vs lastReviewedSha
 * + age, so it gets unit coverage independent of the route's queries.
 */
import { describe, it, expect } from 'vitest';
import {
  BRIEF_RATIONALE_MAX,
  deriveReviewStatus,
  rollupSeverities,
  sortBriefs,
  STALE_DAYS,
  toFindingBrief,
  type FindingBriefRow,
} from '../src/modules/pulls/status.js';

const DAY = 86_400_000;
const now = Date.UTC(2026, 5, 11);

describe('deriveReviewStatus', () => {
  it('needs_review when never reviewed, or when head moved since the last review', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: null, headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'old', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
  });

  it('reviewed when the current head was reviewed and the PR is recent', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now - DAY), now }),
    ).toBe('reviewed');
  });

  it('stale when the current head was reviewed but the PR is older than STALE_DAYS', () => {
    expect(
      deriveReviewStatus({
        ghStatus: 'open',
        lastReviewedSha: 'abc',
        headSha: 'abc',
        updatedAt: new Date(now - (STALE_DAYS + 1) * DAY),
        now,
      }),
    ).toBe('stale');
  });

  it('keeps merged/closed regardless of review state', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'merged', lastReviewedSha: null, headSha: 'abc', updatedAt: null, now }),
    ).toBe('merged');
    expect(
      deriveReviewStatus({ ghStatus: 'closed', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('closed');
  });
});

describe('rollupSeverities', () => {
  it('tallies findings into critical / warning / suggestion buckets (ignores unknown)', () => {
    expect(
      rollupSeverities([
        { severity: 'CRITICAL' },
        { severity: 'CRITICAL' },
        { severity: 'WARNING' },
        { severity: 'SUGGESTION' },
        { severity: 'WEIRD' },
      ]),
    ).toEqual({ critical: 2, warning: 1, suggestion: 1 });
  });

  it('is all-zero for no findings', () => {
    expect(rollupSeverities([])).toEqual({ critical: 0, warning: 0, suggestion: 0 });
  });
});

describe('finding briefs (PR list Findings column)', () => {
  const row = (o: Partial<FindingBriefRow>): FindingBriefRow => ({
    id: 'f',
    severity: 'WARNING',
    category: 'bug',
    title: 't',
    file: 'src/a.ts',
    startLine: 1,
    endLine: 2,
    confidence: 0.8,
    rationale: 'short',
    ...o,
  });

  it('maps a DB row to snake_case and shortens long rationale only', () => {
    expect(toFindingBrief(row({ id: 'f1' }))).toEqual({
      id: 'f1',
      severity: 'WARNING',
      category: 'bug',
      title: 't',
      file: 'src/a.ts',
      start_line: 1,
      end_line: 2,
      confidence: 0.8,
      rationale: 'short',
    });
    const long = toFindingBrief(row({ rationale: 'x'.repeat(1000) })).rationale;
    expect(long).toHaveLength(BRIEF_RATIONALE_MAX);
    expect(long.endsWith('…')).toBe(true);
  });

  it('sorts most severe first, then by confidence', () => {
    const briefs = [
      row({ id: 's', severity: 'SUGGESTION', confidence: 0.99 }),
      row({ id: 'w-low', severity: 'WARNING', confidence: 0.6 }),
      row({ id: 'c', severity: 'CRITICAL', confidence: 0.7 }),
      row({ id: 'w-high', severity: 'WARNING', confidence: 0.9 }),
    ].map(toFindingBrief);
    expect(sortBriefs(briefs).map((b) => b.id)).toEqual(['c', 'w-high', 'w-low', 's']);
  });
});
