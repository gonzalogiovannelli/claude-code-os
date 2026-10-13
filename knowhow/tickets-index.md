---
Status: live
Last verified against code: 2026-10-13
Related code: /scripts/check-tickets.js
---

# Tickets index

One file per ticket: bugs, improvements, pending decisions. A ticket is where you think
on paper about something not built yet ([[doctrine]] Rule 3), so it never goes in a
knowhow doc.

## Where a ticket lives and what it says

Four things must agree:

| | Open ticket | Closed ticket |
|---|---|---|
| **Folder** | `knowhow/tickets/` | `knowhow/tickets/closed/` |
| **Header `Status:`** | `live` | `deprecated` |
| **Body `State:`** | `open` | `closed (YYYY-MM-DD)` |
| **Table below** | Open | Closed |

`scripts/check-tickets.js` fails CI if they disagree.

**Why the body field is `State:` and not `Status:`.** `Status:` is the doctrine field,
and it decides whether `/audit-knowhow` reads the file. When a ticket's lifecycle word
lands there (`Status: open`, `Status: done`), the file silently drops out of the audit.
Two fields, two names.

**Closing a ticket** is mechanical: `git mv` it into `closed/`, set `Status: deprecated`,
set `State: closed (date)`, and move its row to the Closed table. Deprecation, not
deletion: a closed ticket stays readable, it just stops being audited against today's code.

## Opening a ticket

Ask Claude: *"open a ticket: [type], [description]"*. Types: `bug`, `improvement`,
`pending-decision`, `feature`, `ops`. Filename `T-NNN-short-slug.md`, starting from the
template in `T-001`.

## Open (1)

| ID | Type | Title | Opened |
|----|------|-------|--------|
| T-001 | ops | Adapt the skeleton to this repo | 2026-10-13 |

## Closed (0)

| ID | Type | Title | Closed |
|----|------|-------|--------|
