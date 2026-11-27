# flaky-test-patterns — reference notes

Background reading for whoever maintains this skill. **Not part of the skill
core:** the DevDigest importer uses only `SKILL.md` and lists this file as
*ignored (not core)*, so nothing here reaches an agent's prompt.

## Further reading
- Martin Fowler, "Eradicating Non-Determinism in Tests" (2011).
- Google Testing Blog, "Flaky Tests at Google and How We Mitigate Them" (2016).
- Vitest docs: fake timers (`vi.useFakeTimers`, `vi.setSystemTime`).
- Playwright docs: auto-waiting and web-first assertions instead of `waitForTimeout`.

## Triage notes
- Quarantine a known-flaky test with an owner and a ticket; do not add retries.
- Running a suite many times in shuffled order (`vitest --sequence.shuffle`) is a
  cheap way to surface order dependence locally.
