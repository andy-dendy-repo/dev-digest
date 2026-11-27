/**
 * repo-intel pipeline — one file's parse into index rows (shared by the full
 * and incremental pipelines).
 *
 * No per-file timeout: `CodeParser` methods are synchronous and run on the
 * event loop, so a timer racing them can never fire before they return (the
 * old `withTimeout(…, MAX_PARSE_MS_PER_FILE)` wrapper was a no-op). Capping a
 * pathological file would need a worker thread; the soft budget in `full.ts`
 * still bounds the whole run between files.
 */
import { createHash } from 'node:crypto';
import { extractCrons, extractEndpoints } from '../facts.js';
import type {
  CodeParser,
  IndexerFileFactsRow,
  IndexerReferenceRow,
  IndexerSymbolRow,
} from '../ports.js';

export interface ParsedFileRows {
  symbols: IndexerSymbolRow[];
  references: IndexerReferenceRow[];
  /** Only set when the file has at least one endpoint or cron. */
  facts: IndexerFileFactsRow | null;
}

/**
 * Parse `source` into symbol / reference / fact rows keyed by the content hash.
 * Throws when the parser throws; the caller counts the file as skipped.
 */
export function parseFileForIndex(
  parser: CodeParser,
  repoId: string,
  relPath: string,
  source: string,
): ParsedFileRows {
  const contentHash = sha1(source);
  const parsedSymbols = parser.parseSymbols(relPath, source);
  const parsedReferences = parser.parseReferences(relPath, source);

  const symbols: IndexerSymbolRow[] = parsedSymbols.map((s) => ({
    repoId,
    path: relPath,
    name: s.name,
    kind: s.kind,
    line: s.line,
    endLine: s.endLine,
    exported: s.exported,
    signature: s.signature,
    contentHash,
  }));
  const references: IndexerReferenceRow[] = parsedReferences.map((r) => ({
    repoId,
    fromPath: relPath,
    toSymbol: r.toSymbol,
    line: r.line,
    contentHash,
  }));

  // Per-file facts (endpoints/crons) so blast reads from file_facts instead of
  // re-parsing the clone.
  const endpoints = extractEndpoints(source);
  const crons = extractCrons(source);
  const facts = endpoints.length > 0 || crons.length > 0 ? { filePath: relPath, endpoints, crons } : null;

  return { symbols, references, facts };
}

export function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}
