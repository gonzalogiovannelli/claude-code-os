---
Status: live
Last verified against code: 2026-10-13
Related code: /system.config.json, /scripts/lib/config.js, /scripts/check-execution-modes.js
---

# Configuration: `system.config.json`

The one file where this skeleton is adapted to a repo. JSON has no comments, so every
field is explained here.

| Field | Default | What it does |
|---|---|---|
| `indexes` | `["knowhow/index.md"]` | The index files `check-system-map.js` holds to account. With two (say, the same index in two languages) they become **strict mirrors**: anything in one and not the other fails as a mirror break |
| `statuses` | `live, draft, deprecated` | The doctrine's Status enum. Change it only together with [[doctrine]] Rule 1 |
| `paidApiPatterns` | Key names, SDK imports and API hosts for Anthropic and OpenAI | Regular expressions; a code file matching any of them "touches a paid model". Key names alone are not enough, because the official SDKs read the key from the environment. Add any other provider you use |
| `automationEntryPoints` | `[]` | The files that run with **no session**: workflows, a nightly runner. Anything declared `unattended` must be reachable from one of them. Every `scripts/...` or `.claude/skills/...` path named in them counts, and their local imports are followed |
| `systemMapExemptScripts` | `{}` | Scripts deliberately left out of the index, each mapped to its reason: `{ "scripts/x.js": "why" }`. An exemption is an argument someone made, not a name someone slipped in |
| `systemMapExemptSubtrees` | `tickets`, `_audit` | Knowhow subfolders exempt from being listed in the index (`index: true`) and/or from declaring a Status (`status: true`) |

**Why `tickets/` is exempt from the index but not from Status.** Tickets have their own
index and their own check ([[tickets-index]]); listing them in the system index too
would be a second register to keep in step. They still declare a Status, because that is
how `/audit-knowhow` is told to leave closed ones alone.
