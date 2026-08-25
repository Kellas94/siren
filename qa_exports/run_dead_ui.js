#!/usr/bin/env node
/*
 * Dead-UI sweep.
 *
 * Question: which elements in this file can a person never see, in any state?
 *
 * A static scan of the markup finds 136 elements authored with `hidden`. Almost all of them are
 * alive - dialogs, menus and panels are authored hidden and shown on demand. The static list is a
 * candidate list, not a finding. This walks the app through many states and records, for every
 * candidate, whether it was ever visible in any of them.
 *
 * A candidate never seen in any state is still not PROOF of impossibility - only proof that these
 * states do not reach it. The report says which states were tried, so the claim can be checked.
 *
 * Usage: node run_dead_ui.js --app <path> [--port 9942] [--output <dir>]
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
const PW = 'file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/';
const { chromium } = createRequire(PW)('playwright');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app');
const PORT = Number(arg('port', '9942'));
const OUT = arg('output', path.join(process.cwd(), 'dead_ui_out'));
if (!APP || !fs.existsSync(APP)) { console.error('--app must exist'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

// ---- the 19 diagram types this app renders -------------------------------
const SOURCES = {
  flowchart: 'flowchart TD\n A[Start] --> B{Check}\n B -->|yes| C[Done]\n B -->|no| A',
  graph: 'graph LR\n A --> B --> C',
  sequence: 'sequenceDiagram\n participant A\n participant B\n A->>B: hello\n B-->>A: hi',
  classDiagram: 'classDiagram\n class Animal {\n +String name\n +eat()\n }\n Animal <|-- Dog',
  state: 'stateDiagram-v2\n [*] --> Idle\n Idle --> Busy\n Busy --> [*]',
  er: 'erDiagram\n CUSTOMER ||--o{ ORDER : places',
  journey: 'journey\n title A day\n section Work\n Email: 3: Me',
  gantt: 'gantt\n title Plan\n dateFormat YYYY-MM-DD\n section S\n Task :a1, 2026-01-01, 20d',
  pie: 'pie showData\n "A" : 40\n "B" : 60',
  quadrant: 'quadrantChart\n title Q\n x-axis Low --> High\n y-axis Low --> High\n A: [0.3, 0.6]',
  requirement: 'requirementDiagram\n requirement R {\n id: 1\n text: must\n }',
  gitGraph: 'gitGraph\n commit\n branch dev\n commit',
  c4: 'C4Context\n title C4\n Person(a, "User")',
  mindmap: 'mindmap\n root((Root))\n  A\n  B',
  timeline: 'timeline\n title T\n 2026 : one : two',
  sankey: 'sankey-beta\nA,B,10',
  xychart: 'xychart-beta\n title "X"\n x-axis [a, b]\n bar [10, 20]',
  block: 'block-beta\n columns 2\n A B',
  kanban: 'kanban\n Todo\n  t1[Task one]\n Doing\n  t2[Task two]'
};

const SETTLE = `(async () => {
  for (let i = 0; i < 60; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  document.querySelectorAll('.tour-card button').forEach(b => { if (/skip|done|got it|close/i.test(b.textContent)) b.click(); });
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  document.body.click(); return 1;
})()`;

// Visibility as a person experiences it: it occupies space and is not painted out.
const MEASURE = `(() => {
  const out = {};
  document.querySelectorAll('[id]').forEach(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible = r.width > 0 && r.height > 0 &&
      cs.display !== 'none' && cs.visibility !== 'hidden' &&
      Number(cs.opacity) > 0.01;
    if (visible) out[el.id] = Math.round(r.width) + 'x' + Math.round(r.height);
  });
  return JSON.stringify(out);
})()`;

const clickIf = sel => `(async () => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'absent';
  try { el.click(); } catch (e) { return 'threw'; }
  await new Promise(r => setTimeout(r, 900));
  return 'clicked';
})()`;

const setSource = src => `(async () => {
  const s = document.querySelector('#source');
  if (!s) return 'no #source';
  s.value = ${JSON.stringify('')};
  s.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  s.value = ${JSON.stringify(src)};
  s.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 3500));
  return 'set';
})()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200), res.end(d)));
  }).listen(PORT);

  const browser = await chromium.launch();
  const seen = {};            // id -> first state that showed it, and its size
  const statesTried = [];
  let page, ctx;

  const record = async (label) => {
    statesTried.push(label);
    const vis = JSON.parse(await page.evaluate(MEASURE));
    let fresh = 0;
    for (const [id, size] of Object.entries(vis)) {
      if (!seen[id]) { seen[id] = { state: label, size }; fresh++; }
    }
    console.log(`  [${String(statesTried.length).padStart(2)}] ${label.padEnd(34)} visible=${String(Object.keys(vis).length).padStart(4)}  new=${fresh}`);
  };

  try {
    ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(SETTLE);
    await record('boot (default diagram)');

    // every diagram type
    for (const [name, src] of Object.entries(SOURCES)) {
      await page.evaluate(setSource(src));
      await record('type:' + name);
    }

    // every editor mode, on a flowchart (the type with the most live UI)
    await page.evaluate(setSource(SOURCES.flowchart));
    for (const id of ['#textModeButton', '#codeModeButton', '#structureModeButton', '#visualModeButton']) {
      await page.evaluate(clickIf(id));
      await record('mode:' + id.replace('#', ''));
    }

    // panels, dialogs and menus reachable from the top bar
    const OPENERS = ['#exportButton', '#themeButton', '#guideButton', '#versionsButton',
      '#importButton', '#workpapersButton', '#presentButton', '#findReplaceButton',
      '#settingsButton', '#helpButton', '#diagramTabsOverflowButton'];
    for (const id of OPENERS) {
      const r = await page.evaluate(clickIf(id));
      await record('open:' + id.replace('#', '') + (r === 'absent' ? ' (absent)' : ''));
      await page.evaluate(`(async () => { document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} }); await new Promise(r => setTimeout(r, 400)); return 1; })()`);
    }

    // every theme, because 27 of the candidates are per-theme intro overlays
    const themes = JSON.parse(await page.evaluate(`(() => {
      const out = [];
      document.querySelectorAll('[data-theme], [data-theme-id], option').forEach(el => {
        const v = el.getAttribute('data-theme') || el.getAttribute('data-theme-id') || (el.tagName === 'OPTION' ? el.value : null);
        if (v && !out.includes(v)) out.push(v);
      });
      return JSON.stringify(out.slice(0, 40));
    })()`));
    console.log('  themes discovered: ' + themes.length);
    for (const t of themes) {
      await page.evaluate(`(async () => {
        const cand = Array.from(document.querySelectorAll('[data-theme], [data-theme-id]'))
          .find(e => (e.getAttribute('data-theme') || e.getAttribute('data-theme-id')) === ${JSON.stringify(t)});
        if (cand) { try { cand.click(); } catch (e) {} }
        await new Promise(r => setTimeout(r, 700));
        return 1;
      })()`);
      await record('theme:' + t);
    }

    await ctx.close();

    // narrow and tablet widths, fresh contexts so load-time gates re-run
    for (const [label, w, h] of [['phone 375', 375, 812], ['tablet 768', 768, 1024]]) {
      ctx = await browser.newContext({ viewport: { width: w, height: h } });
      page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(SETTLE);
      await record('width:' + label);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  // ---- which authored-hidden ids were never seen? -------------------------
  const html = fs.readFileSync(APP, 'utf8');
  const candidates = [];
  const re = /<[a-zA-Z][^>]*\bid=["']([^"']+)["'][^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (/\shidden[\s>=]/.test(tag) && !candidates.includes(m[1])) candidates.push(m[1]);
  }
  const neverSeen = candidates.filter(id => !seen[id]);

  const report = {
    app: APP,
    statesTried,
    candidatesAuthoredHidden: candidates.length,
    everVisible: candidates.length - neverSeen.length,
    neverVisible: neverSeen,
    firstSightings: seen
  };
  fs.writeFileSync(path.join(OUT, 'dead_ui.json'), JSON.stringify(report, null, 1));
  console.log(`\nStates tried            : ${statesTried.length}`);
  console.log(`Authored-hidden ids     : ${candidates.length}`);
  console.log(`  became visible        : ${candidates.length - neverSeen.length}`);
  console.log(`  never visible         : ${neverSeen.length}`);
  console.log('\nNever visible in any state tried:');
  neverSeen.forEach(id => console.log('  #' + id));
  console.log('\nReport: ' + path.join(OUT, 'dead_ui.json'));
})();
