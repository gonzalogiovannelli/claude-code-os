# CLAUDE.md

<!-- Replace this section with your repo: what it is, who uses it, what it replaces. -->
## What this repository is

A file-based SSOT (single source of truth) run with Claude Code. The markdown in this
repo is the truth; anything rendered from it (HTML, documents, sheets) is a disposable view.

## Structure

- `/knowhow` → rules, policies and how each part works. [[knowhow/index]] lists
  everything the system contains; [[knowhow/doctrine]] is how the docs stay honest
- `/knowhow/tickets` → one file per open ticket; closed ones in `closed/`
- `/scripts` → the code. Every script declares how it runs on its first line
- `/.claude/skills` → the skills
- `/data/_state` → machine state that must travel with the repo (the maintenance ledger)
- `system.config.json` → the only place the checks are configured. See
  [[knowhow/configuration]]

## How to behave

- Respond in the language the user writes in
- Never invent. If something is not in the files, say so
- Dates always YYYY-MM-DD
- When the session starts with a MAINTENANCE warning, mention it in one line and ask
  whether to work through it. Do not start on it unasked

## Hard rules

**Every skill, script and knowhow doc is in the index.** Adding or removing one means
updating [[knowhow/index]] in the same commit, and [[knowhow/architecture]] if a flow
changed. `scripts/check-system-map.js` fails CI on any gap.

**The paid model API is only for code that runs unattended.** A script that runs when
the user asks has this session open: the script does the deterministic work, you do the
judgment. No "the volume is too large" exception: pre-process instead. Every code file
in `scripts/` and `.claude/skills/` declares `@execution: unattended | on-demand | library`
on line 1, and `scripts/check-execution-modes.js` fails CI on any violation. See
[[knowhow/execution-modes]].

**When a script changes, the docs that list it in `Related code` are refreshed in the
same commit.** See [[knowhow/doctrine]] Rule 2.

**Before committing:** `npm run check`.

**Every commit starts with its type:** `chore:` data, `fix:` an adjustment, `feat:` something
new, and `!` after the type if it changes how the repo is used. The version bumps itself and
`.githooks/commit-msg` rejects a commit without a prefix. See the Versioning section of the README.

**Why these rules are written here and not only in the checks:** the check catches you
at push time, after the work was done the wrong way. This paragraph is what stops you
doing it in the first place. The prose prevents, the check catches. Neither holds alone.
