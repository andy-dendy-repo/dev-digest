#!/usr/bin/env node
// Claude Code PreToolUse hook (matcher: Bash). Blocks `gh pr create` and
// `gh pr merge` unless the last /pr-self-review verdict passed for exactly the
// current set of changes. Every other command passes straight through.
//
// Exit 0 = allow. Exit 2 = block; stderr is shown to Claude.
import { readFileSync } from "node:fs";

const GATED = /(^|[;&|(\s])gh\s+pr\s+(create|merge)\b/;

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0); // not a hook payload we understand
}
const command = input?.tool_input?.command ?? "";
if (!GATED.test(command)) process.exit(0);

const block = (msg) => {
  process.stderr.write(`pr-self-review gate: ${msg}\n`);
  process.exit(2);
};

try {
  const { collectDiff, readJson, repoRoot, verdictPath } = await import("./lib.mjs");
  const cwd = input.cwd || process.cwd();
  const root = repoRoot(cwd);
  const verdict = readJson(verdictPath(root), null);
  const now = collectDiff({ cwd: root, fetch: false, baseRef: verdict?.baseRef });

  if (now.fingerprint === "empty") process.exit(0); // only docs/.claude/lockfiles changed

  const rerun = "Run the pr-self-review skill (/pr-self-review), fix any critical findings, then retry.";
  if (!verdict) block(`no self-review verdict for this branch. ${rerun}`);
  if (verdict.fingerprint !== now.fingerprint)
    block(`the changes differ from the ones last reviewed (${now.files.length} reviewable file(s)). ${rerun}`);
  if (verdict.status === "fail") {
    const crit = verdict.findings
      .filter((f) => verdict.blocking.includes(f.id))
      .map((f) => `  - ${f.id} ${f.file}${f.line ? `:${f.line}` : ""} [${f.skill}] ${f.rule}: ${f.summary}`)
      .join("\n");
    block(`${verdict.blocking.length} critical finding(s) block this PR:\n${crit}\nFix them, then re-run /pr-self-review.`);
  }
  if (verdict.status !== "pass") block(`the last review is ${verdict.status}: ${verdict.incomplete.join("; ")}. ${rerun}`);
  process.exit(0);
} catch (err) {
  block(`could not verify the self-review verdict (${err.message}). ${"Run /pr-self-review and retry."}`);
}
