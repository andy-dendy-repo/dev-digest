#!/usr/bin/env node
// Steps 4 and 6: aggregate findings into a verdict.
//
//   node verdict.mjs merge      reads run/checks.json + run/findings/<batch-id>.json,
//                               normalises, caps, dedupes, assigns ids → run/merged.json,
//                               lists the skill criticals that need verification.
//   node verdict.mjs finalize   applies run/verifications.json, decides the status and
//                               writes <git-dir>/pr-self-review/verdict.json + report.md.
//
// finalize exits 0 = pass, 1 = fail (a blocking critical), 2 = incomplete.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectDiff, loadMap, rank, readJson, repoRoot, runDir, SEVERITIES, stateDir, verdictPath, writeJson } from "./lib.mjs";

const mode = process.argv[2];
const root = repoRoot();
const dir = runDir(root);

if (mode === "merge") merge();
else if (mode === "finalize") process.exit(finalize());
else {
  console.error("usage: node verdict.mjs merge|finalize");
  process.exit(64);
}

function merge() {
  const plan = readJson(join(dir, "plan.json"));
  const map = loadMap();
  const incomplete = [];
  const raw = [];

  if (plan.checks.length) {
    if (!existsSync(join(dir, "checks.json"))) incomplete.push("checks.json missing: run scripts/checks.mjs");
    else {
      const c = readJson(join(dir, "checks.json"));
      raw.push(...c.findings);
      for (const r of c.results) if (r.status === "skipped" || r.status === "error") incomplete.push(`check ${r.id} ${r.status}: ${r.reason}`);
    }
  }

  for (const route of plan.routes) {
    const cap = map.skills[route.skill].maxSeverity;
    for (const batch of route.batches) {
      const path = join(dir, "findings", `${batch.id}.json`);
      if (!existsSync(path)) {
        incomplete.push(`no result for batch ${batch.id}`);
        continue;
      }
      let data;
      try {
        data = readJson(path);
      } catch (e) {
        incomplete.push(`batch ${batch.id}: unreadable JSON (${e.message})`);
        continue;
      }
      const reviewed = new Set(data.filesReviewed ?? []);
      const skipped = batch.files.filter((f) => !reviewed.has(f));
      if (skipped.length) incomplete.push(`batch ${batch.id}: files not reviewed: ${skipped.join(", ")}`);
      for (const f of data.findings ?? []) {
        let severity = SEVERITIES.includes(String(f.severity).toLowerCase()) ? String(f.severity).toLowerCase() : "minor";
        const finding = { source: "skill", skill: route.skill, batch: batch.id, ...f, line: Number(f.line) || 0, introduced: f.introduced !== false };
        if (rank(severity) < rank(cap)) {
          finding.cappedFrom = severity;
          severity = cap;
        }
        finding.severity = severity;
        raw.push(finding);
      }
    }
  }

  // Dedupe the same problem reported by several skills: keep the most severe.
  const byKey = new Map();
  for (const f of raw) {
    const key = `${f.file}:${f.line}:${String(f.rule ?? "").toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, { ...f, skills: [f.skill] });
    else {
      prev.skills = [...new Set([...prev.skills, f.skill])];
      if (rank(f.severity) < rank(prev.severity)) Object.assign(prev, { ...f, skills: prev.skills });
      if (f.source === "check") prev.source = "check";
    }
  }
  // A file-level check finding (line 0, e.g. the layer check) absorbs a skill finding for
  // the same file and rule, taking the skill's precise line.
  for (const [key, f] of byKey) {
    if (f.source === "check") continue;
    const ruleKey = String(f.rule ?? "").toLowerCase();
    const check = [...byKey.values()].find(
      (c) => c.source === "check" && c.line === 0 && c.file === f.file && String(c.rule).toLowerCase() === ruleKey,
    );
    if (!check) continue;
    check.line = f.line;
    check.skills = [...new Set([...check.skills, ...f.skills])];
    check.fix = f.fix ?? check.fix;
    byKey.delete(key);
  }

  const findings = [...byKey.values()]
    .sort((x, y) => rank(x.severity) - rank(y.severity) || String(x.file).localeCompare(String(y.file)) || x.line - y.line)
    .map((f, i) => ({ id: `F${i + 1}`, ...f, needsVerification: f.source === "skill" && f.severity === "critical" && f.introduced }));

  writeJson(join(dir, "merged.json"), { incomplete, findings });
  const toVerify = findings.filter((f) => f.needsVerification);
  console.log(`${findings.length} finding(s) after dedupe; ${toVerify.length} skill critical(s) need verification.`);
  for (const f of toVerify) console.log(`  ${f.id}  [${f.skill}] ${f.file}:${f.line}  ${f.rule}: ${f.summary}`);
  if (incomplete.length) console.log(`Incomplete:\n  - ${incomplete.join("\n  - ")}`);
  console.log(`→ ${join(dir, "merged.json")}`);
}

function finalize() {
  const plan = readJson(join(dir, "plan.json"));
  const merged = readJson(join(dir, "merged.json"));
  const verifications = readJson(join(dir, "verifications.json"), []);
  const byId = new Map(verifications.map((v) => [v.id, v]));
  const incomplete = [...merged.incomplete];

  const findings = merged.findings.map((f) => {
    if (!f.needsVerification) return f;
    const v = byId.get(f.id);
    if (!v) return { ...f, verification: "missing" }; // stays critical: fail closed
    if (String(v.verdict).toUpperCase() === "REJECTED") return { ...f, severity: "major", verification: "rejected", verificationNote: v.reason };
    return { ...f, verification: "confirmed", verificationNote: v.reason };
  });

  const now = collectDiff({ fetch: false, baseRef: plan.baseRef });
  if (now.fingerprint !== plan.fingerprint) incomplete.push("files changed during the review: re-run /pr-self-review");

  const blocking = findings.filter((f) => f.severity === "critical" && f.introduced);
  const status = blocking.length ? "fail" : incomplete.length ? "incomplete" : "pass";
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s && f.introduced).length]));
  counts.preExisting = findings.filter((f) => !f.introduced).length;

  const verdict = {
    status,
    fingerprint: plan.fingerprint,
    baseRef: plan.baseRef,
    base: plan.base,
    head: plan.head,
    createdAt: new Date().toISOString(),
    counts,
    blocking: blocking.map((f) => f.id),
    incomplete,
    skills: plan.routes.map((r) => ({ skill: r.skill, files: r.files.length })),
    findings,
  };
  writeJson(verdictPath(root), verdict);
  const report = renderReport(verdict, plan);
  writeFileSync(join(stateDir(root), "report.md"), report);
  console.log(report);
  return { pass: 0, fail: 1, incomplete: 2 }[status];
}

function renderReport(v, plan) {
  const loc = (f) => `${f.file}${f.line ? `:${f.line}` : ""}`;
  const item = (f) =>
    `- **${f.id}** \`${loc(f)}\` [${(f.skills ?? [f.skill]).join(", ")}] **${f.rule}**: ${f.summary}` +
    (f.fix ? `\n  - Fix: ${f.fix}` : "") +
    (f.verification ? `\n  - Verification: ${f.verification}${f.verificationNote ? `: ${f.verificationNote}` : ""}` : "");
  const title = { pass: "PASS: no blocking findings", fail: "FAIL: merge blocked", incomplete: "INCOMPLETE: merge blocked until the review finishes" }[v.status];
  const out = [`# PR self-review: ${title}`, ""];
  out.push(`Base \`${v.baseRef}\` @ \`${v.base.slice(0, 10)}\` · HEAD \`${v.head.slice(0, 10)}\` · fingerprint \`${v.fingerprint.slice(0, 12)}\``, "");
  out.push("| Critical | Major | Minor | Nit | Pre-existing |", "|---|---|---|---|---|");
  out.push(`| ${v.counts.critical} | ${v.counts.major} | ${v.counts.minor} | ${v.counts.nit} | ${v.counts.preExisting} |`, "");
  out.push(`Skills run: ${v.skills.map((s) => `${s.skill} (${s.files})`).join(", ") || "none"}. Checks: ${plan.checks.join(", ") || "none"}.`, "");
  if (v.incomplete.length) out.push("## Incomplete", ...v.incomplete.map((r) => `- ${r}`), "");
  for (const sev of SEVERITIES) {
    const list = v.findings.filter((f) => f.severity === sev && f.introduced);
    if (list.length) out.push(`## ${sev[0].toUpperCase() + sev.slice(1)}${sev === "critical" ? " (blocking)" : ""}`, ...list.map(item), "");
  }
  const pre = v.findings.filter((f) => !f.introduced);
  if (pre.length) out.push("## Pre-existing (not blocking)", ...pre.map(item), "");
  return out.join("\n");
}
