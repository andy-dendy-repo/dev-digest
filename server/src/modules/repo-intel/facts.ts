/**
 * repo-intel — per-file facts (HTTP endpoints, crons / background jobs).
 *
 * Pure, line-based heuristics over a file's source (no I/O). The full and
 * incremental pipelines store them in `file_facts`; the blast fallback runs
 * them over caller files read from the clone. Moved here from
 * `adapters/codeindex/extract.ts` (B5): the core owns pure helpers.
 */

/**
 * Heuristic endpoint detector: HTTP route registrations in a file.
 * Catches Fastify/Express style `app.get('/path', ...)`, `router.post(...)`,
 * `app.get<...>('/path')`, and `route({ method, url })`. Returns "METHOD /path".
 */
export function extractEndpoints(content: string): string[] {
  const out = new Set<string>();
  const lines = content.split('\n');
  const verbRe =
    /\b(?:app|router|fastify|server|api)\.(get|post|put|patch|delete|options|head)\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`]+)\2/i;
  const routeObjRe = /method\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`][\s\S]*?url\s*:\s*['"`]([^'"`]+)['"`]/i;
  for (const raw of lines) {
    const m = raw.match(verbRe);
    if (m) out.add(`${m[1]!.toUpperCase()} ${m[3]}`);
    const r = raw.match(routeObjRe);
    if (r) out.add(`${r[1]!.toUpperCase()} ${r[2]}`);
  }
  return [...out];
}

/**
 * Heuristic cron/scheduled-job detector. Catches cron expressions in
 * `schedule('* * * * *')`, `cron.schedule(...)`, `CronJob(...)`, and
 * `jobs.register('kind')` / `enqueue(ws, 'kind')` style background work.
 */
export function extractCrons(content: string): string[] {
  const out = new Set<string>();
  const lines = content.split('\n');
  const cronExprRe = /\b(?:cron|schedule|CronJob)\s*[.(]?\s*\(?\s*['"`]([^'"`]*(?:\*|\d+\s+\d+)[^'"`]*)['"`]/i;
  const jobKindRe = /\b(?:register|enqueue)\s*\(\s*(?:[A-Za-z0-9_$.]+\s*,\s*)?['"`]([a-z][a-z0-9_]*)['"`]/i;
  for (const raw of lines) {
    const m = raw.match(cronExprRe);
    if (m) out.add(m[1]!.trim());
    const j = raw.match(jobKindRe);
    if (j && /poll|index|clone|digest|cron|sync|schedule|job/i.test(raw)) out.add(`job:${j[1]}`);
  }
  return [...out];
}
