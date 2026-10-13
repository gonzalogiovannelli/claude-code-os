---
Status: live
Last verified against code: 2026-10-13
Related code: /scripts/check-system-map.js
---

# Index: what this system contains

**The SSOT for what exists here.** If a skill, script or knowhow doc is not listed, it
does not exist as far as the next session is concerned ([[doctrine]] Rule 9).
`check-system-map.js` fails CI on any gap. Keep rows short: what it is, and the doc that
owns the detail.

## 1. Skills

| Skill | What it does | Detail |
|---|---|---|
| `/audit-knowhow` | Drift report of the knowhow docs against their code | [[doctrine]] Rule 6 |

## 2. Scripts

| Script | Mode | What it does | Detail |
|---|---|---|---|
| `check-system-map.js` | on-demand, CI | Every skill, script and doc is in this index; every Status is valid | [[doctrine]] Rule 9 |
| `check-execution-modes.js` | on-demand, CI | Every script declares its mode; only unattended code touches a paid API | [[execution-modes]] |
| `check-tickets.js` | on-demand, CI | Folder, header, body and index of every ticket agree | [[tickets-index]] |
| `maintenance-due.js` | on-demand, session start | The nag: overdue tasks with real work waiting | [[maintenance]] |
| `knowhow/audit-knowhow.js` | on-demand | Engine of `/audit-knowhow` | [[doctrine]] Rule 6 |
| `knowhow/build-architecture-html.js` | on-demand, hook | Renders `architecture.md` into `architecture.html` | [[architecture]] |
| `lib/config.js` | library | Reads `system.config.json` | [[configuration]] |
| `lib/knowhow.js` | library | Parses the knowhow doc header | [[doctrine]] Rule 1 |

## 3. Knowhow

| Doc | What it owns |
|---|---|
| `doctrine.md` | The rules that keep the docs honest, and which check enforces each |
| `execution-modes.md` | Who may spend the paid API, and the dump, judge, apply pattern |
| `maintenance.md` | The ledger and the session-start nag |
| `configuration.md` | Every field of `system.config.json` |
| `architecture.md` | The visual map (Mermaid); `architecture.html` is generated from it |
| `tickets-index.md` | Open and closed tickets, and how a ticket is closed |
