---
Status: live
Last verified against code: 2026-10-13
Related code: /scripts/check-system-map.js, /scripts/check-execution-modes.js, /scripts/check-tickets.js, /scripts/knowhow/audit-knowhow.js
---

# Doctrine: how to keep `/knowhow/` honest

This file governs every other doc in `/knowhow/`. It exists because docs rot: they
were correct the day they were written, then the code moved, and nobody updated them.
The rules below make drift visible and cheap to fix.

> Code is the spec for behaviour. Docs capture intent, rules and edge cases. Anything
> else rots.

**The principle behind the checks.** A rule written only as prose is addressed at the
judgment of whoever commits, and it does not hold. A rule with only a check catches you
at push time, after the work is done the wrong way. The rules that last have both
halves: **the prose prevents, the check catches.** Wherever a rule below can be decided
mechanically, it names its check.

## Rule 1. Every knowhow doc carries a header

```
---
Status: live | draft | deprecated
Last verified against code: YYYY-MM-DD
Related code: /scripts/path/to/file.js, ...
---
```

- `live`: accurate and current. Loaded as authoritative context.
- `draft`: being written or revised. Do not trust as-is.
- `deprecated`: kept for history, superseded. Do not load.

`Related code` lists every file or folder whose behaviour the doc claims to describe,
separated by commas; a note in brackets after a path is allowed. A pure policy doc says
`(none, policy)`.

List code, not state the system writes for itself (a ledger, a cache): every write to it
would count as a change to the doc's code, and the doc would show as drifted forever.

**Enforced:** `check-system-map.js` fails on a doc with no frontmatter, a Status outside
the enum, or a `live` doc without a `YYYY-MM-DD` date. It matters more than it looks:
`/audit-knowhow` only walks `live` docs, and cannot find a doc stale without its date, so
any of those is a silent exemption from the audit that nobody granted.

## Rule 2. When you change a script, refresh its docs in the same commit

Find every doc whose `Related code` lists the script. For each one: if it still holds,
bump `Last verified`; if a rule no longer matches, edit it and bump the date; if you
cannot verify, set `Status: draft` and leave a note at the top.

**Never bump a date on a doc you know is incomplete.** The date asserts that you checked.

## Rule 3. Specs describe what IS, not what WILL BE

No "planned" sections and no implementation contracts in `/knowhow/`. A spec that
predicts the future always rots. Think on paper in a ticket; when the work ships, write
the doc describing what was built and delete the plan.

## Rule 4. One concern per file

Aim for 30 to 100 lines. Past ~150, ask whether it has become two concerns stapled
together. Nobody finds the stale section of a monolith.

## Rule 5. The paid model API is only for unattended code

A script that runs when you ask for it has a Claude session already open. It does the
deterministic work; the session does the judgment. See [[execution-modes]].

**Enforced:** `check-execution-modes.js`.

## Rule 6. Audit the docs against the code, monthly

`/audit-knowhow` walks every `live` doc, diffs its `Related code` since `Last verified`
and reports 🔴 drift, 🟡 stale date or 🟢 OK. It never auto-fixes: you review the red
list and edit. The session-start nag ([[maintenance]]) reminds you when there is drift
to look at, and only then.

## Rule 7. Version history lives in git

No `## Changelog` per doc. `git log knowhow/<file>.md` has it. `Last verified` is the
only health stamp a doc needs.

## Rule 8. Deprecate, do not delete

A superseded doc whose reasoning still has value gets `Status: deprecated` and stays.
Delete only what would mislead a future reader who finds it by accident.

## Rule 9. The index is the SSOT for what the system contains

[[index]] lists every skill, script and knowhow doc. **If the index does not list
something, that thing does not exist as far as the next session is concerned.** Any
structural change (a skill, script or doc added or removed) updates the index in the
same commit, and also [[architecture]] if a flow changed.

**Keep index rows short:** what it is, plus a pointer to the doc that owns the detail.
A row that re-explains a subsystem rots while the doc it copied stays correct. The check
catches absence; only short rows prevent lies.

**Enforced:** `check-system-map.js`, both ways: every real thing is listed, and every
listed skill is real. `architecture.md` is not checked, because whether a diagram
reflects reality is not mechanically decidable, and a check that cries wolf gets ignored.

## Rule 10. Link between docs liberally

Use `[[doc-name]]`. It makes the graph navigable for people and for Claude, and it
surfaces orphans.

## What this file is not

Not a style guide, not a workflow, and not a prompt. Docs are read as authoritative
context, not as instructions.
