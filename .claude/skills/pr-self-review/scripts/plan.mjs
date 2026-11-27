#!/usr/bin/env node
// Step 1: collect every local change vs the merge-base with origin/main, route each
// file to the skills that review it, pick the deterministic checks, and write
// <git-dir>/pr-self-review/run/plan.json. Starts a fresh run (clears run/).
//
//   node plan.mjs [--no-fetch] [--base <ref>]
//
// Exit 0: plan written (even when there is nothing to review: see `empty`).
// Exit 3: coverage guard: a skill in .claude/skills/ is neither mapped nor excluded.
import { readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { collectDiff, loadMap, matchesAny, runDir, writeJson, SKILL_DIR } from "./lib.mjs";

const args = process.argv.slice(2);
const fetch = !args.includes("--no-fetch");
const baseIdx = args.indexOf("--base");
const baseRef = baseIdx !== -1 ? args[baseIdx + 1] : process.env.PR_SELF_REVIEW_BASE;

const map = loadMap();

// Coverage guard: a new skill must be routed or explicitly excluded.
const skillsDir = join(SKILL_DIR, "..");
const present = readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(skillsDir, d.name, "SKILL.md")))
  .map((d) => d.name);
const known = new Set([...Object.keys(map.skills), ...map.excluded]);
const unmapped = present.filter((s) => !known.has(s));
const missing = Object.keys(map.skills).filter((s) => !present.includes(s));
if (unmapped.length || missing.length) {
  if (unmapped.length)
    console.error(`Coverage guard: skill(s) not in skill-map.json: ${unmapped.join(", ")}. Add each under "skills" (with globs) or "excluded".`);
  if (missing.length) console.error(`Coverage guard: skill-map.json names skill(s) with no SKILL.md: ${missing.join(", ")}.`);
  process.exit(3);
}

const diff = collectDiff({ fetch, baseRef });
const live = diff.files.filter((f) => f.status !== "D");

const routes = [];
for (const [skill, cfg] of Object.entries(map.skills)) {
  const files = live.map((f) => f.path).filter((p) => matchesAny(p, cfg.include) && !matchesAny(p, cfg.exclude));
  if (!files.length) continue;
  const batches = [];
  for (let i = 0; i < files.length; i += map.batchSize) {
    const n = batches.length + 1;
    batches.push({ id: `${skill}--${n}`, files: files.slice(i, i + map.batchSize) });
  }
  routes.push({ skill, area: cfg.area, maxSeverity: cfg.maxSeverity, skillPath: `.claude/skills/${skill}/SKILL.md`, files, batches });
}
const routed = new Set(routes.flatMap((r) => r.files));
const unrouted = live.map((f) => f.path).filter((p) => !routed.has(p));

const checks = map.checks
  .filter((c) => diff.files.some((f) => matchesAny(f.path, c.include)))
  .map((c) => c.id);

const dir = runDir(diff.root);
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, "findings"), { recursive: true });
const plan = { createdAt: new Date().toISOString(), ...diff, empty: diff.files.length === 0, routes, unrouted, checks };
writeJson(join(dir, "plan.json"), plan);

// Human summary
console.log(`Base: ${diff.baseRef} @ ${diff.base.slice(0, 10)}   HEAD: ${diff.head.slice(0, 10)}   working tree: ${diff.clean ? "clean" : "dirty"}`);
console.log(`Changed files: ${diff.files.length} reviewable, ${diff.ignored.length} ignored (docs, lockfiles, .claude/…)`);
if (plan.empty) {
  console.log("Nothing to review.");
} else {
  console.log("\n| Skill | Area | Files | Batches |\n|---|---|---|---|");
  for (const r of routes) console.log(`| ${r.skill} | ${r.area} | ${r.files.length} | ${r.batches.map((b) => b.id).join(", ")} |`);
  console.log(`\nChecks: ${checks.length ? checks.join(", ") : "none"}`);
  if (unrouted.length) console.log(`Not routed to any skill (checks only): ${unrouted.join(", ")}`);
}
console.log(`\nPlan: ${join(dir, "plan.json")}`);
