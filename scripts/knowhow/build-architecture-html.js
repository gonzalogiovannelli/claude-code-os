// @execution: on-demand  - runs by hand or from the PostToolUse hook. No API.
//
// Renders knowhow/architecture.md (Mermaid diagrams + prose) into a single
// self-contained knowhow/architecture.html: a sidebar with one entry per ## section,
// and each diagram large, with pan, zoom and fullscreen.
//
// The .md is the source; the .html is a regenerable view, committed so anyone can open
// it without running anything. Never hand-edit the .html.
//
//   node scripts/knowhow/build-architecture-html.js
//   node scripts/knowhow/build-architecture-html.js --hook   (from the PostToolUse hook:
//       reads the tool call on stdin and only rebuilds if architecture.md was the file edited)
//
// The libraries (marked, DOMPurify, mermaid, svg-pan-zoom) load from a CDN, pinned to
// exact versions, so the first open needs internet. Nothing from the repo is sent
// anywhere: the content is embedded in the file.

const fs = require('fs');
const path = require('path');
const { ROOT } = require('../lib/config');

const SRC = path.join(ROOT, 'knowhow', 'architecture.md');
const OUT = path.join(ROOT, 'knowhow', 'architecture.html');

if (process.argv.includes('--hook')) {
  let edited = '';
  try { edited = JSON.parse(fs.readFileSync(0, 'utf8')).tool_input.file_path || ''; } catch { /* not ours */ }
  // Windows paths arrive with either drive-letter case and either slash.
  const norm = (p) => { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };
  if (!edited || norm(edited) !== norm(SRC)) process.exit(0);
}

const md = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const verified = (md.match(/Last verified against code:\s*([0-9-]+)/) || [])[1] || '';
const title = ((md.match(/^#\s+(.+)$/m) || [])[1] || 'System map').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// "</script>" inside the markdown would close the script tag early.
const embedded = JSON.stringify(md).replace(/<\//g, '<\\/');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js"></script>
<style>
  :root { --bg:#f6f7f9; --panel:#ffffff; --ink:#111418; --body:#3b4148; --muted:#6b7280;
          --line:#dfe3e8; --accent:#2f5d8a; --accent-soft:#e8eef5; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0f1216; --panel:#161a20; --ink:#f1f3f5; --body:#c9ced4; --muted:#8b93a0;
            --line:#2a3039; --accent:#7fa8d4; --accent-soft:#1d2733; }
  }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         color: var(--body); background: var(--bg); }
  header { padding: 14px 24px; border-bottom: 1px solid var(--line); background: var(--panel);
           display:flex; justify-content:space-between; align-items:baseline; gap:12px; }
  header .name { color: var(--ink); font-weight: 600; }
  header .date { color: var(--muted); font-size: 13px; }
  .layout { display:flex; align-items:flex-start; }
  nav { width:250px; flex:0 0 250px; position:sticky; top:0; height:100vh; overflow-y:auto;
        padding:20px 12px; border-right:1px solid var(--line); }
  nav a { display:block; padding:7px 10px; border-radius:6px; color:var(--body);
          text-decoration:none; font-size:14px; }
  nav a:hover { background: var(--accent-soft); }
  nav a.active { background: var(--accent); color: var(--panel); }
  main { flex:1; min-width:0; padding: 24px 40px; background: var(--panel); max-width: 1080px; }
  main > div > h1:first-child { display:none; }
  h2 { color: var(--ink); border-bottom:1px solid var(--line); padding-bottom:6px; margin-top:40px; }
  h3 { color: var(--ink); }
  p, li { line-height: 1.6; }
  a { color: var(--accent); }
  table { border-collapse: collapse; width:100%; font-size:14px; }
  th, td { border:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
  code { background: var(--accent-soft); padding:1px 5px; border-radius:4px; font-size:13px; }
  blockquote { border-left:3px solid var(--accent); margin:16px 0; padding:6px 16px; }
  .card { border:1px solid var(--line); border-radius:8px; margin:18px 0; overflow:hidden; background: var(--panel); }
  .bar { display:flex; gap:8px; padding:8px 10px; border-bottom:1px solid var(--line); background: var(--bg); }
  .bar button { background: var(--panel); color: var(--ink); border:1px solid var(--line);
                border-radius:6px; padding:4px 10px; cursor:pointer; font: inherit; font-size:13px; }
  .bar .hint { margin-left:auto; color: var(--muted); font-size:12px; align-self:center; }
  .view { height: 70vh; }
  .view svg { width:100%; height:100%; }
  .card:fullscreen .view { height: calc(100vh - 44px); }
  @media (max-width: 760px) {
    .layout { display:block; }
    nav { position:static; width:auto; height:auto; border-right:none; border-bottom:1px solid var(--line); }
    main { padding: 16px; }
    .bar .hint { display:none; }
  }
</style>
</head>
<body>
<header><span class="name">${esc(title)}</span><span class="date">${verified ? 'Verified ' + verified : ''}</span></header>
<div class="layout">
  <nav id="toc"></nav>
  <main><div id="content"></div></main>
</div>
<script>
  const MD = ${embedded};
  const content = document.getElementById('content');
  // Sanitised: raw HTML in the markdown must not become script in a committed page.
  content.innerHTML = DOMPurify.sanitize(marked.parse(MD.replace(/^---\\n[\\s\\S]*?\\n---\\n/, '')));

  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({ startOnLoad:false, theme: dark ? 'dark' : 'neutral',
                       flowchart: { useMaxWidth:false, htmlLabels:true } });

  (async () => {
    let i = 0;
    for (const code of [...content.querySelectorAll('code.language-mermaid')]) {
      let svg;
      try { ({ svg } = await mermaid.render('mmd-' + (i++), code.textContent)); }
      catch (e) { code.parentElement.textContent = 'Mermaid error: ' + e.message; continue; }
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<div class="bar"><button data-a="in">+</button><button data-a="out">\\u2212</button>'
        + '<button data-a="reset">Reset</button><button data-a="full">Fullscreen</button>'
        + '<span class="hint">drag to pan, scroll to zoom</span></div><div class="view">' + svg + '</div>';
      code.closest('pre').replaceWith(card);
      const el = card.querySelector('svg');
      el.removeAttribute('height'); el.style.maxWidth = 'none';
      const pz = svgPanZoom(el, { fit:true, center:true, minZoom:0.2, maxZoom:12, zoomScaleSensitivity:0.4 });
      const refit = () => { pz.resize(); pz.fit(); pz.center(); };
      card.querySelector('[data-a=in]').onclick = () => pz.zoomBy(1.3);
      card.querySelector('[data-a=out]').onclick = () => pz.zoomBy(0.77);
      card.querySelector('[data-a=reset]').onclick = refit;
      card.querySelector('[data-a=full]').onclick = () =>
        document.fullscreenElement ? document.exitFullscreen() : card.requestFullscreen();
      card.addEventListener('fullscreenchange', () => setTimeout(refit, 80));
    }

    const toc = document.getElementById('toc');
    const heads = [...content.querySelectorAll('h2')];
    heads.forEach((h, n) => {
      h.id = 'sec-' + n;
      const a = document.createElement('a');
      a.href = '#' + h.id; a.textContent = h.textContent;
      toc.appendChild(a);
    });
    const links = [...toc.querySelectorAll('a')];
    const obs = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-8% 0px -82% 0px' });
    heads.forEach(h => obs.observe(h));
  })();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log('Wrote ' + path.relative(ROOT, OUT).split(path.sep).join('/') + ' (' + (html.length / 1024).toFixed(1) + ' KB)');
