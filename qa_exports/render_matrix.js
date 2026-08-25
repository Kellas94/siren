#!/usr/bin/env node
/* Render every diagram type and report what came out, so two builds can be diffed.
 *
 * Swapping the renderer is the largest possible change to this file: every type, every export and
 * every theme is drawn by it. A syntax gate proves the file parses; it proves nothing about whether
 * a gantt still draws. Run this on both builds and compare the two outputs line by line.
 *
 * Usage: node render_matrix.js --app <path> [--port 9884]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9884'));

const SOURCES = {
  flowchart:   'flowchart TD\n A["Ședință"] --> B{Check}\n B -->|yes| C[Done]\n B -->|no| A',
  graph:       'graph LR\n A --> B --> C',
  sequence:    'sequenceDiagram\n participant A\n participant B\n A->>B: hello\n B-->>A: hi',
  classDiagram:'classDiagram\n class Animal {\n +String name\n +eat()\n }\n Animal <|-- Dog',
  state:       'stateDiagram-v2\n [*] --> Idle\n Idle --> Busy\n Busy --> [*]',
  er:          'erDiagram\n CUSTOMER ||--o{ ORDER : places',
  journey:     'journey\n title A day\n section Work\n Email: 3: Me',
  gantt:       'gantt\n title Plan\n dateFormat YYYY-MM-DD\n section S\n One :a1, 2026-01-01, 20d\n Two :a2, after a1, 10d',
  pie:         'pie showData\n "A" : 40\n "B" : 60',
  quadrant:    'quadrantChart\n title Q\n x-axis Low --> High\n y-axis Low --> High\n A: [0.3, 0.6]',
  requirement: 'requirementDiagram\n requirement R {\n id: 1\n text: must\n }',
  gitGraph:    'gitGraph\n commit\n branch dev\n commit\n checkout main\n merge dev',
  c4:          'C4Context\n title C4\n Person(a, "User")',
  mindmap:     'mindmap\n root((Root))\n  A\n   A1\n  B',
  timeline:    'timeline\n title T\n 2026 : one : two',
  sankey:      'sankey-beta\nA,B,10',
  xychart:     'xychart-beta\n title "X"\n x-axis [a, b]\n bar [10, 20]',
  block:       'block-beta\n columns 2\n A B\n C D',
  kanban:      'kanban\n Todo\n  t1[Task one]\n Doing\n  t2[Task two]'
};

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 100)));
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(`(async () => {
    for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
    for (let p = 0; p < 12; p++) {
      const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
      if (!b) break; b.click(); await new Promise(r => setTimeout(r, 200));
    }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
    document.body.click(); await new Promise(r => setTimeout(r, 900)); return 1;
  })()`);

  const ver = await page.evaluate(`(() => (window.mermaid && window.mermaid.version) ? String(window.mermaid.version) : 'unknown')()`);
  console.log('mermaid reports version: ' + ver);
  console.log();
  console.log('type          drew  elements  paths  texts  err');
  console.log('-'.repeat(56));

  for (const [name, src] of Object.entries(SOURCES)) {
    await page.evaluate(`(async () => {
      const s = document.querySelector('#source');
      s.value = ${JSON.stringify(src)};
      s.dispatchEvent(new Event('input', { bubbles: true }));
      return 1;
    })()`);
    const got = JSON.parse(await page.evaluate(`(async () => {
      await new Promise(r => setTimeout(r, 3500));
      const svg = document.querySelector('#diagram svg');
      if (!svg) return JSON.stringify({ drew: false });
      return JSON.stringify({
        drew: true,
        elements: svg.querySelectorAll('*').length,
        paths: svg.querySelectorAll('path').length,
        texts: svg.querySelectorAll('text, foreignObject').length,
        err: !!document.querySelector('#diagram .error, #diagram [id*="error"]')
      });
    })()`));
    console.log(`${name.padEnd(13)} ${String(got.drew).padEnd(5)} ${String(got.elements ?? '-').padStart(8)} ${String(got.paths ?? '-').padStart(6)} ${String(got.texts ?? '-').padStart(6)}  ${got.err ? 'ERR' : ''}`);
  }

  console.log();
  console.log('page errors: ' + (errs.length ? errs.slice(0, 4).join(' // ') : 'none'));
  await browser.close(); server.close();
})();
