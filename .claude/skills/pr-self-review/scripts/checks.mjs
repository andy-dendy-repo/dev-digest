#!/usr/bin/env node
// Step 2: run the deterministic checks the plan selected (layer check, typecheck,
// vendor/shared mirror) and turn their output into findings.
// Writes <git-dir>/pr-self-review/run/checks.json.
//
//   node checks.mjs
//
// A check whose dependencies are not installed is recorded as `skipped`; the
// verdict is then `incomplete` (blocks) until it is installed and re-run.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { git, loadMap, readJson, repoRoot, runDir, writeJson } from "./lib.mjs";

const root = repoRoot();
const dir = runDir(root);
const plan = readJson(join(dir, "plan.json"));
const map = loadMap();
const selected = map.checks.filter((c) => plan.checks.includes(c.id));

const results = [];
const findings = [];
const rel = (cwd, p) => posix.normalize(posix.join(cwd, p.trim()));
const tail = (s, n = 40) => s.split("\n").slice(-n).join("\n").trim();

function parseTsc(check, out) {
  const found = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/);
    if (!m) continue;
    found.push({
      file: rel(check.cwd, m[1]),
      line: Number(m[2]),
      rule: m[3],
      summary: `Type error ${m[3]}: ${m[4]}`,
      evidence: line.trim(),
      fix: "Fix the type error; the module must type-check before the PR opens.",
    });
  }
  return found;
}

function parseDepcruise(check, out) {
  const found = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(error|warn)\s+([\w-]+):\s+(\S+)\s+→\s*(\S*)/);
    if (!m) continue;
    found.push({
      file: rel(check.cwd, m[3]),
      line: 0,
      rule: m[2],
      severity: m[1] === "warn" ? "minor" : undefined,
      summary: `Layer rule ${m[2]}: ${m[3]} imports ${m[4] || "(cycle)"}`,
      evidence: line.trim(),
      fix: "Point the import inward: depend on a port and wire the adapter in the composition root (see onion-architecture SKILL.md).",
    });
  }
  return found;
}

function runCommand(check) {
  const missing = (check.requires ?? []).filter((p) => !existsSync(join(root, p)));
  if (missing.length) {
    results.push({ id: check.id, status: "skipped", reason: `missing ${missing.join(", ")}; install with: ${check.install}` });
    return;
  }
  const t0 = Date.now();
  const r = spawnSync(check.command, { cwd: join(root, check.cwd), shell: true, encoding: "utf8", timeout: 600_000, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const ms = Date.now() - t0;
  if (r.error || r.status === null) {
    results.push({ id: check.id, status: "error", ms, reason: String(r.error ?? `killed by ${r.signal}`), output: tail(out) });
    return;
  }
  if (r.status === 0) {
    results.push({ id: check.id, status: "passed", ms });
    return;
  }
  let parsed = check.type === "tsc" ? parseTsc(check, out) : check.type === "depcruise" ? parseDepcruise(check, out) : [];
  if (!parsed.length) {
    parsed = [{ file: check.cwd, line: 0, rule: check.id, summary: `${check.id} failed (exit ${r.status})`, evidence: tail(out, 20), fix: `Run \`${check.command}\` in ${check.cwd}/ and fix what it reports.` }];
  }
  for (const f of parsed) {
    findings.push({ source: "check", check: check.id, skill: check.skill ?? check.id, introduced: true, ...f, severity: f.severity ?? check.severity });
  }
  results.push({ id: check.id, status: "failed", ms, exit: r.status, findings: parsed.length, output: tail(out) });
}

// Contract copies must change together. Drift that already existed at the base is
// reported as pre-existing; drift this diff creates is introduced.
function runMirror(check) {
  const [a, b] = check.roots;
  const show = (rev, p) => git(["show", `${rev}:${p}`], { cwd: root, allowFail: true });
  const now = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);
  const seen = new Set();
  for (const f of plan.files) {
    const from = f.path.startsWith(a + "/") ? a : f.path.startsWith(b + "/") ? b : null;
    if (!from) continue;
    const sub = f.path.slice(from.length + 1);
    if (seen.has(sub)) continue;
    seen.add(sub);
    const pa = `${a}/${sub}`;
    const pb = `${b}/${sub}`;
    if (now(pa) === now(pb)) continue;
    const wasSame = show(plan.base, pa) === show(plan.base, pb);
    findings.push({
      source: "check",
      check: check.id,
      skill: check.id,
      file: f.path,
      line: 0,
      rule: "vendor-shared-mirror",
      severity: check.severity,
      introduced: wasSame,
      summary: wasSame
        ? `${sub} now differs between ${a} and ${b}: the change was made in one copy only.`
        : `${sub} already differed between the two vendor/shared copies before this change.`,
      evidence: `diff ${pa} ${pb}`,
      fix: "Apply the same contract change to both copies (see AGENTS.md: the two vendor/shared copies).",
    });
  }
  results.push({ id: check.id, status: "passed", note: "mirror findings, if any, are listed as findings" });
}

for (const check of selected) {
  process.stdout.write(`▶ ${check.id} … `);
  if (check.type === "mirror") runMirror(check);
  else runCommand(check);
  const r = results.at(-1);
  console.log(r.status + (r.reason ? ` (${r.reason})` : "") + (r.findings ? `: ${r.findings} finding(s)` : ""));
}

writeJson(join(dir, "checks.json"), { results, findings });
console.log(`\n${findings.length} finding(s) from checks → ${join(dir, "checks.json")}`);
