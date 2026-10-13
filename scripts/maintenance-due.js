// @execution: on-demand  - runs at session start (hook) and by hand. MUST NOT call a paid API.
//
// MAINTENANCE NAG, printed at the start of every Claude Code session.
//
// WHY THIS EXISTS. A system built as "create fast, clean up later" executes the first
// half and never the second. In the repo this skeleton was extracted from, an audit
// found dozens of records filed under the wrong name, review queues that had never once
// been triaged, duplicated log entries and a classifier that had run zero times in its
// life. None of it was broken code: every problem had a tool built to fix it, unused,
// because nothing ever said it was time.
//
// Not a cron: the cleanup tools are on-demand by design (they reason in the session,
// see knowhow/execution-modes.md), and a cron has no session. Not a Claude Code
// scheduled task either: those live in your user folder, not in the repo, so they do
// not travel to a second machine. It is a LEDGER plus a nag at the door, all in git.
//
// TWO RULES:
//   1. NEVER nag about a date alone. "It has been 23 days" earns a shrug. "23 days, and
//      40 records need a decision" earns action. So it COUNTS the real work waiting and
//      stays silent when the count is zero, however long it has been.
//   2. SILENCE IS THE DEFAULT. A warning that fires every time is a warning nobody reads.
//
// Usage:
//   node scripts/maintenance-due.js               prints nothing when all is well
//   node scripts/maintenance-due.js --done <task> stamps a task as run today
//
// Tasks and cadences live in data/_state/maintenance.json. To add one: a row there,
// and (if the work can be counted for free) a function in COUNTERS below.

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/config');
const { DATE, docPaths, parseHeader, relatedFiles, git, afterRoot } = require('./lib/knowhow');

const LEDGER = path.join(ROOT, 'data', '_state', 'maintenance.json');
const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const daysSince = (d) => d ? Math.floor((Date.now() - Date.parse(d + 'T00:00:00Z')) / 86400000) : null;

// Counters: all deterministic, local and free.

// Relative markdown links that point at a file that is not there.
function countBrokenLinks() {
  const files = git(['ls-files', '*.md']).split('\n').filter(Boolean);
  let broken = 0;
  for (const f of files) {
    if (!exists(path.join(ROOT, f))) continue;
    for (const m of read(path.join(ROOT, f)).matchAll(/\]\(([^)#\s]+\.md)[^)]*\)/g)) {
      const l = m[1].trim();
      if (/^[a-z]+:/i.test(l)) continue;
      const target = l.startsWith('/') ? l.slice(1) : path.join(path.dirname(f), l);
      if (!exists(path.join(ROOT, target))) broken++;
    }
  }
  return broken;
}

// Live docs whose Related code no longer exists. Always work.
function countDeadDocRefs() {
  let dead = 0;
  for (const p of docPaths()) {
    const h = parseHeader(read(p));
    if (!h || h.status !== 'live') continue;
    dead += relatedFiles(h.related).filter(f => f.missing).length;
  }
  return dead;
}

// Live docs whose Related code CHANGED since the doc was last verified, by path. This
// is where drift actually lives: a deleted file is rare, a changed file is every week.
// ONE git call for the whole repo, because this runs at every session start and must not
// cost a second: files that did not change since the OLDEST verified date cannot have
// changed after any later one. The root commit is left out (see lib/knowhow.js): a
// fresh copy of a template is not a change, and must not nag on day one.
function driftedDocs() {
  const docs = [];
  for (const p of docPaths()) {
    const h = parseHeader(read(p));
    if (!h || h.status !== 'live' || !DATE.test(h.verified)) continue;
    const files = relatedFiles(h.related).filter(f => !f.missing).map(f => f.gitPath);
    if (files.length) docs.push({ doc: path.relative(ROOT, p).split(path.sep).join('/'), verified: h.verified, files });
  }
  if (!docs.length) return [];

  const oldest = docs.map(d => d.verified).sort()[0];
  const log = git(['log', `--since=${oldest}`, '--name-only', '--format=%cI', ...afterRoot()]);
  if (!log) return [];                                  // no git, or nothing after the root commit

  // Newest commit first, so the first date seen above a path is its latest change.
  const changed = new Map();
  let when = null;
  for (const line of log.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    if (/^\d{4}-\d{2}-\d{2}T/.test(l)) { when = l.slice(0, 10); continue; }
    if (when && !changed.has(l)) changed.set(l, when);
  }
  // A related entry can be a folder: any file under it counts.
  const lastChange = (f) => {
    let latest = changed.get(f) || '';
    for (const [p, d] of changed) if (p.startsWith(f + '/') && d > latest) latest = d;
    return latest;
  };
  return docs.filter(d => d.files.some(f => lastChange(f) > d.verified)).map(d => d.doc);
}

// COUNT WHAT CHANGED, NOT WHAT IS IMPERFECT. After a real audit, some drifted docs are
// left as they are on purpose. Reporting that residue every session is how a nag turns
// into noise. So the docs that were drifted when the last audit finished are remembered
// BY PATH, and only the others count. (Remembering a count instead hides new drift: fix
// three, three others drift, and the count has not moved.) Dead references are always work.
function docsWork(task) {
  const drifted = driftedDocs();
  const seen = Array.isArray(task.lastDrifted) ? new Set(task.lastDrifted) : null;
  const fresh = seen ? drifted.filter(d => !seen.has(d)) : drifted;
  const dead = countDeadDocRefs();
  const bits = [];
  if (fresh.length) bits.push(`${fresh.length} doc(s) whose code changed ${seen ? 'since your last audit' : 'since they were verified'}`);
  if (dead) bits.push(`${dead} reference(s) from a doc to code that no longer exists`);
  return { n: fresh.length + dead, detail: bits.join(' · ') };
}

// One entry per task id in the ledger. A task with no counter goes by its date alone,
// which is the exception, not the rule: use it only for work that cannot be counted
// without a paid call or a network round trip.
// Add your own here: (task) => ({ n, detail }).
const COUNTERS = {
  'repo-health': () => { const n = countBrokenLinks(); return { n, detail: `${n} broken internal link(s)` }; },
  'docs': docsWork,
};

// What gets remembered when a task is stamped, so the next count is a delta.
const ON_STAMP = {
  'docs': (task) => { task.lastDrifted = driftedDocs(); },
};

function loadLedger() { return JSON.parse(read(LEDGER)); }

function stamp(id) {
  const ledger = loadLedger();
  const t = ledger.tasks[id];
  if (!t) throw new Error(`unknown task "${id}". Known: ${Object.keys(ledger.tasks).join(', ')}`);
  t.lastRun = new Date().toISOString().slice(0, 10);
  if (ON_STAMP[id]) ON_STAMP[id](t);
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
  return t;
}

function main() {
  if (!exists(LEDGER)) return;                          // no ledger, nothing to say
  const doneIdx = process.argv.indexOf('--done');
  if (doneIdx >= 0) {
    const id = process.argv[doneIdx + 1];
    try {
      const t = stamp(id);
      console.log(`✓ "${id}" stamped ${t.lastRun}. Next due in ${t.everyDays} days.`);
    } catch (e) { console.error(e.message); process.exit(1); }
    return;
  }

  const due = [];
  for (const [id, t] of Object.entries(loadLedger().tasks)) {
    const days = daysSince(t.lastRun);
    if (days !== null && days < t.everyDays) continue;  // not overdue
    const counter = COUNTERS[id];
    const work = counter ? counter(t) : { n: null, detail: '(cannot be counted for free; going by the date)' };
    if (work.n === 0) continue;                         // Rule 1: overdue with nothing to do is silence
    due.push({ id, days, what: t.what, detail: work.detail });
  }

  if (!due.length) return;                              // Rule 2: silence is the default

  console.log('');
  console.log('⚠  MAINTENANCE: these have work waiting, and are overdue:');
  console.log('');
  for (const d of due) {
    const age = d.days === null ? 'never run' : `${d.days}d ago`;
    console.log(`   · ${d.id.padEnd(15)} ${age.padEnd(10)}  ${d.detail}`);
    console.log(`     ${d.what}`);
  }
  console.log('');
  console.log('   Ask Claude to work through them. Nothing is written without your OK.');
  console.log('');
}

if (require.main === module) main();

module.exports = { stamp };
