#!/usr/bin/env node
/*
 * Does "Rank alignment" change anything?
 *
 * #layoutAlignment is a visible select in the Style card's Auto-layout section, whose heading reads
 * "Control spacing, alignment and connector routing for the active diagram". Source reading says its
 * value never reaches Mermaid: buildMermaidConfig passes routing, density, nodeSpacing and
 * rankSpacing, and not alignment. This proves it at runtime instead of from the source.
 *
 * Method: render a flowchart, record every node's position, switch alignment start -> center -> end,
 * re-render, compare. A control that works moves something.
 *
 * Its sibling #layoutNodeSpacing is driven the same way as a control: if the geometry does not move
 * for it either, the harness is at fault, not the app.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9945'));

const SRC = 'flowchart TD\\n  A[Alpha] --> B[Beta]\\n  A --> C[Gamma]\\n  B --> D[Delta]\\n  C --> D\\n  D --> E[Epsilon]';

/* Two traps, both of which produced a false "it changed" on the first run:
   - node ids carry a render timestamp (t_flow_<ms>_<n>-flowchart-A-0), so any string built
     from the raw id differs on every re-render no matter what moved. Strip the prefix.
   - getBBox() on a g.node is in the group's OWN user space, so a translated node reports the
     same box wherever it sits. Position lives in the transform, not the bbox. Use the screen
     rect, measured relative to the svg's own rect so scroll and zoom cancel out. */
const geometry = `(() => {
  const svg = document.querySelector('#diagram svg');
  if (!svg) return 'no svg';
  const origin = svg.getBoundingClientRect();
  const nodes = Array.from(svg.querySelectorAll('g.node')).map(n => {
    const r = n.getBoundingClientRect();
    const name = (n.id || '').replace(/^t_[a-z]+_\\d+_\\d+-/, '');
    return name + '@' + Math.round(r.left - origin.left) + ',' + Math.round(r.top - origin.top);
  });
  return nodes.sort().join(' | ');
})()`;

const setControl = (id, value) => `(async () => {
  const c = document.querySelector(${JSON.stringify('#' + id)});
  if (!c) return 'absent';
  c.value = ${JSON.stringify(value)};
  c.dispatchEvent(new Event('change', { bubbles: true }));
  const apply = document.querySelector('#applyLayoutButton');
  if (apply) apply.click();
  await new Promise(r => setTimeout(r, 3500));
  return c.value;
})()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => {
    fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])), (e, d) =>
      e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)));
  }).listen(PORT);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(`(async () => {
      for (let i = 0; i < 60; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
      document.querySelectorAll('.tour-card button').forEach(b => { if (/skip|done|got it|close/i.test(b.textContent)) b.click(); });
      document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
      document.body.click();
      const s = document.querySelector('#source');
      s.value = "${SRC}";
      s.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 4000));
      return 1;
    })()`);

    const shots = {};
    for (const v of ['start', 'center', 'end']) {
      const got = await page.evaluate(setControl('layoutAlignment', v));
      shots['alignment=' + v] = { control: got, geom: await page.evaluate(geometry) };
    }
    // control experiment: a sibling that IS wired
    await page.evaluate(setControl('layoutAlignment', 'center'));
    const baseline = await page.evaluate(geometry);
    await page.evaluate(setControl('layoutNodeSpacing', '160'));
    const widened = await page.evaluate(geometry);

    console.log('--- Rank alignment ---');
    const keys = Object.keys(shots);
    keys.forEach(k => console.log(`  ${k.padEnd(18)} control=${shots[k].control}  nodes=${shots[k].geom.slice(0, 90)}...`));
    const allSame = keys.every(k => shots[k].geom === shots[keys[0]].geom);
    console.log(`  geometry identical across start/center/end : ${allSame}`);

    console.log('\n--- Control experiment: node spacing 50 -> 160 ---');
    console.log(`  geometry changed : ${baseline !== widened}`);
    console.log(`  baseline : ${baseline.slice(0, 90)}...`);
    console.log(`  widened  : ${widened.slice(0, 90)}...`);

    console.log('\nVERDICT:');
    if (allSame && baseline !== widened) {
      console.log('  Rank alignment moves nothing, while its sibling moves the drawing.');
      console.log('  The control is visible, settable, persisted, exported - and inert.');
    } else if (!allSame) {
      console.log('  Rank alignment DOES change the drawing. The source reading was wrong.');
    } else {
      console.log('  Neither control moved anything - the harness is not applying settings. Inconclusive.');
    }
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
})();
