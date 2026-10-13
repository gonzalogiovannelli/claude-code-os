// @execution: on-demand  - runs in CI and by hand. Reads files, no API, no network.
//
// OPEN AND CLOSED TICKETS MUST AGREE IN FOUR PLACES.
//
// A ticket says whether it is finished in four independent spots: the folder it sits
// in, the doctrine `Status:` in its header, its own `State:` line, and the table it
// appears in in knowhow/tickets-index.md. With nothing keeping them in step, they
// drift: a ticket shipped months ago still listed as open, a ticket that says DONE in
// its body and open in the index.
//
// One of those drifts matters more than it looks. `Status:` in the header is the
// DOCTRINE field (live | draft | deprecated), and /audit-knowhow only walks `live`. If
// the ticket's lifecycle word lands in that field ("Status: open", "Status: done"),
// the file is silently exempt from the drift audit. That is why the ticket's own field
// is called `State:`. Two fields, two names.
//
// Usage:  node scripts/check-tickets.js          (exit 1 on any disagreement)

const fs = require('fs');
const path = require('path');
const { ROOT, load } = require('./lib/config');

const STATUSES = load().statuses;
const OPEN = path.join(ROOT, 'knowhow', 'tickets');
const CLOSED = path.join(OPEN, 'closed');
const INDEX = path.join(ROOT, 'knowhow', 'tickets-index.md');

const problems = [];

function tickets(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name)
    .sort();
}

function check(dir, where, wantStatus, wantState) {
  const seen = [];
  for (const f of tickets(dir)) {
    const r = path.relative(ROOT, path.join(dir, f)).split(path.sep).join('/');
    const id = (f.match(/^(T-\d{3})-/) || [])[1];
    if (!id) { problems.push(`${r}\n      filename does not start with T-NNN-`); continue; }
    if (seen.includes(id)) problems.push(`${r}\n      ${id} is used by another ticket in the same folder.`);
    seen.push(id);

    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const status = ((text.match(/^Status:[ \t]*(.+)$/m) || [])[1] || '').trim() || null;
    const state = ((text.match(/^State:[ \t]*(\S+)/m) || [])[1] || '').trim() || null;

    if (status !== wantStatus) {
      problems.push(
        `${r}\n      header says "Status: ${status || '(missing)'}". A ticket in ${where} must be "Status: ${wantStatus}".` +
        (status && !STATUSES.includes(status)
          ? `\n      "${status}" is not in the doctrine enum at all, so /audit-knowhow skips this file entirely.`
          : '')
      );
    }
    if (state !== wantState) {
      problems.push(`${r}\n      body says "State: ${state || '(missing)'}". A ticket in ${where} must be "State: ${wantState}".`);
    }
    if (wantState === 'closed' && !/^State:[ \t]*closed[ \t]*\(\d{4}-\d{2}-\d{2}\)/m.test(text)) {
      problems.push(`${r}\n      a closed ticket must carry the date it closed: "State: closed (YYYY-MM-DD)".`);
    }
  }
  return seen;
}

const openIds = check(OPEN, 'knowhow/tickets/', 'live', 'open');
const closedIds = check(CLOSED, 'knowhow/tickets/closed/', 'deprecated', 'closed');

// The index must list every ticket, in the right table. An index that disagrees with
// the folder is worse than no index, because it is what people read instead of the folder.
const index = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : '';
// The heading must be EXACTLY "## Open" / "## Closed", optionally with a count. A loose
// `## Open.*` also matches a prose heading like "## Open vs closed", which has no rows.
// A row's first cell is the id, bare or as a link: `| T-002 |` or `| [T-002](tickets/T-002-x.md) |`.
// A count in the heading, if present, must match the rows: "## Open (3)" over four rows
// is the index disagreeing with itself.
const section = (name) => {
  const m = index.match(new RegExp(`^## ${name}(?:\\s*\\((\\d+)\\))?\\s*$([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  if (!m) return null;
  const ids = [...m[2].matchAll(/^\|\s*\[?(T-\d{3})\]?(?:\([^)]*\))?\s*\|/gm)].map(x => x[1]);
  if (m[1] !== undefined && Number(m[1]) !== ids.length) {
    problems.push(`knowhow/tickets-index.md\n      "## ${name} (${m[1]})" but the table has ${ids.length} row(s).`);
  }
  return ids;
};

const inOpen = section('Open');
const inClosed = section('Closed');

if (inOpen === null || inClosed === null) {
  problems.push('knowhow/tickets-index.md\n      needs an "## Open" and a "## Closed" section with one table row per ticket.');
} else {
  for (const [ids, listed, table] of [[openIds, inOpen, 'Open'], [closedIds, inClosed, 'Closed']]) {
    for (const id of ids) if (!listed.includes(id)) problems.push(`knowhow/tickets-index.md\n      ${id} is missing from the "${table}" table.`);
    for (const id of listed) if (!ids.includes(id)) problems.push(`knowhow/tickets-index.md\n      "${table}" lists ${id}, but no such ticket file is in that folder.`);
  }
}

for (const id of openIds) {
  if (closedIds.includes(id)) problems.push(`${id} exists in BOTH knowhow/tickets/ and knowhow/tickets/closed/.`);
}

console.log('Tickets: folder, header, body and index agree');
console.log(`Checked ${openIds.length} open + ${closedIds.length} closed ticket(s)\n`);

if (problems.length) {
  console.error(`✗ ${problems.length} disagreement(s):\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  console.error('Closing a ticket is: git mv into closed/, Status: deprecated, State: closed (date),');
  console.error('and move its row to the Closed table. See knowhow/tickets-index.md.\n');
  process.exit(1);
}

console.log('✓ Every ticket agrees with itself and with the index.');
