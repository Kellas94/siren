/* JOB BH skeptic probe 3 - hunt the over-correction at ORDINARY settings, and the
   stale-inspector hazard a refusal leaves behind.
   node sk_bh_p3.js <appPath> <port> <tag> <scenario> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4], ONLY = process.argv[5];

// An ordinary audit control description written on several lines. Nothing exotic.
const TALL = [
  'flowchart TD',
  '  START[Trial balance received] --> CTRL["Control C-114<br/>Owner: Financial Controller<br/>Frequency: Monthly<br/>Evidence: signed reconciliation<br/>Population: 1,284 journals<br/>Sample: 25 items<br/>Test: agree to source<br/>Exception threshold: 0<br/>Reviewer: Engagement Manager<br/>Status: operating effectively"]',
  '  CTRL --> END[Conclusion reached]'
].join('\n');

const CHAIN = ['flowchart TD'].concat(
  Array.from({ length: 14 }, (_, i) => '  N' + i + '[Step ' + i + ' of 14] --> N' + (i + 1) + '[Step ' + (i + 1) + ' of 14]')
).join('\n');

async function zoomTo(page, clicks) {
  for (let i = 0; i < clicks; i++) {
    await L.realClick(page, '#zoomInButton', 'zoom in');
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(900);
}

async function readZoom(page) {
  return page.evaluate(() => {
    const chip = document.querySelector('.zoom-chip, #zoomLevel, [id*="zoom" i]');
    const txts = Array.from(document.querySelectorAll('button,span')).map(n => (n.textContent || '').trim()).filter(t => /^\d{2,4}\s*%$/.test(t));
    return { pct: txts[0] || null, state: (window.state && window.state.zoom) || null };
  });
}

/* An ordinary tall block at the zoom the app chose for itself. */
async function scenarioTallDefault() {
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1280, height: 860 });
  try {
    await L.setSource(page, TALL, 3600);
    const ok = /Control C-114/.test(await page.$eval('#source', e => e.value));
    const zoom = await readZoom(page);
    const ref = await L.makeReference(page, 'CTRL');
    await L.armObservers(page);
    const before = await L.snapshot(page, 'CTRL');
    await L.clickChip(page);
    await page.waitForTimeout(1500);
    const after = await L.snapshot(page, 'CTRL');
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_tall_' + TAG + '.png' });
    return { fixtureOk: ok, zoom, ref: ref.chip, before, after, errors: errors.slice() };
  } finally { await close(); }
}

/* Same block, but the auditor zoomed in twice to read it - the most ordinary thing there is. */
async function scenarioTallZoomed() {
  const { page, errors, close } = await L.openApp(APP, PORT + 1, { width: 1280, height: 860 });
  try {
    await L.setSource(page, TALL, 3600);
    const ok = /Control C-114/.test(await page.$eval('#source', e => e.value));
    await zoomTo(page, 2);
    const zoom = await readZoom(page);
    const ref = await L.makeReference(page, 'CTRL');
    await L.armObservers(page);
    const before = await L.snapshot(page, 'CTRL');
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    const after = await L.snapshot(page, 'CTRL');
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_tallzoom_' + TAG + '.png' });
    return { fixtureOk: ok, zoom, ref: ref.chip, before, after, errors: errors.slice() };
  } finally { await close(); }
}

/* The hazard a refusal leaves: inspector still describing the OLD block while the
   style target, ring and Build card have already moved to the new one. */
async function scenarioStaleInspector() {
  const { page, errors, close } = await L.openApp(APP, PORT + 2, { width: 1280, height: 860 });
  try {
    await L.setSource(page, TALL, 3600);
    await zoomTo(page, 2);
    // Open the inspector on START by clicking it on the canvas, twice-over: real mouse.
    const startBox = await page.evaluate(() => {
      const svg = document.querySelector('#diagram svg');
      const g = Array.from(svg.querySelectorAll('g.node,g[id]')).find(n => (n.id || '').split('-').includes('START'));
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
    });
    if (startBox && startBox.w > 1) {
      await page.mouse.click(startBox.x, startBox.y);
      await page.waitForTimeout(500);
      await page.mouse.click(startBox.x, startBox.y);
      await page.waitForTimeout(900);
    }
    const primed = await L.snapshot(page, 'START');
    const ref = await L.makeReference(page, 'CTRL');
    await L.armObservers(page);
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    const after = await L.snapshot(page, 'CTRL');
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_stale_' + TAG + '.png' });
    return { startBox, primed, ref: ref.chip, after, errors: errors.slice() };
  } finally { await close(); }
}

/* Their 14-chain at 500%, to reproduce their own reported refusal. */
async function scenarioChainZoom() {
  const { page, errors, close } = await L.openApp(APP, PORT + 3, { width: 1024, height: 700 });
  try {
    await L.setSource(page, CHAIN, 3600);
    await zoomTo(page, 4);
    const zoom = await readZoom(page);
    const ref = await L.makeReference(page, 'N1');
    await L.armObservers(page);
    const before = await L.snapshot(page, 'N1');
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    const after = await L.snapshot(page, 'N1');
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_chain_' + TAG + '.png' });
    return { zoom, ref: ref.chip, before, after, errors: errors.slice() };
  } finally { await close(); }
}

const RUN = { tallDefault: scenarioTallDefault, tallZoomed: scenarioTallZoomed, stale: scenarioStaleInspector, chainZoom: scenarioChainZoom };

(async () => {
  const out = { tag: TAG, app: APP, scenarios: {} };
  for (const [name, fn] of Object.entries(RUN)) {
    if (ONLY && ONLY !== name) continue;
    try { out.scenarios[name] = await fn(); }
    catch (e) { out.scenarios[name] = { ERROR: String(e.message) }; }
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p3_' + TAG + (ONLY ? '_' + ONLY : '') + '.json', JSON.stringify(out, null, 1));
  console.log('WROTE skbh_p3_' + TAG + (ONLY ? '_' + ONLY : '') + '.json');
})();
