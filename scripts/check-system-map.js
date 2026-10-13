// @execution: on-demand  - the guard itself. Runs in CI and by hand. No API.
//
// Enforces doctrine Rule 9: the index is the SSOT for what this system CONTAINS.
//
// WHY A CHECK AND NOT A PARAGRAPH. In the system this skeleton was extracted from,
// this rule was prose for its first months, and it did not hold: two skills and a
// third of the scripts drifted out of the index without anyone noticing. A whole
// subsystem was invisible, so a session asking the repo "what do I have for X?" was
// told: nothing. The rule next to it (doctrine Rule 5, the paid API) was enforced by
// a check from day one and was never broken. The difference was never the prose.
//
// An index that lies is worse than no index, because it is trusted.
//
// What it checks, against every index listed in system.config.json:
//   1. every directory in .claude/skills/ appears as `/<name>`
//   2. every code file under scripts/ appears by basename
//   3. every knowhow/**/*.md appears by filename (exempt subtrees aside)
//   4. every knowhow doc has a frontmatter header with a Status from the doctrine's
//      enum, and every live doc a YYYY-MM-DD "Last verified" date. Not pedantry:
//      /audit-knowhow only walks `live`, so ANY other value silently exempts a doc
//      from the drift audit, and a live doc with no date can never be found stale.
//      An invalid header is an exemption nobody granted.
//   5. no index row names a `/skill` that no longer exists. Checks 1 to 4 ask "is
//      every real thing documented?"; this one asks "is everything documented real?".
//      It was added after a skill was deleted and its row stayed, with the check green.
//
// With more than one index (say, the same index in two languages), they are strict
// mirrors: anything present in one and absent from another is reported as a MIRROR BREAK.
//
// What it deliberately does NOT check:
//   - knowhow/architecture.md. Whether a diagram "reflects" reality is not
//     mechanically decidable, and a check that cries wolf gets ignored.
//   - global skills in ~/.claude/skills/. CI cannot see them.
//
// Known limits. This is a FLOOR, not a proof:
//   - Scripts match by basename on a word boundary, so a script merely named in
//     passing counts as documented. Real coverage is equal or worse, never better.
//   - Basenames can collide across folders (a/sync.js, b/sync.js). Documenting one
//     marks both. Skills do not have this problem: they match the exact `/<name>`.
//
// Usage:  node scripts/check-system-map.js          (exit 1 on any gap)

const fs = require('fs');
const path = require('path');
const { ROOT, load, rel, scriptFiles } = require('./lib/config');
const { parseHeader, DATE } = require('./lib/knowhow');

const cfg = load();
const INDEXES = cfg.indexes;
const STATUSES = cfg.statuses;
const SKILLS_DIR = path.join(ROOT, '.claude', 'skills');
const KNOWHOW = path.join(ROOT, 'knowhow');

// Scripts deliberately left out of the index. The config maps each one to its
// reason, so an exemption is an argument someone made, not a name someone slipped in.
const EXEMPT = new Set(Object.keys(cfg.systemMapExemptScripts));

// Knowhow subtrees answer two separate questions, and they can have different answers:
//   index:  is this doc listed in the index?
//   status: does it declare a valid Status? (which decides whether it gets audited)
// Typical: tickets/ has its own index and its own check, so listing every ticket in
// the system index too would be a second register to keep in step.
const exemptionFor = (relDoc, kind) => {
  const sub = relDoc.includes('/') ? relDoc.split('/')[0] : null;
  const e = sub && cfg.systemMapExemptSubtrees[sub];
  return Boolean(e && e[kind]);
};

const docs = {};
for (const f of INDEXES) {
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) {
    console.error(`✗ ${f} is missing. The index IS the SSOT; it cannot be absent.`);
    process.exit(1);
  }
  docs[f] = fs.readFileSync(abs, 'utf8');
}

const gaps = [];

// 1. Skills
const skills = fs.existsSync(SKILLS_DIR)
  ? fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
  : [];
for (const s of skills) {
  const needle = '`/' + s + '`';
  const absent = INDEXES.filter(f => !docs[f].includes(needle));
  if (absent.length) gaps.push({ what: `skill  /${s}`, absent });
}

// 2. Scripts
// A BASENAME MATCHES ON A WORD BOUNDARY, NOT AS A SUBSTRING. A plain includes() was
// caught passing scripts that were in no index at all: "sync.js" sits inside
// "projects-sync.js". A guard that says yes to a file nobody documented is worse than
// no guard. The forbidden neighbours are the characters that would make it a
// different filename (letters, digits, - _ .). A slash is fine and must be: indexes
// usually write scripts with their folder.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (doc, base) => new RegExp('(^|[^A-Za-z0-9._-])' + escapeRe(base)).test(doc);

const scripts = scriptFiles().map(rel);
for (const f of scripts) {
  if (EXEMPT.has(f)) continue;
  const base = path.basename(f);
  const absent = INDEXES.filter(d => !mentions(docs[d], base));
  if (absent.length) gaps.push({ what: `script ${f}`, absent });
}

// 3. Knowhow docs (recursive: a flat scan validates the top level and silently skips
// everything below it, inside the very check that exists to catch silent gaps).
const SELF_DOCS = new Set(INDEXES.map(f => f.replace(/^knowhow\//, '')));

function walkDocs(dir, prefix = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const r = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walkDocs(path.join(dir, e.name), r));
    else if (e.name.endsWith('.md') && !SELF_DOCS.has(r)) out.push(r);
  }
  return out;
}
const docFiles = walkDocs(KNOWHOW);
const badStatus = [];

for (const d of docFiles) {
  const base = path.basename(d);
  // Same word-boundary match as scripts: as a substring, "modes.md" would pass because
  // the index mentions "execution-modes.md".
  if (!exemptionFor(d, 'index')) {
    const absent = INDEXES.filter(f => !mentions(docs[f], base));
    if (absent.length) gaps.push({ what: `doc    knowhow/${d}`, absent });
  }
  if (exemptionFor(d, 'status')) continue;
  // The header is the frontmatter, read by the same parser the audit uses. A "Status:"
  // line in the body passed the old regex here and was invisible to the audit, which is
  // the disagreement this check exists to prevent.
  const h = parseHeader(fs.readFileSync(path.join(KNOWHOW, d), 'utf8'));
  if (!h) { badStatus.push({ d, why: 'no frontmatter header (Rule 1)' }); continue; }
  if (!STATUSES.includes(h.status)) { badStatus.push({ d, why: `Status: ${h.status || '(missing)'}` }); continue; }
  // A live doc with no usable date can never be found stale: the audit cannot diff
  // from it and the nag skips it. "TBD" is an exemption too.
  if (h.status === 'live' && !DATE.test(h.verified)) badStatus.push({ d, why: `Last verified against code: ${h.verified || '(missing)'} (live docs need YYYY-MM-DD)` });
}

// 4. Orphan rows: the index naming a skill that no longer exists.
// Skills only, on purpose. A deleted SCRIPT may keep a struck-through row (doctrine
// Rule 8: deprecate, do not delete), so a missing file there is the convention. A
// skill has no such convention: it is either invocable or it is a lie.
const orphans = [];
for (const idx of INDEXES) {
  for (const m of docs[idx].matchAll(/^\|[ \t]*`\/([a-z0-9-]+)`[ \t]*\|/gm)) {
    if (!skills.includes(m[1])) orphans.push({ idx, name: m[1] });
  }
}

// Report
console.log('Rule 9: the index is the SSOT for what this system contains (knowhow/doctrine.md)');
console.log(`Checked ${skills.length} skills, ${scripts.length} scripts and ${docFiles.length} knowhow docs against ${INDEXES.join(' + ')}\n`);

if (orphans.length) {
  console.error(`✗ ${orphans.length} index row(s) naming a skill that does not exist:\n`);
  for (const o of orphans) console.error(`  ${o.idx}\n      lists /${o.name}, but .claude/skills/${o.name}/ is gone`);
  console.error('');
}

if (badStatus.length) {
  console.error(`✗ ${badStatus.length} doc(s) with an invalid header (Status must be ${STATUSES.join(' | ')}; live docs need a date).`);
  console.error('  /audit-knowhow only audits live docs with a date, so anything else is a silent exemption:\n');
  for (const b of badStatus) console.error(`  knowhow/${b.d}\n      ${b.why}`);
  console.error('');
}

if (!gaps.length && !badStatus.length && !orphans.length) {
  console.log('✓ Every skill, script and knowhow doc is in the index, and every doc declares a valid header.');
  process.exit(0);
}
if (!gaps.length) process.exit(1);

const allMissing = gaps.filter(g => g.absent.length === INDEXES.length);
const someMissing = gaps.filter(g => g.absent.length < INDEXES.length);

if (allMissing.length) {
  console.error(`✗ ${allMissing.length} undocumented:\n`);
  for (const g of allMissing) console.error(`  ${g.what}`);
  console.error('');
}
if (someMissing.length) {
  console.error(`✗ ${someMissing.length} MIRROR BREAK (in some indexes, not all of them):\n`);
  for (const g of someMissing) console.error(`  ${g.what}\n      missing from: ${g.absent.join(', ')}`);
  console.error('');
}

console.error(`${gaps.length} gap(s). If the index does not list something, that thing does not exist as far as the next session is concerned.`);
process.exit(1);
