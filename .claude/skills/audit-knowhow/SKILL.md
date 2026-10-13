---
name: audit-knowhow
description: Audit the /knowhow/ docs for drift against the code they document (doctrine Rule 6). Walks every Status:live doc, diffs its Related code since the doc was last verified, and the in-session model judges each diff to produce a 🔴/🟡/🟢 drift report. Use when the user says "audit knowhow", "check for doc drift", when the session-start nag lists `docs`, or before a large planning session.
---

# /audit-knowhow: doc-vs-code drift report

Implements `knowhow/doctrine.md` Rule 6. Engine: `scripts/knowhow/audit-knowhow.js`.
Advisory only: it never auto-fixes and never commits.

**The engine calls no model.** The judgment is yours, in session
(`knowhow/execution-modes.md`). That makes this a **three-phase** procedure, and skipping
to a bare run is the failure mode described at the end of phase 3.

## Phase 1: dump the candidates

```
node scripts/knowhow/audit-knowhow.js --dump <scratch>/audit-dump.json
```

Deterministic. It walks every `Status: live` doc and sorts them:

- a Related file that **does not exist**: 🔴 on the spot
- **no** related code, or code **untouched** since `Last verified`: 🟢, it cannot have drifted
- everything else goes to the dump, with the doc text and **only the diff of its code
  since `Last verified`**, not the whole file

Write the dump to a scratch location outside the repo, not into `knowhow/`.

## Phase 2: you judge

Read each entry. **Flag a finding ONLY if a change in the diff CONTRADICTS a factual
claim in the doc.** Omissions, tone and incompleteness are not drift. When in doubt,
leave it out. Write:

```json
{ "<doc path>": { "findings": [ { "claim": "…", "problem": "…", "ref": "…" } ] } }
```

If the dump is large, `--only <substr>` scopes the run to a subset; say that you used it.
A commit that touched every script (a header line, a rename) marks many docs 🟡 for
nothing: triage those by how much of each diff is real.

## Phase 3: assemble

```
node scripts/knowhow/audit-knowhow.js --from <scratch>/findings.json
```

It first checks your findings: a key that is not the exact `doc` path from the dump, or
a finding without `claim` and `problem`, stops the run and nothing is written. Then it
writes `knowhow/_audit/audit-<date>.md` (gitignored), appends a line to
`knowhow/_audit/log.md` (committed) and, on a full run, stamps the `docs` task in the
maintenance ledger.

> **An audit is two runs with your judgment in between.** A report built without
> findings would look complete and contain zero judgment: nothing could be 🔴 except a
> missing file, and every doc whose code moved would land in 🟡 unread. That is why the
> engine refuses to run with neither `--dump` nor `--from`.

## Then present it, grouped

- **🔴 Drift**: a specific claim no longer holds. Each with problem and ref. Needs a doc
  edit, or sometimes reveals a code bug worth fixing instead.
- **🟡 Stale date**: code changed and you found no contradiction. Bump the date.
- **🟢 OK**: no action.

**Act only with the user's go-ahead, one doc at a time.** For 🔴, open the doc and the
cited code and confirm the contradiction before editing: your own findings can be wrong.

## Rules

- **Never bump a date on a doc you know is materially incomplete.** The date asserts you
  checked it and it holds. Add what is missing, then bump.
- A 🟢 is not a guarantee: it means no related file changed, or you found no
  contradiction in what did.
- Respond in the user's language.
