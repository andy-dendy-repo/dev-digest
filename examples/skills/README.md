# Example skill archive: `flaky-test-patterns`

A ready-made skill to try the M2 **Import from file** flow
([spec](../../specs/M2-skills.md)). It is the fourth skill of the
**Test Quality Reviewer**: the seed links three (`test-branch-coverage`,
`test-corner-cases`, `test-mock-discipline`); this one is added by hand through
the UI.

```
flaky-test-patterns.zip
└── flaky-test-patterns/
    ├── SKILL.md               ← the skill core (frontmatter + body)
    ├── references.md          ← extra notes, not part of the skill
    └── scripts/
        └── detect-flakes.sh   ← executable, only here to show it is skipped
```

`flaky-test-patterns/` is the unpacked source of the archive. If you edit it,
rebuild the zip:

```sh
cd examples/skills && rm -f flaky-test-patterns.zip && zip -r -X flaky-test-patterns.zip flaky-test-patterns
```

## Import it

1. Open **Skills** → **Add Skill ▾** → **Import from file**.
2. Pick `examples/skills/flaky-test-patterns.zip` (a `.skill` archive or a single
   `.md` file works the same way).
3. Check the preview, then confirm to save.
4. Open **Agents** → **Test Quality Reviewer** → **Skills**, tick
   `flaky-test-patterns` and drag it to where it should sit in the prompt.

## What the preview should show

- **Core:** `flaky-test-patterns/SKILL.md`. The draft is filled from its
  frontmatter: name `flaky-test-patterns`, type `rubric`, and the folded `>`
  description joined into one sentence. The body is everything after the
  frontmatter.
- **Ignored (not core):** `flaky-test-patterns/references.md`. Other text files are
  listed but never saved or sent to a model.
- **Skipped (not text):** `flaky-test-patterns/scripts/detect-flakes.sh`. The
  archive is unpacked in the browser; executable and binary entries are never
  read or uploaded, only their paths are listed.
- **Nothing is executed.** A skill is text only. No script, binary or command from
  an archive is ever run, at import or at review time. Nothing is stored until you
  confirm.

## Saved disabled until vetted

An imported skill is someone else's instructions inside your agent's prompt, so
it is saved **disabled** with a *needs vetting* badge. Read the body, edit it if
needed, then enable it; DevDigest asks for an explicit confirmation. A skill runs
for an agent only when it is enabled globally **and** ticked on that agent's
Skills tab.
