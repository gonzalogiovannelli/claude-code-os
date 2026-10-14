# Changelog

One entry per version, newest first. The version bumps itself on every commit from its
prefix: `feat:` bumps the middle number, `fix:` the last one, `chore:` (pure data) does
not bump and is not listed here, and `!` after the type (a change that forces adapting
what was there) bumps the first. See `.githooks/version.js`.

Entries before 2026-10-14 were rebuilt from the history: the commits had no prefix, so
each one was classified by what it touched, counting its largest change.

## 1.1.1 (2026-10-14)

fix: the version hooks speak English, like the rest of the template

## 1.1.0 (2026-10-14)

feat: the repo gets a version that bumps itself from each commit prefix, with history rebuilt from 1.0.0

## 1.0.0 (2026-10-13)

claude-code-os: doctrine, index and checks for a repo run with Claude Code
