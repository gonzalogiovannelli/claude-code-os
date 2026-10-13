---
Status: live
Last verified against code: 2026-10-13
Related code: (none, policy)
---

# T-001. Adapt the skeleton to this repo

State: open
Type: ops
Opened: 2026-10-13

## Why

The skeleton ships with its own docs and checks, and nothing of yours yet. This ticket
is also the example of what a ticket looks like.

## To do

- [ ] Fill in the top of `CLAUDE.md`: what this repo is, its structure, its rules
- [ ] Set `automationEntryPoints` in `system.config.json` if anything runs unattended
- [ ] Add your first skill and its row in `knowhow/index.md`, and watch the check
      fail before you add the row
- [ ] Replace the diagram in `knowhow/architecture.md` with your system's
- [ ] Close this ticket: `git mv` into `closed/`, `Status: deprecated`,
      `State: closed (YYYY-MM-DD)`, row to the Closed table
