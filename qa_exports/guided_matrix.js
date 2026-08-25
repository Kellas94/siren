#!/usr/bin/env node
/* Does Guided produce usable rows on every diagram type?
 *
 * This is the fact the short-run Visual Builder decision rests on. If Guided renders real,
 * actionable rows everywhere, then the second editor slot can be "Build" on the types the builder
 * handles and "Guided" on the rest, and nobody ever meets a dead panel. If Guided is empty on the
 * hard types, that plan does not exist.
 *
 * Deliberately NOT the same question as Round 6 Job X, which asks whether the COUNTER is accurate.
 * This asks whether the rows are there and can be acted on at all.
 *
 * Usage: node guided_matrix.js --app <path> [--port 9874]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9874'));

const SOURCES = {
  flowchart:   'flowchart TD\n A[Start] --> B{Check}\n B -->|yes| C[Done]\n B -->|no| A',
  graph:       'graph LR\n A --> B --> C',
  sequence:    'sequenceDiagram\n participant A\n participant B\n A->>B: hello\n B-->>A: hi',
  classDiagram:'classDiagram\n class Animal {\n +String name\n }\n Animal <|-- Dog',
  state:       'stateDiagram-v2\n [*] --> Idle\n Idle --> Busy\n Busy --> [*]',
  er:          'erDiagram\n CUSTOMER ||--o{ ORDER : places',
  journey:     'journey\n title A day\n section Work\n Email: 3: Me',
  gantt:       'gantt\n title Plan\n dateFormat YYYY-MM-DD\n section S\n One :a1, 2026-01-01, 20d\n Two :a2, after a1, 10d',
  pie:         'pie showData\n "A" : 40\n "B" : 60',
  quadrant:    'quadrantChart\n title Q\n x-axis Low --> High\n y-axis Low --> High\n A: [0.3, 0.6]',
  requirement: 'requirementDiagram\n requirement R {\n id: 1\n text: must\n }',
  gitGraph:    'gitGraph\n commit\n branch dev\n commit\n checkout main\n merge dev',
  c4:          'C4Context\n title C4\n Person(a, "User")\n System(b, "System")',
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
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
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

  console.log('type          rows  chips  guided?  counter');
  console.log('-'.repeat(62));
  const summary = [];

  for (const [name, src] of Object.entries(SOURCES)) {
    const got = JSON.parse(await page.evaluate(`(async () => {
      const s = document.querySelector('#source');
      s.value = ${JSON.stringify(src)};
      s.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 3800));

      // Guided is NOT reachable from the builder - it is the second half of the Text/Guided switch
      // inside the CODE editor. A first run skipped this and measured zero rows on all nineteen
      // types, including flowchart, whose counter simultaneously read "3 blocks - 3 connections".
      const codeBtn = document.querySelector('#codeModeButton');
      if (codeBtn) { codeBtn.click(); await new Promise(r => setTimeout(r, 1300)); }
      const g = Array.from(document.querySelectorAll('button')).find(b => /guided/i.test(b.textContent));
      const foundGuided = !!g;
      if (g) { g.click(); await new Promise(r => setTimeout(r, 1800)); }

      const rows = Array.from(document.querySelectorAll('.struct-token, .struct-row, [class*="struct-token"]'));
      const visible = rows.filter(r => { const b = r.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
      const chips = document.querySelectorAll('.struct-token[data-kind], .struct-chip').length;
      const counter = (document.querySelector('#structureCount') || {}).textContent || null;

      // is the builder panel offering itself on this type?
      const vb = document.querySelector('#visualModePanel');
      const vbr = vb ? vb.getBoundingClientRect() : null;

      return JSON.stringify({
        rows: visible.length,
        foundGuided,
        chips,
        counter: counter ? counter.replace(/\\s+/g, ' ').trim().slice(0, 24) : null,
        builderVisible: !!(vbr && vbr.width > 0 && vbr.height > 0)
      });
    })()`));

    summary.push({ name, ...got });
    console.log(`${name.padEnd(13)} ${String(got.rows).padStart(4)} ${String(got.chips).padStart(6)}  ${String(got.foundGuided).padEnd(7)}  ${JSON.stringify(got.counter)}`);
  }

  const dead = summary.filter(r => r.rows === 0);
  console.log();
  console.log(`types where Guided renders NO usable row: ${dead.length}${dead.length ? ' — ' + dead.map(d => d.name).join(', ') : ''}`);
  console.log('page errors: ' + (errs.length ? errs.slice(0, 3).join(' // ') : 'none'));
  await browser.close(); server.close();
})();
