// @execution: on-demand  - runs only when you ask, so a Claude session is open. MUST NOT call a paid API.
//
// /audit-knowhow engine: drift report for knowhow docs against the code they describe.
// Implements doctrine Rule 6.
//
// Every live doc carries a header (doctrine Rule 1):
//     Status: live
//     Last verified against code: YYYY-MM-DD
//     Related code: /scripts/a.js, /src/importer/
//
// THE SPLIT, and note how much of the verdict needs no model at all:
//
//   DETERMINISTIC (this script):
//     · a Related path that DOES NOT EXIST is red on the spot
//     · if git says no related path changed after Last verified, the doc CANNOT have
//       drifted: green, without anyone reading it
//     · for the rest, emit the DIFF since Last verified, not the whole file. The doc
//       was true at that date, so only what changed since can have broken it. That is
//       what keeps a long script tractable.
//
//   JUDGMENT (the in-session model):
//     · read doc + diff, and say whether any change contradicts a claim
//
//   GUARD (this script again): --from refuses findings it cannot place. A finding
//   filed under a misspelled doc path would otherwise vanish, and the report would
//   say "0 red" about a doc the model had flagged.
//
// Usage:
//   node scripts/knowhow/audit-knowhow.js --dump <file.json>                 phase 1
//   ... the in-session model writes { "<doc path>": { "findings": [ {claim, problem, ref} ] } }
//   node scripts/knowhow/audit-knowhow.js --from <findings.json> [--out <path>]   phase 3
//   Add --only <substr> to either phase to audit a subset.
//
// Never auto-fixes, never commits.

const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/config');
const { KNOWHOW, DATE, docPaths, parseHeader, relatedFiles, git, roots, afterRoot } = require('../lib/knowhow');

const MAX_DIFF_CHARS = 20000;   // per related path, so one huge rewrite cannot swamp the dump

const hasFlag = (name) => process.argv.includes(name);
function arg(name) {
  if (!hasFlag(name)) return null;
  const v = process.argv[process.argv.indexOf(name) + 1];
  if (!v || v.startsWith('--')) { console.error(`${name} needs a value.`); process.exit(1); }
  return v;
}
const only = arg('--only');
const dumpTo = arg('--dump');
const fromFile = arg('--from');
const today = new Date().toISOString().slice(0, 10);
const outPath = arg('--out') || path.join(KNOWHOW, '_audit', `audit-${today}.md`);

// A bare run used to produce a complete-looking report with zero judgment in it, and
// log it as a pass. It is refused instead.
if (!dumpTo && !fromFile) {
  console.error('Nothing to do. An audit is two runs with your judgment in between:');
  console.error('  --dump <file.json>    phase 1: the candidates');
  console.error('  --from <file.json>    phase 3: the report, from your findings');
  console.error('See .claude/skills/audit-knowhow/SKILL.md.');
  process.exit(1);
}

// Last change to a path, ignoring the root commit (see lib/knowhow.js: a template copy
// or first import is not a change).
const lastModified = (p) => (git(['log', '-1', '--format=%cI', ...afterRoot(), '--', p]) || '').slice(0, 10);

function diffSince(p, verified) {
  // The newest commit on or before Last verified. If the repo is younger than the stamp,
  // the root commit is the baseline: what it brought in arrived together with the doc.
  const base = git(['rev-list', '-1', '--before', `${verified} 23:59:59`, 'HEAD']) || roots()[0];
  let d = base
    ? git(['diff', `${base}..HEAD`, '--', p])
    : '[no git history; whole file follows]\n' + (fs.statSync(path.join(ROOT, p)).isFile() ? fs.readFileSync(path.join(ROOT, p), 'utf8') : '(a folder)');
  if (d.length > MAX_DIFF_CHARS) d = d.slice(0, MAX_DIFF_CHARS) + `\n… [diff truncated, ${d.length - MAX_DIFF_CHARS} more chars]`;
  return d;
}

function collect() {
  const docs = [];
  let skipped = 0;
  for (const abs of docPaths()) {
    const text = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    const h = parseHeader(text);
    const r = path.relative(ROOT, abs).split(path.sep).join('/');
    if (!h || h.status !== 'live') { skipped++; continue; }
    if (only && !r.includes(only)) continue;

    const files = relatedFiles(h.related);
    const missing = files.filter(f => f.missing);
    const present = files.filter(f => !f.missing);
    const codeDate = present.map(f => lastModified(f.gitPath)).filter(Boolean).sort().pop() || '';
    // No usable date: treated as changed, so it reaches judgment instead of going green.
    const codeNewer = present.length > 0 && (!DATE.test(h.verified) || Boolean(codeDate && codeDate > h.verified));
    docs.push({ rel: r, text, header: h, present, missing, codeDate, codeNewer });
  }
  return { docs, skipped };
}

const { docs, skipped } = collect();

// PHASE 1: dump the candidates for the in-session model.
if (dumpTo) {
  const payload = [];
  let autoRed = 0, autoGreen = 0;
  for (const d of docs) {
    if (d.missing.length) { autoRed++; continue; }
    if (!d.codeNewer) { autoGreen++; continue; }
    payload.push({
      doc: d.rel,
      lastVerified: d.header.verified,
      codeLastChanged: d.codeDate,
      docText: d.text,
      diffs: d.present.map(f => ({ file: f.rel, diffSinceVerified: diffSince(f.gitPath, d.header.verified) })),
    });
  }
  fs.writeFileSync(dumpTo, JSON.stringify(payload, null, 2));
  console.log(`Live docs: ${docs.length}  (${skipped} skipped: no header or not live)`);
  console.log(`  red, automatic (Related path MISSING): ${autoRed}`);
  console.log(`  green, automatic (no related code, or code untouched since verification): ${autoGreen}`);
  console.log(`  needs judgment: ${payload.length}, written to ${dumpTo}`);
  console.log('\nPhase 2: read each entry (the doc, plus ONLY the diff of its code since Last verified).');
  console.log('Flag a finding ONLY if a change in the diff CONTRADICTS a factual claim in the doc.');
  console.log('Omissions, tone and incompleteness are NOT drift. When in doubt, leave it out.');
  process.exit(0);
}

// PHASE 3: validate the findings, then assemble the report.
const FINDINGS = JSON.parse(fs.readFileSync(fromFile, 'utf8'));
const known = new Set(docs.map(d => d.rel));
const bad = [];
for (const [k, v] of Object.entries(FINDINGS)) {
  if (!known.has(k)) { bad.push(`"${k}" is not a live doc in this run${only ? ` (--only ${only})` : ''}. Use the exact "doc" path from the dump.`); continue; }
  if (!v || !Array.isArray(v.findings)) { bad.push(`"${k}" needs { "findings": [ ... ] }.`); continue; }
  v.findings.forEach((f, i) => {
    if (!f || typeof f.claim !== 'string' || typeof f.problem !== 'string') bad.push(`"${k}" finding #${i + 1} needs "claim" and "problem" as text.`);
  });
}
if (bad.length) {
  console.error(`✗ ${bad.length} problem(s) in ${fromFile}. Nothing was written:\n`);
  for (const b of bad) console.error(`  ${b}`);
  process.exit(1);
}

const red = [], yellow = [], green = [];
for (const d of docs) {
  const found = (FINDINGS[d.rel] && FINDINGS[d.rel].findings) || [];
  if (d.missing.length) {
    red.push({ ...d, findings: d.missing.map(f => ({
      claim: `Related code: ${f.rel}`,
      problem: 'That path does not exist. The doc points at code that was deleted or moved.',
      ref: f.rel,
    })).concat(found) });
  } else if (found.length) red.push({ ...d, findings: found });
  else if (d.codeNewer) yellow.push(d);
  else green.push(d);
}

const lines = [];
lines.push(`# Knowhow drift audit, ${today}`, '');
lines.push(`Audited ${docs.length} live doc(s)${only ? ` matching "${only}"` : ''}. 🔴 ${red.length}  🟡 ${yellow.length}  🟢 ${green.length}`, '');
lines.push('> Generated by `scripts/knowhow/audit-knowhow.js`. The git checks are deterministic;',
           '> the drift judgments came from the in-session model. Advisory only: nothing is auto-fixed.', '');

lines.push(`## 🔴 Drift: a claim no longer holds (${red.length})`, '');
if (!red.length) lines.push('_none_', '');
for (const d of red) {
  lines.push(`### ${d.rel}  _(Last verified ${d.header.verified || 'never'})_`);
  for (const f of d.findings) {
    lines.push(`- **Claim:** ${f.claim}`);
    lines.push(`  - Problem: ${f.problem}${f.ref ? `  _(ref: ${f.ref})_` : ''}`);
  }
  lines.push('');
}

lines.push(`## 🟡 Stale date: code changed after Last verified (${yellow.length})`, '');
if (!yellow.length) lines.push('_none_', '');
for (const d of yellow) lines.push(`- **${d.rel}**: verified ${d.header.verified || 'never'}, related code last changed ${d.codeDate || 'unknown'}. Re-read and bump \`Last verified\`.`);
if (yellow.length) lines.push('');

lines.push(`## 🟢 OK (${green.length})`, '');
for (const d of green) lines.push(`- ${d.rel}${d.present.length ? '' : '  _(policy, no related code)_'}`);
lines.push('');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'));

// THE PASS LOG: one committed line per run. The reports are gitignored, which made the
// one artifact proving Rule 6 is followed the one artifact git could not see. This log
// is un-ignored on purpose, and written by the run itself, because a record you have to
// remember to write disagrees with reality the first time you are busy. A partial run
// says so in its row: it is not a full pass.
try {
  const logPath = path.join(KNOWHOW, '_audit', 'log.md');
  // The table is the LAST thing in the file: this appends, so anything below the table
  // would push every future row out of it.
  const header = '# Drift audit: pass log\n\n'
    + '_One line per run, appended by `scripts/knowhow/audit-knowhow.js`. The full reports sit\n'
    + 'beside this file and are gitignored; this log is not. Do not hand-edit, and keep the table last._\n\n'
    + '| Date | Scope | Live docs | 🔴 | 🟡 | 🟢 |\n|---|---|---|---|---|---|\n';
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, header);
  fs.appendFileSync(logPath, `| ${today} | ${only ? `partial: ${only}` : 'full'} | ${docs.length} | ${red.length} | ${yellow.length} | ${green.length} |\n`);
} catch (e) {
  console.error(`(pass log not updated: ${e.message})`);   // never lose the report over the log line
}

// Stamp the maintenance ledger from here, for the same reason: a separate "remember to
// tick it off" step is the step that gets skipped, and then the nag asks again for an
// audit that already ran. A partial run is not a full pass, so it does not stamp.
if (!only) {
  try { require('../maintenance-due').stamp('docs'); }
  catch (e) { console.error(`(maintenance ledger not stamped: ${e.message})`); }
}

console.log(`=== ${red.length} 🔴  ${yellow.length} 🟡  ${green.length} 🟢 ===`);
console.log(`Report: ${path.relative(ROOT, outPath).split(path.sep).join('/')}`);
if (red.length) { console.log('\n🔴 docs:'); for (const d of red) console.log(`  - ${d.rel}`); }
