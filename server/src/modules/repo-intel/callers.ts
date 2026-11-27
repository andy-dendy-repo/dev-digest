/**
 * repo-intel — callers of changed symbols (facade method `getCallerSignatures`,
 * fed into the review prompt as `## Callers of changed symbols`).
 *
 * Callers are found through `CodeIndex.references` (ripgrep + regex over the
 * live clone), NOT the persisted `references` table. The two are not
 * equivalent (different extractor, file scope, line attribution and order —
 * see repo-intel/README.md "Callers digest"), so switching would change the
 * prompt; it stays on this path until an equivalence check says otherwise.
 */
import type { CodeIndex, RepoRef } from '@devdigest/shared';
import { MAX_CALLERS_PER_SYMBOL } from './constants.js';
import type { CloneReader, CodeParser, ParsedSymbol, RepoIntelStore } from './ports.js';
import type { SignatureRow } from './types.js';

export interface CallerSignaturesDeps {
  store: Pick<RepoIntelStore, 'getRepoBasics' | 'getFileRankFor'>;
  codeIndex: Pick<CodeIndex, 'references'>;
  parser: CodeParser;
  clone: Pick<CloneReader, 'readFile'>;
  enabled: boolean;
}

export class CallerSignaturesQuery {
  constructor(private deps: CallerSignaturesDeps) {}

  /**
   * Diff-scoped, best-effort callers-in-prompt fuel.
   *
   * For each symbol declared in a changed file (`parser.parseSymbols`), find
   * cross-file callers via `codeIndex.references()` (the same path the blast
   * fallback trusts), then label each caller with its enclosing symbol +
   * signature (parse of the caller file). Ranked by the caller file's
   * `file_rank` percentile when an index exists.
   *
   * Skips type/interface symbols (no call sites). Returns at most `limit` rows,
   * deduped by (file, symbol, viaSymbol). Degraded gate: flag off, missing
   * clone, or empty input → `[]`.
   */
  async getCallerSignatures(
    repoId: string,
    changedFiles: string[],
    limit: number = MAX_CALLERS_PER_SYMBOL,
  ): Promise<SignatureRow[]> {
    const { store, codeIndex, parser, clone } = this.deps;
    if (!this.deps.enabled) return [];
    if (changedFiles.length === 0) return [];

    const repo = await store.getRepoBasics(repoId);
    if (!repo || !repo.clonePath) return [];
    const clonePath = repo.clonePath;

    // 1. Symbols declared in changed files. Filter to symbols that can BE
    //    called (function / method / class). Type/interface aliases have no
    //    call sites, so chasing references for them just wastes work.
    const declaredSymbols = new Map<string, { file: string; kind: string }>();
    for (const file of changedFiles) {
      if (!parser.supports(file)) continue;
      const source = await clone.readFile(clonePath, file);
      if (source == null) continue;
      try {
        for (const s of parser.parseSymbols(file, source)) {
          if (s.kind !== 'function' && s.kind !== 'method' && s.kind !== 'class') continue;
          // Dual-emit (Class.method + method): only store the bare name; the
          // qualified form would double-count callers.
          if (s.name.includes('.')) continue;
          if (!declaredSymbols.has(s.name)) {
            declaredSymbols.set(s.name, { file, kind: s.kind });
          }
        }
      } catch {
        // skip unparseable files — diff-scoped, never throw
      }
    }
    if (declaredSymbols.size === 0) return [];

    const ref: RepoRef = { owner: repo.owner, name: repo.name };
    const out: SignatureRow[] = [];
    const seen = new Set<string>();
    // Cache caller-file parses so we don't re-parse the same file per
    // referenced symbol.
    const callerSymbolsByFile = new Map<string, ParsedSymbol[]>();

    for (const [symbolName, decl] of declaredSymbols) {
      if (out.length >= limit) break;
      let refs;
      try {
        refs = await codeIndex.references(ref, symbolName);
      } catch {
        continue;
      }
      for (const r of refs) {
        if (out.length >= limit) break;
        if (r.fromPath === decl.file) continue; // skip self-references

        // Parse the caller file once; reuse for further symbols in this loop.
        let callerSyms = callerSymbolsByFile.get(r.fromPath);
        if (callerSyms === undefined) {
          if (!parser.supports(r.fromPath)) {
            callerSymbolsByFile.set(r.fromPath, []);
            callerSyms = [];
          } else {
            const callerSrc = await clone.readFile(clonePath, r.fromPath);
            if (callerSrc == null) {
              callerSymbolsByFile.set(r.fromPath, []);
              callerSyms = [];
            } else {
              try {
                callerSyms = parser.parseSymbols(r.fromPath, callerSrc);
              } catch {
                callerSyms = [];
              }
              callerSymbolsByFile.set(r.fromPath, callerSyms);
            }
          }
        }

        // Pick the enclosing top-level symbol (largest line ≤ ref.line, no
        // qualified names — match blast/helpers.ts callerName behavior).
        const enclosing = (callerSyms ?? [])
          .filter((s) => s.line <= r.line && !s.name.includes('.'))
          .sort((a, b) => b.line - a.line)[0];
        if (!enclosing) continue; // no enclosing symbol → no signature to emit
        const signature = enclosing.signature;
        if (!signature) continue;

        const dedupKey = `${r.fromPath}|${enclosing.name}|${symbolName}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        out.push({
          file: r.fromPath,
          symbol: enclosing.name,
          signature,
          rank: 0, // enriched from file_rank below
        });
      }
    }

    // Enrich each caller with its file's rank percentile so the prompt can
    // lead with the most important callers. No-op when no index exists yet.
    if (out.length > 0) {
      const files = [...new Set(out.map((o) => o.file))];
      const ranks = await store.getFileRankFor(repoId, files);
      if (ranks.length > 0) {
        const byFile = new Map(ranks.map((r) => [r.path, r.percentile]));
        for (const o of out) o.rank = byFile.get(o.file) ?? 0;
        out.sort((a, b) => b.rank - a.rank);
      }
    }

    return out;
  }
}
