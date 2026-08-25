#!/usr/bin/env node
/* Does the visual builder EDIT, per diagram type?
 *
 * Not "does the panel render" - it renders on almost everything, which is the whole complaint.
 * The test is whether pressing its primary action changes the source. A panel that renders six
 * numbered steps and leaves the file untouched is the broken promise, stated as a measurement.
 *
 * This is the input to the gating decision: the Visual mode should only be offered where this
 * comes back true. It is deliberately outside Round 6's V/W/X/Y/Z/AA so it does not duplicate the
 * groundwork running in parallel.
 *
 * Usage: node builder_matrix.js --app <path> [--port 9869]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9869'));

const SOURCES = {
  flowchart:   'flowchart TD\n A[Start] --> B{Check}\n B -->|yes| C[Done]',
  graph:       'graph LR\n A --> B --> C',
  sequence:    'sequenceDiagram\n participant A\n participant B\n A->>B: hello',
  classDiagram:'classDiagram\n class Animal {\n +String name\n }\n Animal <|-- Dog',
  state:       'stateDiagram-v2\n [*] --> Idle\n Idle --> Busy',
  er:          'erDiagram\n CUSTOMER ||--o{ ORDER : places',
  journey:     'journey\n title A day\n section Work\n Email: 3: Me',
  gantt:       'gantt\n title Plan\n dateFormat YYYY-MM-DD\n section S\n One :a1, 2026-01-01, 20d',
  pie:         'pie showData\n "A" : 40\n "B" : 60',
  quadrant:    'quadrantChart\n title Q\n x-axis Low --> High\n y-axis Low --> High\n A: [0.3, 0.6]',
  requirement: 'requirementDiagram\n requirement R {\n id: 1\n text: must\n }',
  gitGraph:    'gitGraph\n commit\n branch dev\n commit',
  c4:          'C4Context\n title C4\n Person(a, "User")',
  mindmap:     'mindmap\n root((Root))\n  A\n  B',
  timeline:    'timeline\n title T\n 2026 : one : two',
  sankey:      'sankey-beta\nA,B,10',
  xychart:     'xychart-beta\n title "X"\n x-axis [a, b]\n bar [10, 20]',
  block:       'block-beta\n columns 2\n A B',
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

  console.log('type          visualBtn  panel  addBtn  EDITS?  toast');
  console.log('-'.repeat(78));
  const rows = [];

  for (const [name, src] of Object.entries(SOURCES)) {
    const got = JSON.parse(await page.evaluate(`(async () => {
      const s = document.querySelector('#source');
      s.value = ${JSON.stringify(src)};
      s.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 3600));

      const vb = document.querySelector('#visualModeButton');
      const vbr = vb ? vb.getBoundingClientRect() : null;
      const visualOffered = !!(vbr && vbr.width > 0 && vbr.height > 0 && !vb.disabled);
      if (vb) { vb.click(); await new Promise(r => setTimeout(r, 1400)); }

      const panel = document.querySelector('#visualModePanel');
      const pr = panel ? panel.getBoundingClientRect() : null;
      const panelVisible = !!(pr && pr.width > 0 && pr.height > 0);

      // the builder's primary action
      const add = document.querySelector('#addVisualNodeButton');
      const ar = add ? add.getBoundingClientRect() : null;
      const addOffered = !!(ar && ar.width > 0 && ar.height > 0 && !add.disabled);

      let edits = null, toast = null;
      if (addOffered) {
        const label = document.querySelector('#visualNodeLabel, #visualNodeText, input[id*="visualNode" i]');
        if (label) { label.value = 'ZZPROBE'; label.dispatchEvent(new Event('input', { bubbles: true })); }
        const before = s.value;
        add.click();
        await new Promise(r => setTimeout(r, 1600));
        edits = s.value !== before;
        const t = document.querySelector('.toast');
        toast = t ? t.textContent.replace(/\\s+/g, ' ').trim().slice(0, 30) : null;
        if (edits) {                       // put it back so the next type starts clean
          s.value = before;
          s.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 1200));
        }
      }
      return JSON.stringify({ visualOffered, panelVisible, addOffered, edits, toast });
    })()`));

    rows.push({ name, ...got });
    console.log(`${name.padEnd(13)} ${String(got.visualOffered).padEnd(9)}  ${String(got.panelVisible).padEnd(5)}  ${String(got.addOffered).padEnd(6)}  ${String(got.edits === null ? '-' : got.edits).padEnd(6)}  ${got.toast ? JSON.stringify(got.toast) : ''}`);
  }

  const real = rows.filter(r => r.edits === true).map(r => r.name);
  const fake = rows.filter(r => r.panelVisible && r.edits !== true).map(r => r.name);
  console.log();
  console.log(`the builder genuinely edits on ${real.length}: ${real.join(', ') || 'none'}`);
  console.log(`the panel is shown but does not edit on ${fake.length}: ${fake.join(', ') || 'none'}`);
  console.log('page errors: ' + (errs.length ? errs.slice(0, 3).join(' // ') : 'none'));
  await browser.close(); server.close();
})();
