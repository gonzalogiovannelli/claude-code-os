---
Status: live
Last verified against code: 2026-10-13
Related code: /scripts/maintenance-due.js, /scripts/lib/knowhow.js, /scripts/knowhow/audit-knowhow.js, /.claude/settings.json
---

# Maintenance: the ledger, and the nag at the door

## The problem

A system built as **"create fast, clean up later"** executes the first half and never
the second. The tools to clean up exist, they work, and nobody runs them, because
**nothing ever says it is time.**

## Why it is not a cron

The cleanup tools are on-demand by design: they reason in the Claude session (see
[[execution-modes]]), and a cron has no session. A Claude Code scheduled task would not
work either: it lives in your user folder, not in the repo, so it does not travel to a
second machine.

So it is a **ledger plus a nag at the door**, and all three pieces are in git:

| Piece | Where |
|---|---|
| The ledger (last run and cadence per task) | `data/_state/maintenance.json` |
| The checker | `scripts/maintenance-due.js` |
| The nag on session start | `SessionStart` hook in `.claude/settings.json` |

`git pull` on another machine brings all three. Run a task on one, stamp it, commit, and
the other stops asking.

## The two rules

**1. Never nag about a date alone.** *"It has been 23 days"* earns a shrug. *"23 days,
and 40 records need a decision"* earns action. Each task **counts the real work
waiting**, deterministically and for free, and **stays silent when the count is zero**,
however long it has been.

**2. Silence is the default.** A warning that fires every time is a warning nobody reads.

**And a corollary: count what changed, not what is imperfect.** Some residue is left on
purpose after a real pass. Reporting it every session is how a nag becomes noise. So the
`docs` task remembers which docs were drifted when the last audit finished, by path, and
counts only the others. (A remembered count would hide new drift: fix three, three others
drift, and the number has not moved.)

**The root commit is not a change.** A repo created from a template brings every doc
and every script in one commit dated today, after every `Last verified` stamp. History
is read without it, so a fresh copy does not nag on day one.

## The tasks that ship

| Task | Every | Counts |
|---|---|---|
| `docs` | 30 days | Live docs whose code changed since the last audit, and docs pointing at deleted code. `/audit-knowhow` stamps it itself |
| `repo-health` | 30 days | Internal markdown links pointing at files that are gone |

## Adding a task

1. A row in `maintenance.json`: `everyDays`, `lastRun: null` and `what` (the line shown).
2. A counter in `COUNTERS` in `maintenance-due.js` that returns `{ n, detail }`. Without
   one the task goes by its date alone; keep that for work that cannot be counted for free.
3. Whatever finishes the task runs `node scripts/maintenance-due.js --done <task>`, from
   the skill itself if possible. **A stamp you have to remember is a stamp that gets
   skipped**, and then the nag asks again for work already done.
