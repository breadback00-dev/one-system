# Context Handoff Standard

Use this at the end of every context window, major checkpoint, or thread handoff.

## Goal

Resume the project with the smallest possible context footprint while preserving the exact next move.

## Official Resume Order

In a fresh thread, read only:

1. `AGENTS.md`
2. `memory/one_system_HANDOFF.md`
3. `memory/one_system_SUMMARY.md`
4. `docs/module-plans.md`

Only read additional docs if the handoff or active module plan explicitly points to them.

## Handoff Rules

- Keep the handoff under 25 lines when possible.
- Record only current truth, not the whole project history.
- Prefer exact branch names, commit SHAs, and next actions over narrative recap.
- Name the active module and whether switching modules is allowed.
- State verification status only for checks actually run.
- Call out blockers and explicit non-goals.
- Do not restate implementation history already captured in `memory/one_system_SUMMARY.md`.

## Required Handoff Fields

- date
- active module
- branch
- head commit
- working tree state
- current status
- checks run
- next task
- read next
- blockers
- do not do

## Copy-Paste Template

```md
# One System Handoff

- Date: YYYY-MM-DD
- Active module: Module X - Name
- Branch: branch-name
- Head commit: shortsha
- Working tree: clean/dirty
- Current status: one sentence
- Checks run: typecheck/build/test status
- Next task: one concrete action
- Read next: file1, file2
- Blockers: none or concrete blocker
- Do not do: 1-3 sharp guardrails
```
