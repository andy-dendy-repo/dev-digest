---
name: flaky-test-patterns
description: >
  Flag tests in the diff whose result can change between runs without a code
  change: real time, randomness, shared state, ordering, sleeps and live network.
type: rubric
---

A flaky test is worse than no test: it trains the team to re-run CI and ignore
red builds. For every test the diff adds or changes, ask "could this fail on an
unlucky run?" and flag the cause, not the symptom.

#### Patterns to flag
- **Real time** — `Date.now()`, `new Date()`, `performance.now()` or time zones in
  the code under test or the assertion, without fake timers or an injected clock.
  Watch for assertions on "today", end-of-month and DST-sensitive math.
- **Sleeps instead of conditions** — `setTimeout` / `sleep(500)` / `waitForTimeout`
  before an assertion. The wait is either too long (slow suite) or too short on a
  loaded CI runner. Ask for waiting on the condition, or for fake timers.
- **Randomness** — `Math.random()`, `crypto.randomUUID()`, faker data without a
  fixed seed, when the assertion depends on the generated value.
- **Ordering** — asserting array order from a DB query without `ORDER BY`, from
  `Promise.all` side effects, or from parallel workers writing to one log.
- **Shared state** — module-level variables, singletons, env vars, global mocks or
  DB rows that one test sets and another reads; tests that pass only when run in
  file order or alone.
- **Live network and services** — real HTTP calls, DNS, third-party sandboxes, or
  a fixed port another process may hold. Use a fake or a recorded fixture.
- **Unawaited work** — a promise started by the test or the code under test that is
  not awaited before the assertion or before the test ends.
- **Retries that hide it** — `retry: 3`, `jest.retryTimes`, or a loop that re-runs
  the assertion until it passes.

#### Writing the finding
Cite the test line, name the source of nondeterminism, and give the deterministic
fix: `vi.useFakeTimers()` + `vi.setSystemTime(...)`, a seeded generator, an
explicit `ORDER BY` or a sorted comparison, `await` on the condition, or a fake.

#### Severity
**WARNING** for a pattern that can make the test fail intermittently.
**SUGGESTION** when the nondeterminism cannot change the assertion's outcome today
but will once the test grows (for example, an unsorted list of length one).
