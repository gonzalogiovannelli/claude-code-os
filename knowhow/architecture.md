---
Status: live
Last verified against code: 2026-10-13
Related code: /scripts/knowhow/build-architecture-html.js
---

# System map

The visual map of the system. Mermaid diagrams plus prose; `architecture.html` is
generated from this file (never hand-edit it). A `PostToolUse` hook regenerates it
whenever Claude edits this file; outside a session, run
`node scripts/knowhow/build-architecture-html.js`.

Replace these diagrams with your own system's. They describe the skeleton itself.

## How the guards fit together

```mermaid
flowchart LR
  subgraph Session["Claude Code session"]
    start([Session start]) --> nag[maintenance-due.js]
    nag -->|work waiting| warn[Nag: what is overdue and how much]
    nag -->|nothing to do| silent[Silence]
    edit[Claude edits architecture.md] --> html[build-architecture-html.js]
  end
  subgraph CI["Every push"]
    map[check-system-map.js]
    modes[check-execution-modes.js]
    tickets[check-tickets.js]
  end
  idx[("knowhow/index.md")] --> map
  scripts[("scripts/**")] --> map
  scripts --> modes
  tk[("knowhow/tickets/")] --> tickets
```

## The drift audit

```mermaid
flowchart LR
  docs[("live knowhow docs")] --> dump["audit-knowhow.js --dump"]
  dump -->|related file missing| red[🔴 automatic]
  dump -->|code untouched since verified| green[🟢 automatic]
  dump -->|code changed| json[dump.json: doc + diff only]
  json --> model[In-session model judges]
  model --> findings[findings.json]
  findings --> from["audit-knowhow.js --from"]
  from --> report[_audit/audit-DATE.md]
  from --> log[_audit/log.md, committed]
  from --> ledger[maintenance.json: docs stamped]
```
