# Quality rubric — what makes an insight worth recording

The bar: a future agent reads the entry **cold** and knows exactly what to do,
without having to investigate. Test: *"If this would be obvious to anyone reading
the code — don't write it."*

## Include

- Solutions reached only after several attempts
- Dead ends and abandoned approaches — **with the reason**
- Errors specific to this project's setup, and errors that recur
- Library / tool / API behaviour that surprised us (with version)
- Non-obvious commands, workflows, or file locations that were hard to find
- Architecture decisions that involved a trade-off (why we chose A over B)
- Workarounds for third-party quirks

## Exclude

- Generic programming knowledge ("use async/await", "validate input")
- One-off issues unlikely to recur
- Anything already in README, `docs/`, `CLAUDE.md`, or official library docs
- Routine edits, trivial fixes, conversational back-and-forth
- Anything that needs a paragraph — that is documentation, put it in `docs/`
- Secrets, tokens, `.env` values, personal data

## Bad → good

| ❌ Noise | ✅ Actionable |
|---|---|
| "Promises can be tricky." | "`Promise.all()` on the ingestion pipeline times out after ~30 items — use `Promise.allSettled()` in batches of 10 for this module." |
| "Be careful with async." | "Checkout state always goes through the Zustand store (`cartStore.ts`): the cart is shared by 3 components, so local state silently desyncs." |
| "Tests can be flaky." | "A DB-backed test not named `*.it.test.ts` runs in the hermetic lane and fails without Docker — always use the `.it.test.ts` suffix (`server/test/`)." |
| "Shared types may differ." | "`client/src/vendor/shared` is a separate copy of the contracts and has drifted — `diff -r` it against `server/src/vendor/shared` before relying on a type." |
| "e2e specs folder is special." | "`e2e/run.ts` only runs files ending in `.flow.json`; a flow saved as `.json` is silently skipped." |

## Checklist before writing

- [ ] Says **what to do / avoid** and **in what context** (file, function, lib + version)
- [ ] Not derivable from reading the code; not already documented
- [ ] Would save 5+ minutes next time
- [ ] 1–3 lines
- [ ] Fact is confirmed (otherwise → Open Questions)
- [ ] Not a duplicate of an existing entry (grep first)
