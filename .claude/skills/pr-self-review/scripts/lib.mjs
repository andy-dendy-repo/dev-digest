// Shared helpers for the pr-self-review scripts. Plain Node >= 22, no dependencies.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SEVERITIES = ["critical", "major", "minor", "nit"];
export const rank = (s) => {
  const i = SEVERITIES.indexOf(String(s).toLowerCase());
  return i === -1 ? SEVERITIES.length : i; // unknown sorts last
};

export function git(args, { cwd, input, allowFail = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd,
      input,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

export function repoRoot(cwd = process.cwd()) {
  return git(["rev-parse", "--show-toplevel"], { cwd }).trim();
}

// Per-worktree state dir inside .git, so nothing here is ever committed.
export function stateDir(root) {
  const p = git(["rev-parse", "--git-path", "pr-self-review"], { cwd: root }).trim();
  return resolve(root, p);
}
export const runDir = (root) => join(stateDir(root), "run");
export const verdictPath = (root) => join(stateDir(root), "verdict.json");

export function readJson(path, fallback) {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing file: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

export const loadMap = () => readJson(join(SKILL_DIR, "skill-map.json"));

// ---- glob ------------------------------------------------------------------
// Supports **, *, ?, {a,b}. Paths are repo-relative with forward slashes.
const globCache = new Map();
export function globToRegExp(glob) {
  if (globCache.has(glob)) return globCache.get(glob);
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?"; // **/ = zero or more directories
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      const alts = glob.slice(i + 1, end).split(",");
      re += "(?:" + alts.map((a) => a.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")).join("|") + ")";
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  const rx = new RegExp("^" + re + "$");
  globCache.set(glob, rx);
  return rx;
}
export const matchesAny = (path, globs = []) => globs.some((g) => globToRegExp(g).test(path));

// ---- diff collection -------------------------------------------------------
function resolveBase(root, baseRef, fetch) {
  if (fetch) git(["fetch", "origin", "main", "--quiet"], { cwd: root, allowFail: true });
  const candidates = baseRef ? [baseRef] : ["origin/main", "main"];
  for (const ref of candidates) {
    const base = git(["merge-base", ref, "HEAD"], { cwd: root, allowFail: true });
    if (base) return { baseRef: ref, base: base.trim() };
  }
  throw new Error(`cannot find a merge-base with ${candidates.join(" or ")}`);
}

// Everything that differs from the merge-base: commits on the branch, staged,
// unstaged and untracked files. The fingerprint hashes the *content* of the
// reviewable files, so it is independent of commit SHAs: committing or a clean
// rebase keeps it, any edit to a reviewed file changes it.
export function collectDiff({ cwd = process.cwd(), fetch = true, baseRef = process.env.PR_SELF_REVIEW_BASE } = {}) {
  const root = repoRoot(cwd);
  const map = loadMap();
  const { baseRef: ref, base } = resolveBase(root, baseRef, fetch);
  const head = git(["rev-parse", "HEAD"], { cwd: root }).trim();

  const files = new Map();
  const tracked = git(["diff", "--name-status", "--no-renames", "-z", base], { cwd: root }).split("\0");
  for (let i = 0; i + 1 < tracked.length; i += 2) {
    if (tracked[i]) files.set(tracked[i + 1], tracked[i][0]);
  }
  for (const p of git(["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root }).split("\0")) {
    if (p) files.set(p, "A");
  }

  const reviewable = [];
  const ignored = [];
  for (const [path, status] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    (matchesAny(path, map.ignore) ? ignored : reviewable).push({ path, status });
  }

  // fingerprint = sha256 over "path status baseBlob worktreeBlob" per reviewable file
  const paths = reviewable.map((f) => f.path);
  const baseBlobs = new Map();
  if (paths.length) {
    const out = git(["ls-tree", "-z", base, "--", ...paths], { cwd: root });
    for (const entry of out.split("\0")) {
      const m = entry.match(/^\d+ \w+ ([0-9a-f]+)\t(.*)$/s);
      if (m) baseBlobs.set(m[2], m[1]);
    }
  }
  const present = reviewable.filter((f) => f.status !== "D").map((f) => f.path);
  const workBlobs = new Map();
  if (present.length) {
    const out = git(["hash-object", "--stdin-paths"], { cwd: root, input: present.join("\n") + "\n" });
    out.trim().split("\n").forEach((h, i) => workBlobs.set(present[i], h));
  }
  const hash = createHash("sha256");
  for (const f of reviewable) {
    hash.update(`${f.path}\0${f.status}\0${baseBlobs.get(f.path) ?? "-"}\0${workBlobs.get(f.path) ?? "-"}\n`);
  }

  const clean = git(["status", "--porcelain"], { cwd: root }).trim() === "";
  return {
    root,
    baseRef: ref,
    base,
    head,
    fingerprint: reviewable.length ? hash.digest("hex") : "empty",
    clean,
    files: reviewable,
    ignored,
  };
}
