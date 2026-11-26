import { AppError, ExternalServiceError } from '../../platform/errors.js';
import { TimeoutError } from '../../platform/resilience.js';

/**
 * Translate an Octokit / network failure into the API's error taxonomy, so the
 * global error handler returns a stable `external_service_error` (502) instead
 * of falling through to its generic 500 branch.
 *
 * Call it AFTER `withRetry`: the retry policy reads the raw `status` (429/5xx)
 * that this translation replaces.
 */
export function translateGitHubError(err: unknown): never {
  if (err instanceof AppError) throw err;
  if (err instanceof TimeoutError) {
    throw new ExternalServiceError('GitHub did not respond in time', { provider: 'github' });
  }
  const status = (err as { status?: unknown })?.status;
  const raw = err instanceof Error ? err.message : String(err);
  // Octokit appends a docs link: "Not Found - https://docs.github.com/…".
  const reason = raw.split(' - https://')[0]!.trim() || 'request failed';
  if (typeof status === 'number') {
    throw new ExternalServiceError(`GitHub request failed (${status}): ${reason}`, {
      provider: 'github',
      status,
    });
  }
  throw new ExternalServiceError(`GitHub request failed: ${reason}`, { provider: 'github' });
}
