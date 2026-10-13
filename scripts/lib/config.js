// @execution: library  - shared by the checks. No API.
//
// Reads system.config.json, the one place where this skeleton is adapted to a repo.
// Every field is documented in knowhow/configuration.md.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Kept identical to system.config.json as it ships, so a repo that deletes a field
// gets the documented default and not a weaker one.
const DEFAULTS = {
  indexes: ['knowhow/index.md'],
  statuses: ['live', 'draft', 'deprecated'],
  paidApiPatterns: [
    'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
    '@anthropic-ai/sdk', '\\bfrom\\s+anthropic\\b', '\\bimport\\s+anthropic\\b', "require\\(\\s*['\"]anthropic",
    "['\"]openai['\"]", '\\bfrom\\s+openai\\b', '\\bimport\\s+openai\\b',
    'api\\.anthropic\\.com', 'api\\.openai\\.com',
  ],
  automationEntryPoints: [],
  systemMapExemptScripts: {},
  systemMapExemptSubtrees: {},
};

function load() {
  const p = path.join(ROOT, 'system.config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS };
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
}

// Repo-relative path with forward slashes, so Windows and CI report the same thing.
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

// Every file that counts as code. Wider than "the languages this repo uses today" on
// purpose: a check that only sees .js declares the repo clean while a .ts or .sh file
// next to it does whatever it likes.
const CODE_EXT = /\.(js|mjs|cjs|ts|mts|cts|py|sh|ps1)$/;

function codeFiles(...dirs) {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '__pycache__' || e.name === '.venv') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (CODE_EXT.test(e.name)) out.push(p);
    }
  };
  for (const d of dirs) walk(path.join(ROOT, d));
  return out.sort();
}

// The scripts the index must list.
const scriptFiles = () => codeFiles('scripts');

module.exports = { ROOT, load, rel, codeFiles, scriptFiles };
