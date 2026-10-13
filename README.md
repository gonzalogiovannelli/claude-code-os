# claude-code-os

The governance layer for a repo you run with [Claude Code](https://claude.com/claude-code):
a doctrine for the docs, an index that cannot lie, and the checks that keep both honest.

It is not a starter kit of prompts. It has no domain: no CRM, no notes app, nothing to
configure about your business. It is the part that stops a system like that from rotting.

## The problem

A repo run with Claude Code grows fast: skills, scripts, docs describing how it all
works. Three things go wrong, and none of them is broken code:

- **The docs drift from the code.** They were true the day they were written. Claude
  reads them as authoritative context, so a stale doc is worse than none.
- **Things exist that nothing lists.** A skill or a script nobody indexed is invisible
  to the next session. Ask the repo "what do I have for X?" and the answer is: nothing.
- **Cleanup never happens.** "Create fast, clean up later" executes the first half. The
  tools to clean up exist and nobody runs them, because nothing says it is time.

Writing a rule against each of these does not work. I tried. **A rule that is only
prose does not hold; a rule that is only a check catches you too late.** Everything here
has both halves: the prose in `CLAUDE.md` prevents, the check in CI catches.

## What is in it

| Piece | What it does |
|---|---|
| [Doctrine](knowhow/doctrine.md) | Ten rules for the docs. Every doc carries `Status`, `Last verified against code` and `Related code`, which is what makes drift detectable |
| `check-system-map.js` | Fails CI if a skill, script or doc is missing from the index, if the index lists a skill that no longer exists, or if a doc's `Status` is outside the enum |
| `check-execution-modes.js` | Every code file declares `unattended`, `on-demand` or `library`, and on-demand code that reaches a paid model API (key names, SDK imports, API hosts) fails. When you ask for something, a session is already open and the reasoning happens there. [Why](knowhow/execution-modes.md) |
| `/audit-knowhow` | Drift audit in three phases: the script dumps each doc with **only the diff** of its code since it was last verified, Claude judges in session, the script validates the findings and writes the report. No API calls |
| `maintenance-due.js` | Runs at session start and **stays silent** unless a task is overdue *and* has real work waiting. A nag that fires every time is a nag nobody reads. [How](knowhow/maintenance.md) |
| `check-tickets.js` | Tickets agree in their folder, header, body and index |
| `build-architecture-html.js` | Renders the Mermaid system map into a navigable HTML page, rebuilt by a hook when Claude edits it |

Every rule and check comes from a failure in a real system: the file-based operating
system I built and run daily at a small startup. The comments in the scripts say what
went wrong; the business details were removed.

## Setup

1. **Use this template** on GitHub (or copy the files into your repo). Node 18 or newer;
   there are no dependencies.
2. Run the checks: `npm run check`. All three should pass on the skeleton as it ships.
3. Fill in the top of `CLAUDE.md` with what your repo is.
4. Add your first skill in `.claude/skills/`. Run `npm run check` and watch it fail.
   Then add its row to `knowhow/index.md`. That failure is the system working.
5. If anything runs without a session (a nightly, a webhook), add its entry point to
   `automationEntryPoints` in `system.config.json`. See [configuration](knowhow/configuration.md).
6. Work through [T-001](knowhow/tickets/T-001-adapt-the-skeleton.md) and close it.

The hooks in `.claude/settings.json` run the maintenance nag at session start and rebuild
the architecture page when Claude edits it. Claude Code asks you to approve them the
first time.

## What it does not do

- It does not check that `architecture.md` matches reality. Whether a diagram reflects
  the system is not mechanically decidable, and a check that cries wolf gets ignored.
- Index coverage is a floor, not a proof: a script mentioned anywhere in the index counts
  as listed. It catches absence; only short, honest rows prevent lies.
- The paid-API check is a pattern match. A provider not on the list, or a URL assembled
  from pieces, gets through. Add your providers to `system.config.json`.
- It does not fix drift for you. The audit reports and you decide.

## License

MIT. See [LICENSE](LICENSE).
