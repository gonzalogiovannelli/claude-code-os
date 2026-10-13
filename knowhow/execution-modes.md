---
Status: live
Last verified against code: 2026-10-13
Related code: /scripts/check-execution-modes.js, /system.config.json
---

# Execution modes: who may spend the paid API

## The rule

> **The paid model API is only for code that runs UNATTENDED.**
>
> A script that runs only when you ask for it has a Claude session already open: a
> model in the room, already paid for by your plan. It must not pay for a second one.
> The script does the **deterministic** work (fetch, filter, guard, write); the
> **in-session model** does the **judgment** (extract, classify, decide).
>
> **There is no "the volume is too large" exception.** Pre-process the material so the
> session can reason over something compact: extract the text, take the diff, build an
> index. That is a design problem, not a licence to spend.

## Why it is not only about money

The amounts are usually cents. Two better reasons:

1. **The session has context an API call cannot have:** the conversation, the repo and
   whatever was just discovered. An API call starts cold.
2. **Cost makes good tools unused.** A tool that costs money per run gets made opt-in,
   nobody opts in, and it never runs. A tool that is free does not need to be opt-in.

## The three modes

Every code file under `/scripts/` and `/.claude/skills/` (JS, TS, Python, shell,
PowerShell) declares its mode on its **first line** (line 2 after a shebang), in its
language's comment syntax.

| Tag | Meaning | Paid API |
|---|---|---|
| `// @execution: unattended` | Runs with **no session**: CI, a cron, a webhook | **Allowed**, and only here |
| `// @execution: on-demand` | Runs when you ask. A session is open | **Forbidden** |
| `// @execution: library` | Shared code, reachable from on-demand callers | **Forbidden**: it inherits their ban |

## Enforced, not remembered

`scripts/check-execution-modes.js` runs in CI and fails on:

1. an `on-demand` or `library` file that touches a paid API
2. an `on-demand` or `library` file that imports an `unattended` one (the call is one
   hop away, but it is the same call)
3. an `unattended` file that nothing schedules (a lie, or dead code)
4. a file with no declaration at all, so a new one cannot slip in undecided

**"Touches a paid API" is a pattern match, and a floor.** Key names alone are not
enough: the official SDKs read the key from the environment, so `new Anthropic()` never
names it. The default patterns cover key names, SDK imports and API hosts for Anthropic
and OpenAI. Code that assembles a URL from pieces, or a provider not on the list, gets
through. Add yours.

The patterns and the entry points that run without a session (workflows, a nightly
runner) are set in `system.config.json`; see [[configuration]].

**A folder split was the obvious alternative, and the wrong one.** Scripts are organised
by domain, which is what you navigate by, and shared libraries belong to neither side.
A folder is a convention you can violate in silence. A check is not.

## The pattern for moving an on-demand script off the API

Three phases. `/audit-knowhow` is the worked example in this repo.

1. **`--dump <file>`**: the script does everything deterministic and writes the raw
   material to JSON.
2. **The in-session model** reads it and writes its judgments back as JSON.
3. **`--from <file>`**: the script validates each judgment through its **guards** and
   writes the result. In `/audit-knowhow` the guard refuses findings filed under a doc
   that is not in the run, or without a claim and a problem, and writes nothing.

**The guards are the point.** They stay code, because they are what protects the data,
and they must not depend on any model. Whatever the model proposes, the guard vets.

See [[doctrine]] Rule 5.
