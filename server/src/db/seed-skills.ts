/**
 * Built-in skills used by the seed (M2), and which seeded agent links them.
 *
 * A skill is text only: the run executor renders it as
 * `### name\n> description\n\nbody` under `## Skills / rules` in the user
 * message (reviewer-core `formatSkillBlock`). The description is the skill's
 * interface — one directive sentence. Bodies use `####` headings so they nest
 * under the skill's own `###` heading. The DB row is the source of truth at run
 * time; editing a body here only affects freshly seeded workspaces.
 */

type SkillType = 'rubric' | 'convention' | 'security' | 'custom';
type SkillSource = 'manual' | 'imported_url' | 'imported_file' | 'extracted' | 'community';

export interface SeedSkill {
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  /** Global on/off (`skills.enabled`). */
  enabled: boolean;
  body: string;
}

export interface SeedSkillLink {
  skill: string;
  /** Per-agent on/off (`agent_skills.enabled`). */
  enabled: boolean;
}

const PR_QUALITY_RUBRIC = `Grade the PR by the risk it adds at merge, not by how much you can say about it.

#### Order of attention
1. **Correctness** — does the change do what it claims on every input it can get,
   including the empty, missing and failing ones?
2. **Safety** — can it leak data, corrupt state, or fail open? Is it reversible
   (feature flag, additive migration) or a one-way door?
3. **Tests** — would the tests in the diff fail if the change were broken?
4. **Scope** — does the PR do one thing? Unrelated refactors mixed into a fix hide
   regressions; name the unrelated part instead of reviewing it line by line.
5. **Clarity** — only when unclear code is likely to cause the next bug.

#### Grading each finding
- Merge would break production, lose data or open a hole → **CRITICAL**.
- Real defect on a less common path, or a missing guard you can trigger → **WARNING**.
- Readability, naming, small simplifications → **SUGGESTION**, and only if worth
  the author's time.

#### Do not flag
- Formatting, import order, or anything a linter or formatter would fix.
- Personal preference between two correct styles.
- Pre-existing code the diff does not touch or make worse.

#### Summary
Open the summary with the single biggest merge risk in one sentence, or say what
you checked and that you found nothing blocking.`;

const NO_THEN_CHAINS = `This codebase uses \`async\`/\`await\` everywhere. New promise chains make error
handling inconsistent and hide unawaited work.

#### Flag
- New \`.then(...)\` or \`.then(...).catch(...)\` chains inside an \`async\` function
  or a function that could be \`async\`.
- \`.catch(() => {})\` or \`.catch(console.log)\` that swallows an error the caller
  needed to see.
- Mixed styles in one function: \`await\` on one call and \`.then\` on the next.
- A \`.then\` whose callback returns a promise that nothing awaits.

#### Suggest instead
- \`const x = await f();\` inside \`try { … } catch (err) { … }\` when the error is
  handled here; otherwise let it propagate.
- \`await Promise.all([...])\` for independent calls, not nested \`.then\`.

#### Allowed
- Deliberate fire-and-forget at the top level with an explicit error handler,
  e.g. \`void job().catch(log.error)\`, when nothing should wait for it.
- \`.then\` in code that cannot be \`async\` (a sync callback API, a constructor).
- Untouched existing chains: do not ask the author to rewrite lines the diff does
  not change.

#### Severity
**SUGGESTION** for style only. **WARNING** when the chain drops an error or leaves
a promise unawaited so a failure goes unnoticed.`;

const SECRET_LEAKAGE_GATE = `Treat every added line that looks like a credential as a leak until proven
otherwise. Removing it in a later commit does not help: it stays in git history.

#### Patterns to catch (added lines, any file type)
- Stripe live keys: \`sk_live_\`, \`rk_live_\`, \`whsec_\` (webhook signing secret).
- Supabase \`service_role\` key or a JWT whose payload says \`"role":"service_role"\`;
  any \`SUPABASE_SERVICE_ROLE_KEY\` read in browser or edge-public code.
- \`NEXT_PUBLIC_\`, \`VITE_\`, \`EXPO_PUBLIC_\` or \`REACT_APP_\` variables whose name or
  value is a secret (\`*_SECRET\`, \`*_PRIVATE_KEY\`, \`*_SERVICE_ROLE*\`, \`sk_*\`):
  these prefixes ship the value to every browser.
- Cloud and SaaS tokens: \`AKIA…\` / \`ASIA…\` (AWS), \`ghp_\`, \`gho_\`, \`github_pat_\`
  (GitHub), \`xoxb-\` / \`xoxp-\` (Slack), \`sk-…\` / \`sk-proj-…\` (OpenAI), \`sk-ant-\`
  (Anthropic), \`AIza…\` (Google).
- \`-----BEGIN … PRIVATE KEY-----\` blocks, \`.pem\` / \`.p12\` files.
- Connection strings with an inline password: \`postgres://user:pass@…\`,
  \`mongodb+srv://user:pass@…\`, \`redis://:pass@…\`.
- A committed \`.env\`, \`.env.local\` or \`.env.production\` file.
- Secrets written to logs, error messages, analytics events or API responses.

#### Not a leak
- Obvious placeholders (\`sk_test_xxx\`, \`changeme\`, \`<your-key>\`) in docs or tests.
- Reading a secret from \`process.env\` on the server.

#### Reporting
- **CRITICAL** for a real-looking live credential or a server secret exposed to
  the client; the fix is: rotate the key now, then load it from the environment.
- **WARNING** for test-mode keys, or logging that could include a secret.
- Never repeat the secret in your output: show the prefix and mask the rest
  (\`sk_live_****\`).`;

const LETHAL_TRIFECTA = `An LLM or agent becomes an exfiltration tool when one flow combines all three
legs. Any two are fine; the third leg is the vulnerability.

#### The three legs
1. **Private data** — the model can read secrets, user records, private repos,
   internal documents, or call tools that return them.
2. **Untrusted content** — text an attacker can influence reaches the same model:
   PR bodies, issues, emails, web pages, uploaded files, tool or search results.
3. **External communication** — the model can make data leave: HTTP or webhook
   tools, sending email or messages, creating public comments, or output that is
   rendered where it can fetch URLs (markdown images, links auto-fetched by a client).

#### How to check a PR
- Look for code that builds a prompt or agent context, registers tools, or renders
  model output. For each model call, list which legs it has after this diff.
- Flag the change that adds the missing third leg — a new tool, a new input
  source, or a new place output is rendered.
- Name a concrete file:line for each leg and describe the attack in one sentence:
  "an issue body tells the agent to read X and post it to Y".

#### Not a trifecta
- A normal authenticated endpoint that returns a user's own data: that is access
  control, review it as such.
- A model with no tools whose output only a trusted user reads as plain text.

#### Mitigations that break a leg
Egress allowlist, no tools in the run that reads untrusted text, human approval
before any outbound action, output rendered as plain text (no auto-loaded images).

#### Severity
**CRITICAL** with \`kind\` "lethal_trifecta" only when all three legs are connected
in code you can cite. If one leg depends on context you cannot see, report a
**WARNING** with \`kind\` "finding" and say which leg is unconfirmed.`;

const PHANTOM_API_GATE = `Code written with an assistant often calls APIs that look right but do not
exist. A hallucinated package name can also be registered by an attacker
("slopsquatting"), so a missing package is a supply-chain risk, not just a build
error.

#### Flag
- An import of a package that is neither in the dependency manifest nor added to it
  in this diff, or a new dependency whose name is a near-miss of a well-known one
  (\`expresss\`, \`lodash-utils\`, \`reqeusts\`).
- An import of a relative module path that does not appear in the diff or in the
  repo skeleton.
- A named import or method call that the target module does not export: a symbol
  absent from the repo skeleton for a local module, or a method that is not part of
  a well-known library's public API (for example \`fs.readFileAsync\`,
  \`array.findLastIndexOf\`, \`z.string().nonEmpty().email().safe()\`).
- Config keys or CLI flags that the tool does not support, when the diff relies on
  them for behaviour.

#### Evidence required
Only flag when you can point at the evidence: the manifest, the repo skeleton, or
the import line. If the module is outside what you can see, say so and keep it at
**SUGGESTION**.

#### Severity
- **CRITICAL** — a new dependency on a package name that looks hallucinated or
  typosquatted.
- **WARNING** — a call to a local or library API that does not exist (it fails at
  build time or, worse, at run time on a rare path).`;

const TEST_COVERAGE_NUDGE = `Use when the PR changes production behaviour and adds or edits no test file.

#### What to do
- Pick the single change in the PR most likely to regress, and name the one test
  that would protect it: the function, the input, and the expected result.
- Report it as one finding on the production line, not one finding per file.
- If an existing test file obviously covers the touched module, name it and say
  which case to add there.

#### Skip the nudge when
- The change is docs, comments, types only, config values, or a rename.
- The PR is itself a test-only or tooling change.
- The description says why a test is not possible and the reason holds.

#### Severity
**SUGGESTION** by default. **WARNING** when the untested change is in error
handling, permissions, money or data deletion.`;

const TEST_BRANCH_COVERAGE = `A test that passes on the happy path proves nothing about the other branches.
Walk every branch the diff adds or changes and find the test that reaches it.

#### Procedure
1. In each changed production function, list the branches the diff adds or edits:
   \`if\` / \`else if\` / \`else\`, each \`switch\` case and \`default\`, ternaries,
   early \`return\` / \`throw\` guards, \`catch\` and \`finally\` blocks, \`??\` / \`||\`
   fallbacks, optional chaining that short-circuits, loops that may run zero times.
2. For each branch, look in the diff's tests for an input that drives execution
   into it and an assertion on what that branch produces.
3. A branch with no such test is a finding — even when the function as a whole has
   a test. A single test that only feeds valid input covers only the happy path.

#### Writing the finding
- Cite the line of the untested branch in the production file (that line is in the
  diff), not the test file.
- Name the branch ("the \`limit > MAX\` early return", "the \`catch\` around
  \`fetchUser\`") and the missing test: the input that reaches it and the expected
  result, e.g. "add a test calling \`paginate([], 10)\` and asserting it returns
  \`{ items: [], next: null }\`".
- Group several untested branches of the same function into one finding.

#### Severity
- **WARNING** for an untested branch.
- **CRITICAL** when the untested branch is an auth/permission check, a money or
  quota calculation, a data-deleting path, or error handling that could fail open.

#### Do not flag
Branches the diff does not touch, unreachable defensive code (\`assertNever\`),
and logging-only branches.`;

const TEST_CORNER_CASES = `Most regressions live at the edges of the input space. For every changed function
with tests in the diff, check that the tests include the edges that function's
logic actually depends on.

#### Edges to check, by input type
- **Collections** — empty, one element, duplicates, unsorted input, very large.
- **Optional values** — \`null\`, \`undefined\`, missing key, empty object.
- **Numbers** — \`0\`, negative, \`NaN\`, non-integer, \`Number.MAX_SAFE_INTEGER\`,
  rounding of money or percentages.
- **Boundaries** — exactly at a limit, limit − 1 and limit + 1 for every \`<\`,
  \`<=\`, \`>\`, \`>=\` in the change; first and last page; a page past the end;
  \`limit = 0\`.
- **Strings** — empty, whitespace only, unicode (emoji, accents, RTL), very long,
  special characters that need escaping.
- **Time** — time zones, DST change, end of month, leap day, expiry exactly now.
- **Error path** — the dependency throws or rejects, times out, returns 4xx/5xx or
  malformed data. What does the function return or throw then?

#### Rule of thumb
Derive the cases from the code, not from a generic list: each comparison, default
value, \`length\` check, \`try\`/\`catch\` and parse step in the change implies at
least one edge case. Do not demand cases the logic cannot be sensitive to.

#### Writing the finding
One finding per function under test, cited on the production line with the
comparison or guard. List the missing cases as concrete inputs with the expected
result ("\`withinLimit(100, 100)\` → \`true\`; \`withinLimit(101, 100)\` → \`false\`").

#### Severity
**WARNING** when a missing case hits a comparison, guard or error path the diff
changed; **SUGGESTION** for extra robustness cases.`;

const TEST_MOCK_DISCIPLINE = `A mock replaces behaviour. Every mock in a test is a part of the system that the
test no longer checks.

#### Mock only I/O boundaries
Network and HTTP clients, the database, the filesystem, the clock, randomness,
queues and third-party SDKs. Prefer an in-memory fake or a fixture over a mock
with hand-written return values.

#### Flag
- **Mocking the unit under test** — \`vi.mock\` / \`jest.mock\` of the module the test
  imports to verify, or \`spyOn(service, 'method').mockReturnValue(…)\` on the very
  method being tested. The test then verifies the mock.
- **Mocking pure collaborators** — stubbing a pure helper (formatting, validation,
  calculation) of the same module instead of letting it run.
- **Asserting on calls instead of behaviour** — a test whose only assertions are
  \`toHaveBeenCalled\` / \`toHaveBeenCalledTimes(n)\` and never checks the return
  value, the thrown error, or the resulting state.
- **Mocks that cannot happen** — a mock returning a shape the real dependency never
  returns (missing fields, wrong types), so the test passes against fiction.
- **Leaking mocks** — module mocks or spies not restored between tests
  (\`vi.restoreAllMocks\` / \`afterEach\`), which couples tests to their order.

#### Allowed
Asserting a call when the call itself is the behaviour (an email sent, an event
published, a payment captured) — then assert the arguments, not only the count.

#### Severity
**WARNING** when a mock hides the behaviour the test claims to verify;
**SUGGESTION** for brittle call-count assertions alongside real behaviour checks.`;

const API_BREAKING_CHANGES = `Existing clients keep sending yesterday's requests and parsing yesterday's
responses. Any change they cannot absorb is a breaking change.

#### Breaking — flag these
- A route path renamed or removed, or a path parameter renamed, reordered or
  retyped (\`/users/:id\` → \`/users/:userId\` changes the contract for callers that
  build URLs from it).
- A query or body field renamed, removed, or made required; a new required field.
- A field's type, format or allowed values narrowed (\`string\` → \`number\`, an enum
  value removed, a stricter regex or max length).
- A response field renamed, removed, retyped, or changed from always-present to
  nullable/optional; a list wrapped into an object (\`[...]\` → \`{ items: [...] }\`).
- A changed success or error status code (\`200\` → \`201\`, \`404\` → \`200\` with
  \`null\`), a changed error body shape, or a changed method (\`PUT\` → \`PATCH\`).
- Changed auth requirements or pagination semantics on an existing route.

#### Not breaking
Adding an optional request field, adding a response field, adding a new route or
enum value that clients do not have to handle.

#### Acceptable when
- The change ships under a new version (\`/v2/…\`) and the old route keeps working.
- The old field is still accepted/returned and marked deprecated.
- The API is internal and every client is updated in the same PR — say which.

#### Where to look
Route definitions, request/response schemas (Zod, JSON Schema, OpenAPI), shared
contract types, and handlers that build the response.

#### Severity
**CRITICAL** for a breaking change to a route used by clients outside this PR with
no versioning or deprecation path. **WARNING** when you cannot tell whether
external clients exist. Cite the schema or route line that changed.`;

/** The skills the seed creates, idempotent by (workspace_id, name). */
export const SEED_SKILLS: SeedSkill[] = [
  // ---- design skills (Security Reviewer: 3 of 6 enabled) ----
  {
    name: 'pr-quality-rubric',
    description:
      'Use when judging any pull request: weigh correctness, safety, tests and scope before style, and grade each finding by the risk it adds at merge.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    body: PR_QUALITY_RUBRIC,
  },
  {
    name: 'no-then-chains',
    description:
      'Flag new .then()/.catch() promise chains in TypeScript code and ask for async/await with try/catch instead.',
    type: 'convention',
    source: 'extracted',
    enabled: true,
    body: NO_THEN_CHAINS,
  },
  {
    name: 'secret-leakage-gate',
    description:
      'Flag any credential, key or token that the diff commits to source, config, fixtures, logs or a client bundle (sk_live_, service_role, NEXT_PUBLIC_ secrets, private keys).',
    type: 'security',
    source: 'community',
    enabled: true,
    body: SECRET_LEAKAGE_GATE,
  },
  {
    name: 'lethal-trifecta',
    description:
      'Flag a change that lets one LLM or agent flow combine private data access, untrusted content and external communication.',
    type: 'security',
    source: 'community',
    enabled: true,
    body: LETHAL_TRIFECTA,
  },
  {
    name: 'phantom-api-gate',
    description:
      'Flag imports and calls of packages, modules or functions that do not exist in the repository or its declared dependencies.',
    type: 'security',
    source: 'imported_file',
    enabled: false,
    body: PHANTOM_API_GATE,
  },
  {
    name: 'test-coverage-nudge',
    description:
      'Use when a PR changes production behaviour without touching any test: name the one test that would best protect the change.',
    type: 'custom',
    source: 'manual',
    enabled: true,
    body: TEST_COVERAGE_NUDGE,
  },
  // ---- Test Quality Reviewer ----
  {
    name: 'test-branch-coverage',
    description:
      'Flag every new or changed branch (if/else, switch case, early return, catch, fallback) that no test in the diff reaches, naming the branch and the missing test.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    body: TEST_BRANCH_COVERAGE,
  },
  {
    name: 'test-corner-cases',
    description:
      'Flag tests of changed code that skip the edge inputs its logic depends on: empty, null/undefined, zero/negative, boundary values, off-by-one, unicode and the error path.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    body: TEST_CORNER_CASES,
  },
  {
    name: 'test-mock-discipline',
    description:
      'Flag tests that mock the unit under test or assert on mock calls instead of behaviour; mock only I/O boundaries.',
    type: 'convention',
    source: 'manual',
    enabled: true,
    body: TEST_MOCK_DISCIPLINE,
  },
  // ---- API-contract experiment (enabled, linked to no agent) ----
  {
    name: 'api-breaking-changes',
    description:
      'Flag changes to an HTTP route contract (path or params, query or body fields, types, required-ness, status codes, response shape) that break existing clients without versioning or deprecation.',
    type: 'rubric',
    source: 'manual',
    enabled: true,
    body: API_BREAKING_CHANGES,
  },
];

/**
 * Seeded agent → ordered skill links (order = prompt order). Applied only to an
 * agent with no links yet, so a re-seed never overwrites a user's choices.
 */
export const SEED_AGENT_SKILLS: Record<string, SeedSkillLink[]> = {
  'Security Reviewer': [
    { skill: 'pr-quality-rubric', enabled: true },
    { skill: 'no-then-chains', enabled: false },
    { skill: 'secret-leakage-gate', enabled: true },
    { skill: 'lethal-trifecta', enabled: true },
    { skill: 'phantom-api-gate', enabled: false },
    { skill: 'test-coverage-nudge', enabled: false },
  ],
  'Test Quality Reviewer': [
    { skill: 'test-branch-coverage', enabled: true },
    { skill: 'test-corner-cases', enabled: true },
    { skill: 'test-mock-discipline', enabled: true },
  ],
};
