# Subagent briefs

Fill the `{placeholders}` from `plan.json` and the merged findings. Each brief is the subagent's
only context, so paste it whole.

## Reviewer brief (step 3: one per batch)

```
You are reviewing local changes in the DevDigest repo ({root}) against ONE project skill,
before a pull request is opened. Change no source file. The only file you write is the result file.

Skill: {skill}. Read {root}/{skillPath} first, then every reference file it points to that
bears on the files below. That skill's rules are the review standard.
Severity: read {root}/.claude/skills/pr-self-review/references/severity.md. Its scale and its
critical definitions for {skill} override the skill's own labels.

Files in your batch ({batchId}):
{files, one per line}

See what changed with: git -C {root} diff {base} -- <file>
(A file with no diff output is untracked and new: read it whole.)
Judge the changed hunks; read surrounding code and callers when you need context. Report a
problem in unchanged code only when it bears on the change, with "introduced": false.

Apply every rule of the skill that bears on these files. Every file in the batch must be
reviewed. Report each problem once with the exact line in the working-tree file and the
offending code quoted in "evidence".

Write your result as JSON to {run}/findings/{batchId}.json, matching
{root}/.claude/skills/pr-self-review/references/finding.schema.json:
{"skill": "{skill}", "batch": "{batchId}", "filesReviewed": [<every file above>],
 "findings": [{"file", "line", "severity", "rule", "summary", "evidence", "fix", "introduced"}]}
No problems → "findings": []. Reply with one line: the path you wrote and the count by severity.
```

## Verifier brief (step 5: one per critical)

Hand the verifier the claim and the code, not the reviewer's reasoning, so its judgement is
independent.

```
You are verifying ONE claimed critical problem in local changes to the DevDigest repo ({root}).
Change no file. Be adversarial: the claim may be wrong.

Claim: {file}:{line}: {summary}
Rule ({skill}, {rule}): read {root}/{skillPath} and find this rule.
Critical bar: read {root}/.claude/skills/pr-self-review/references/severity.md, section for {skill}.

Read the file at that location, its diff (git -C {root} diff {base} -- {file}), and whatever
callers or imports you need.

Answer CONFIRMED only if all three hold:
1. The problem really exists in the working-tree code at that location.
2. This diff introduces it (it is not already present at {base}).
3. It meets the critical bar for {skill}, not just a major or minor issue.
Otherwise answer REJECTED.

Reply with exactly one line of JSON:
{"id": "{id}", "verdict": "CONFIRMED" | "REJECTED", "reason": "<one sentence, with the evidence>"}
```
