// @execution: on-demand  - the guard itself. Runs in CI and by hand. No API.
//
// Enforces doctrine Rule 5: the paid model API is only for code that runs UNATTENDED.
//
// A script that only runs when you ask for it has a Claude session already open: a
// model in the room, with the conversation and the repo in context, already paid for
// by your plan. It must not pay for a second one that starts cold. The script does the
// deterministic work (fetch, filter, guard, write); the in-session model does the
// judgment (extract, classify, decide).
//
// There is NO "the volume is too large" exception. Pre-process the material (extract
// the text, take the diff, build an index) so the in-session model can reason over
// something compact. That is a design problem, not a licence to spend.
//
// Every code file under scripts/ and .claude/skills/ declares its mode on its FIRST
// line (line 2 after a shebang), in whatever comment syntax its language uses:
//     // @execution: unattended   runs with no session (CI, cron). Paid API allowed.
//     # @execution: on-demand     runs only when you ask. Paid API FORBIDDEN.
//     // @execution: library      shared code. Paid API FORBIDDEN: it is reachable
//                                 from on-demand callers, so it inherits their ban.
//
// Fails on:
//   1. an on-demand or library file that matches a paid-API pattern
//   2. an on-demand or library file that requires an unattended one (the call is
//      one hop away, but it is the same call)
//   3. an unattended file that nothing actually schedules (a lie, or dead code)
//   4. a file with no declaration at all, so a new one cannot slip in undecided
//
// WHAT "TOUCHES A PAID API" MEANS. Key names alone are not enough: the official SDKs
// read the key from the environment, so `new Anthropic()` never names it. The patterns
// (system.config.json, paidApiPatterns) cover key names, SDK imports and API hosts.
// This is a FLOOR: code that builds the URL from pieces, or a provider not in the
// list, gets through. Add your providers to the list.
//
// A folder split (scripts/unattended/, scripts/on-demand/) is the obvious alternative
// and the wrong one: scripts are organised by domain, which is what you navigate by,
// and shared libraries belong to neither side. A folder is a convention you can
// violate in silence. A check is not.
//
// Usage:  node scripts/check-execution-modes.js         (exit 1 on any violation)

const fs = require('fs');
const path = require('path');
const { ROOT, load, rel, codeFiles } = require('./lib/config');

const cfg = load();
const MODES = ['unattended', 'on-demand', 'library'];
const PATTERNS = cfg.paidApiPatterns.map(p => new RegExp(p));
// Files that spell out the patterns in order to LOOK for them. Without this they
// would flag themselves.
const NAMES_THE_PATTERNS = new Set(['scripts/check-execution-modes.js', 'scripts/lib/config.js']);

const files = codeFiles('scripts', '.claude/skills').map(rel);
const fileSet = new Set(files);
const src = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));

// Local imports of a file, resolved to repo paths that exist.
function localDeps(f) {
  const out = [];
  const dir = path.posix.dirname(f);
  const tryResolve = (spec) => {
    const base = path.posix.join(dir, spec);
    for (const c of [base, ...['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.py'].map(e => base + e), base + '/index.js', base + '/index.ts']) {
      if (fileSet.has(c)) return c;
    }
    return null;
  };
  const s = src[f];
  if (f.endsWith('.py')) {
    // Sibling modules only (`import foo`, `from foo import x`, `from .foo import x`).
    for (const m of s.matchAll(/^\s*(?:from\s+\.?([\w.]+)\s+import|import\s+([\w.]+))/gm)) {
      const r = tryResolve((m[1] || m[2]).split('.')[0]);
      if (r) out.push(r);
    }
  } else {
    // require('./x'), import ... from './x', import('./x')
    for (const m of s.matchAll(/(?:require\(|from\s+|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const r = tryResolve(m[1]);
      if (r) out.push(r);
    }
  }
  return out;
}

// What the automation reaches: entry points (workflows naming scripts on a `run:` line,
// or scripts themselves), then local imports, transitively. A lazy import inside an `if`
// still counts as reachable. That is the safe direction: it can only make us keep an
// API call we could have removed, never remove one that unattended code needed.
function automationClosure() {
  const seen = new Set();
  const stack = [];
  for (const a of cfg.automationEntryPoints) {
    const abs = path.join(ROOT, a);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    for (const m of text.matchAll(/((?:scripts|\.claude\/skills)\/[\w/.-]+)/g)) if (fileSet.has(m[1])) stack.push(m[1]);
    if (fileSet.has(a)) stack.push(a);
  }
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    stack.push(...localDeps(f));
  }
  return seen;
}

const reachable = automationClosure();
const violations = [];
const mode = {};
const counts = { unattended: 0, 'on-demand': 0, library: 0 };

for (const f of files) {
  const lines = src[f].split('\n');
  const tagLine = lines[0].startsWith('#!') ? (lines[1] || '') : lines[0];
  const m = tagLine.match(/@execution:\s*([a-z-]+)/);
  if (!m || !MODES.includes(m[1])) {
    violations.push({ f, why: `no "@execution: <${MODES.join('|')}>" on line 1 (or line 2, after a shebang). Every code file must declare how it runs.` });
    continue;
  }
  mode[f] = m[1];
  counts[m[1]]++;
}

for (const f of Object.keys(mode)) {
  const md = mode[f];
  const body = src[f].split('\n').slice(1).join('\n');
  const hit = NAMES_THE_PATTERNS.has(f) ? null : PATTERNS.find(re => re.test(body));

  if (hit && md !== 'unattended') {
    violations.push({ f, why: `declared "${md}" but matches the paid-API pattern /${hit.source}/. On-demand code lets the in-session model do the reasoning. See knowhow/execution-modes.md.` });
  }
  if (md !== 'unattended') {
    for (const d of localDeps(f)) {
      if (mode[d] === 'unattended') violations.push({ f, why: `declared "${md}" but imports ${d}, which is unattended. Calling it from here spends the API with a session open.` });
    }
  }
  if (md === 'unattended' && !reachable.has(f)) {
    violations.push({ f, why: 'declared "unattended" but no automation entry point in system.config.json reaches it. Wire it up, or it is really on-demand (and then it must not use the API).' });
  }
}

console.log('Rule 5: the paid API is only for unattended code (knowhow/execution-modes.md)');
console.log(`Checked ${files.length} code files in scripts/ and .claude/skills/.  unattended: ${counts.unattended}   on-demand: ${counts['on-demand']}   library: ${counts.library}`);
if (!PATTERNS.length) console.log('(paidApiPatterns is empty: nothing is being looked for.)');

if (!violations.length) {
  console.log('\n✓ Every code file declares its mode, and no on-demand or library code reaches a paid API.');
  process.exit(0);
}

console.error(`\n✗ ${violations.length} violation(s):\n`);
for (const v of violations) console.error(`  ${v.f}\n      ${v.why}\n`);
process.exit(1);
