// @execution: library  - shared by the checks, the audit and the nag. No API.
//
// Parsing of the knowhow doc header (doctrine Rule 1), and the git questions asked
// about it. One copy, because the check, the audit and the session-start nag must
// agree on what a doc claims; parsers kept in three places drift apart.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./config');

const KNOWHOW = path.join(ROOT, 'knowhow');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Every knowhow .md except the generated audit reports.
function docPaths() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '_audit') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(KNOWHOW);
  return out.sort();
}

// The header is the frontmatter block and nothing else. A "Status:" line further down
// the body is prose, not a declaration.
function parseHeader(text) {
  text = text.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 3);
  if (end < 0) return null;
  const fm = text.slice(4, end);
  const get = (label) => { const m = fm.match(new RegExp(`^${label}:[ \\t]*(.+)$`, 'm')); return m ? m[1].trim() : ''; };
  return { status: get('Status'), verified: get('Last verified against code'), related: get('Related code') };
}

// "Related code: /scripts/a.js, /src/app (the importer)" -> [{ rel, gitPath, abs, missing }].
// Each entry is its first token, so a note in brackets after the path is allowed. Any
// file or folder counts, whatever its extension: a filter on known extensions turns
// the docs about code it does not recognise into "policy" docs that are never audited.
// A path that does not resolve is KEPT and flagged missing: that is a hard red, and
// dropping it silently is how a doc pointing at deleted code looks fine.
function relatedFiles(related) {
  if (!related || /^\(none/i.test(related)) return [];
  return related.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean)
    // A bracketed ALL-CAPS placeholder ("docs/[ID]_memo.md") names a shape, not a file.
    // Reported as missing, it would be red on every run, and a red that is always
    // wrong teaches you to skim past the red section.
    .filter(s => !/\[[A-Z][A-Z0-9_]*\]/.test(s))
    .map(r => {
      const gitPath = r.replace(/^\//, '').replace(/\/$/, '');
      const abs = path.join(ROOT, gitPath);
      return { rel: r, gitPath, abs, missing: !fs.existsSync(abs) };
    });
}

const git = (args) => {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};

// THE ROOT COMMIT IS NOT A CHANGE. A repo created from a template (or any first import)
// brings every doc and every script in one commit dated today, after every
// "Last verified" stamp. Counting that as drift makes the nag fire on day one and sends
// every doc to the audit, about code nobody touched. So history is read excluding the
// root commit(s): only what changed after the repo began can have broken a doc.
const roots = () => git(['rev-list', '--max-parents=0', 'HEAD']).split('\n').filter(Boolean);
const afterRoot = () => ['HEAD', '--not', ...roots()];

module.exports = { KNOWHOW, DATE, docPaths, parseHeader, relatedFiles, git, roots, afterRoot };
