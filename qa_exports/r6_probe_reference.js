#!/usr/bin/env node
/* ===========================================================================================
 * ROUND 6 — REFERENCE PROBE.  Copy this file, change the MEASURE block, keep everything else.
 *
 * This measures Job V: does every diagram type get titled "Flowchart Preview"?
 *
 * It exists so you do not have to design a probe for this application. Everything outside the
 * MEASURE block below is boilerplate that took several wrong attempts to get right. Do not
 * rewrite it. Copy the file, rename it, and edit only the two marked places.
 *
 * RUN IT:
 *     cd C:\Claude\SIREN
 *     node qa_exports\r6_probe_reference.js --app C:\Claude\SIREN\codex\FROZEN_R6_BASE.html --port 9970
 *
 * Use a DIFFERENT --port for every probe you write, or two probes running at once will collide.
 * =========================================================================================== */

const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9970'));
if (!APP || !fs.existsSync(APP)) { console.error('--app must point at an existing file'); process.exit(2); }

/* ---------------------------------------------------------------------------------------------
 * The nineteen diagram types, as Mermaid source. Use these exact strings so every probe in this
 * round is measuring the same thing. Delete the ones a given job does not need.
 * ------------------------------------------------------------------------------------------- */
const SOURCES = {
  flowchart:   'flowchart TD\n  A[Start] --> B{Check}\n  B -->|yes| C[Done]\n  B -->|no| A',
  graph:       'graph LR\n  A --> B --> C',
  sequence:    'sequenceDiagram\n  participant A\n  participant B\n  A->>B: hello\n  B-->>A: hi',
  classDiagram:'classDiagram\n  class Animal {\n +String name\n +eat()\n }\n  Animal <|-- Dog',
  state:       'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy\n  Busy --> [*]',
  er:          'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
  journey:     'journey\n  title A day\n  section Work\n  Email: 3: Me',
  gantt:       'gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section S\n  One :a1, 2026-01-01, 20d\n  Two :a2, after a1, 10d',
  pie:         'pie showData\n  "A" : 40\n  "B" : 60',
  quadrant:    'quadrantChart\n  title Q\n  x-axis Low --> High\n  y-axis Low --> High\n  A: [0.3, 0.6]',
  requirement: 'requirementDiagram\n  requirement R {\n id: 1\n text: must\n }',
  gitGraph:    'gitGraph\n  commit\n  branch dev\n  commit\n  checkout main\n  merge dev',
  c4:          'C4Context\n  title C4\n  Person(a, "User")',
  mindmap:     'mindmap\n  root((Root))\n    A\n      A1\n    B',
  timeline:    'timeline\n  title T\n  2026 : one : two',
  sankey:      'sankey-beta\nA,B,10',
  xychart:     'xychart-beta\n  title "X"\n  x-axis [a, b]\n  bar [10, 20]',
  block:       'block-beta\n  columns 2\n  A B\n  C D\n  E F',
  kanban:      'kanban\n  Todo\n    t1[Task one]\n  Doing\n    t2[Task two]'
};

/* ---------------------------------------------------------------------------------------------
 * BOILERPLATE — do not edit.
 *
 * settle()  waits for the first render, then dismisses the welcome tour. The tour matters: it
 *           holds keyboard focus on its own button, which silently breaks any focus assertion.
 *           "Next" does not match skip/done/close, so it must be clicked repeatedly.
 * load()    swaps the diagram source and waits for the re-render. 3500 ms is not generous; a
 *           gantt or a git graph can take most of it. Do not lower it.
 * ------------------------------------------------------------------------------------------- */
const SETTLE = `(async () => {
  for (let i = 0; i < 80; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let p = 0; p < 12; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button'))
      .find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) break;
    b.click(); await new Promise(r => setTimeout(r, 220));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  document.body.click();
  await new Promise(r => setTimeout(r, 800));
  return 'ready';
})()`;

const load = src => `(async () => {
  const s = document.querySelector('#source');
  if (!s) return 'no #source';
  s.value = ${JSON.stringify(src)};
  s.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 3500));
  return 'loaded';
})()`;

/* =============================================================================================
 * EDIT POINT 1 of 2 — THE MEASUREMENT.
 *
 * This runs in the page after each diagram type is loaded. Return a JSON string.
 * Return FACTS, not conclusions: return the text you found, not "the title is wrong".
 *
 * Rules that have caught real mistakes in this app:
 *   - Never build a comparison out of a raw SVG node id. Ids carry a render timestamp
 *     (t_flow_1787588656142_5-...), so they differ after every render and everything looks changed.
 *   - getBBox() on an SVG group is in LOCAL coordinates. A node that moved reports the same box.
 *     Use getBoundingClientRect().
 *   - If you walk text nodes, reject SCRIPT and STYLE parents. This app is one inline <script>,
 *     so a text walk otherwise "finds" any sentence in its own source code.
 *   - A control inside a closed <details> can report a non-zero size and still be unreachable:
 *     it cannot be focused or scrolled to. Check for a closed DETAILS ancestor.
 * =========================================================================================== */
const MEASURE = `(() => {
  const read = sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      text: (el.value !== undefined ? el.value : el.textContent || '').replace(/\\s+/g, ' ').trim(),
      w: Math.round(r.width), h: Math.round(r.height),
      onScreen: r.width > 0 && r.height > 0
    };
  };
  return JSON.stringify({
    previewTitle: read('#diagramTitlePreview'),
    previewHeading: read('#previewHeading'),
    titleField: read('#diagramTitle')
  });
})()`;

/* ---------------------------------------------------------------------------------------------
 * BOILERPLATE — do not edit.
 * ------------------------------------------------------------------------------------------- */
(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const rows = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(SETTLE);

    for (const [type, src] of Object.entries(SOURCES)) {
      await page.evaluate(load(src));
      const got = JSON.parse(await page.evaluate(MEASURE));
      rows.push({ type, ...got });

      /* =====================================================================================
       * EDIT POINT 2 of 2 — ONE LINE PER TYPE, so the output is readable at a glance.
       * =================================================================================== */
      console.log(
        type.padEnd(13),
        'preview=' + JSON.stringify((got.previewTitle || {}).text || '(absent)').padEnd(22),
        'heading=' + JSON.stringify((got.previewHeading || {}).text || '(absent)').padEnd(22),
        'titleField=' + JSON.stringify((got.titleField || {}).text || '(absent)')
      );
    }
    if (errs.length) console.log('\nPAGE ERRORS (report these, they are findings):\n  ' + errs.join('\n  '));
    await ctx.close();
  } finally { await browser.close(); server.close(); }

  const out = path.join(path.dirname(APP), 'r6_probe_reference_result.json');
  fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log('\nRaw result written to ' + out);
  console.log('Put the NUMBERS from this run into "What is true now". Do not paraphrase them.');
})();
