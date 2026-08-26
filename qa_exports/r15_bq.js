#!/usr/bin/env node
/* ITEM BQ - jumping from a Docs reference to a block that cannot be seen.
 *
 * Everything below is driven through the real UI: the block is clicked in the drawing to open
 * the inspector, the owner is typed, the filter checkbox is clicked with a real mouse, the
 * reference is added with the real Add button and the jump is a real click on the chip.
 * The only thing evaluate() does is READ, plus one deliberate reset of the toast text so that a
 * message left over from an earlier step can never be mistaken for the message under test.
 *
 * Same script, same cases, both builds.
 */
const fs = require('fs');
const { openBuild, killTour, setSource, clickSel, clickText, CLEAR_TOAST, READ_TOAST } = require('./r15lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round15/app.html');
const PORT = Number(arg('port', '9642'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/r15_bq_out.json');
const SHOTDIR = arg('shots', 'C:/Claude/SIREN/qa_exports');
const TAG = arg('tag', 'x');

function chain(n, prefix = 'N') {
  const lines = ['flowchart TD'];
  for (let i = 1; i < n; i++) lines.push('  ' + prefix + i + '[Step ' + i + '] --> ' + prefix + (i + 1) + '[Step ' + (i + 1) + ']');
  return lines.join('\n');
}
function wideChain(n) {
  const lines = ['flowchart LR'];
  for (let i = 1; i < n; i++) lines.push('  N' + i + '[Step ' + i + '] --> N' + (i + 1) + '[Step ' + (i + 1) + ']');
  return lines.join('\n');
}

const NODE_RECT = id => `(() => {
  const g = Array.from(document.querySelectorAll('#diagram svg g.node'))
    .find(n => new RegExp('-' + ${JSON.stringify(id)} + '-\\\\d+$').test(n.id || '') || (n.id || '').indexOf('-' + ${JSON.stringify(id)} + '-') >= 0);
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return { id: g.id, x: r.left, y: r.top, w: r.width, h: r.height,
           display: g.getAttribute('display') || '', filtered: g.getAttribute('data-t-filtered') || '' };
})()`;

const MEASURE = id => `(() => {
  const insp = document.getElementById('nodeInspector');
  const zv = document.getElementById('zoomViewport');
  const pane = document.getElementById('previewPane');
  const ir = insp ? insp.getBoundingClientRect() : null;
  const vr = zv ? zv.getBoundingClientRect() : null;
  const g = Array.from(document.querySelectorAll('#diagram svg g.node'))
    .find(n => (n.id || '').indexOf('-' + ${JSON.stringify(id)} + '-') >= 0);
  const br = g ? g.getBoundingClientRect() : null;
  let residual = null;
  if (br && vr && br.width && vr.width) residual = {
    dx: Math.round((br.left + br.width / 2) - (vr.left + vr.width / 2)),
    dy: Math.round((br.top + br.height / 2) - (vr.top + vr.height / 2))
  };
  return {
    inspectorHidden: insp ? insp.hidden : null,
    inspectorHeading: (document.getElementById('nodeInspectorHeading') || {}).textContent || '',
    inspectorRect: ir ? { x: Math.round(ir.x), y: Math.round(ir.y), w: Math.round(ir.width), h: Math.round(ir.height) } : null,
    inspectorOnScreen: ir ? (ir.width > 4 && ir.height > 4 && ir.right > 0 && ir.bottom > 0
                             && ir.left < innerWidth && ir.top < innerHeight) : null,
    inspectorLabelField: (document.getElementById('inspectorBlockLabel') || {}).value,
    paneDisplay: pane ? getComputedStyle(pane).display : null,
    scrollTop: zv ? zv.scrollTop : null,
    scrollHeight: zv ? zv.scrollHeight : null,
    scrollLeft: zv ? zv.scrollLeft : null,
    scrollWidth: zv ? zv.scrollWidth : null,
    viewportRect: vr ? { w: Math.round(vr.width), h: Math.round(vr.height) } : null,
    blockRect: br ? { w: Math.round(br.width), h: Math.round(br.height) } : null,
    residual,
    docsOpen: !document.getElementById('wpWorkspace').hidden
  };
})()`;

async function typeInto(page, sel, text) {
  const ok = await clickSel(page, sel);
  if (!ok) return false;
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text, { delay: 12 });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  return true;
}

async function makeDoc(page) {
  await clickSel(page, '#workpapersButton');
  await page.waitForTimeout(700);
  const which = await page.evaluate(`(() => {
    const e = document.getElementById('wpEmptyNewButton'), b = document.getElementById('wpNewButton');
    if (e && e.getBoundingClientRect().width > 1) return '#wpEmptyNewButton';
    if (b && b.getBoundingClientRect().width > 1) return '#wpNewButton';
    return null;
  })()`);
  if (!which) return 'no new-document button';
  await clickSel(page, which);
  await page.waitForTimeout(500);
  const items = await page.evaluate(`(() => Array.from(document.querySelectorAll('[role="menu"] button, [role="menuitem"]'))
    .filter(b => b.getBoundingClientRect().width > 1).map(b => (b.textContent || '').trim()))()`);
  if (!items.length) return 'no type menu';
  await clickText(page, '[role="menu"] button, [role="menuitem"]', items[0].replace(/[^A-Za-z ]/g, '').trim().slice(0, 10));
  await page.waitForTimeout(700);
  return 'created: ' + items[0];
}

async function addReference(page, nodeId) {
  const diagOptions = await page.evaluate("Array.from(document.getElementById('wpLinkDiagram').options).map(o => o.value)");
  if (!diagOptions.length) return 'no diagram options';
  await page.selectOption('#wpLinkKind', 'diagram').catch(() => {});
  await page.waitForTimeout(250);
  await page.selectOption('#wpLinkDiagram', diagOptions[0]).catch(() => {});
  await page.waitForTimeout(350);
  const nodeOptions = await page.evaluate("Array.from(document.getElementById('wpLinkNode').options).map(o => o.value)");
  if (!nodeOptions.includes(nodeId)) return 'node not offered; options=' + JSON.stringify(nodeOptions.slice(0, 10));
  await page.selectOption('#wpLinkNode', nodeId);
  await page.waitForTimeout(250);
  const clicked = await clickSel(page, '#wpAddLinkButton');
  await page.waitForTimeout(700);
  const chips = await page.evaluate(`(() => Array.from(document.querySelectorAll('#wpLinkChips .wp-chip-open')).map(b => (b.textContent||'').trim()))()`);
  return (clicked ? 'added' : 'add button not clickable') + ' | chips=' + JSON.stringify(chips);
}

async function applyHideFilter(page, blockToOwn, owner) {
  const rect = await page.evaluate(NODE_RECT(blockToOwn));
  if (!rect) return 'block ' + blockToOwn + ' not in drawing';
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2);
  await page.waitForTimeout(600);
  if (await page.evaluate("document.getElementById('nodeInspector').hidden")) return 'inspector did not open';
  if (!await typeInto(page, '#metadataOwner', owner)) return 'owner field not reachable';
  await clickSel(page, '#closeNodeInspectorButton');
  await page.waitForTimeout(400);
  if (!await clickSel(page, '#filterButton')) return 'filter button not clickable';
  await page.waitForTimeout(450);
  await page.selectOption('#filterModeSelect', 'hide');
  await page.waitForTimeout(900);
  const box = await page.evaluate(`(() => {
    const row = Array.from(document.querySelectorAll('#filterPanelBody .filter-option'))
      .find(r => (r.textContent || '').indexOf(${JSON.stringify(owner)}) >= 0);
    if (!row) return null;
    const b = row.querySelector('input[type="checkbox"]');
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: (row.textContent || '').trim() };
  })()`);
  if (!box) return 'no filter option for ' + owner;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1400);
  await clickSel(page, '#closeFilterPanelButton');
  await page.waitForTimeout(600);
  return 'filtered on ' + box.label;
}

const CASES = [
  { name: 'A-filters-hide-1440', vp: { width: 1440, height: 900 }, src: chain(10), target: 'N5', filter: { own: 'N1', owner: 'Alice' } },
  { name: 'B-width-900', vp: { width: 900, height: 900 }, src: chain(61), target: 'N60' },
  { name: 'C-width-820', vp: { width: 820, height: 900 }, src: chain(61), target: 'N60' },
  { name: 'D-width-760', vp: { width: 760, height: 900 }, src: chain(61), target: 'N60' },
  { name: 'E-width-700', vp: { width: 700, height: 900 }, src: chain(61), target: 'N60' },
  // Sideways - the fix must not have cost the reachable case anything.
  { name: 'F-reachable-1440', vp: { width: 1440, height: 900 }, src: chain(61), target: 'N40' },
  { name: 'G-reachable-zoom300', vp: { width: 1440, height: 900 }, src: chain(61), target: 'N40', zoom: 300 },
  { name: 'H-far-right-wide', vp: { width: 1440, height: 900 }, src: wideChain(45), target: 'N42' },
  { name: 'I-block-wider-than-pane', vp: { width: 1440, height: 900 },
    src: 'flowchart TD\n  A[' + 'A very long block label that is far wider than the preview pane can ever show at once '.repeat(3) + '] --> B[Second]\n  B --> C[Third]',
    target: 'A' },
  { name: 'J-filters-hide-700', vp: { width: 700, height: 900 }, src: chain(10), target: 'N5', filter: { own: 'N1', owner: 'Alice' }, filterFirstAt: { width: 1440, height: 900 } }
];

(async () => {
  const build = await openBuild(APP, PORT);
  const out = { app: APP, tag: TAG, cases: [] };

  for (const c of CASES) {
    const rec = { name: c.name, viewport: c.vp };
    const startVp = c.filterFirstAt || c.vp;
    const h = await build.page(startVp);
    const page = h.page;
    try {
      await killTour(page);
      await setSource(page, c.src, 3200);
      rec.nodesDrawn = await page.evaluate("document.querySelectorAll('#diagram svg g.node').length");
      if (c.zoom) {
        await clickSel(page, '#zoomMenuButton');
        await page.waitForTimeout(400);
        for (let i = 0; i < 40; i++) {
          const now = Number(String(await page.evaluate("(document.getElementById('zoomValue')||{}).textContent || '0'")).replace(/[^0-9.]/g, ''));
          if (now >= c.zoom) break;
          if (!await clickSel(page, '#zoomInButton', { settle: 120 })) break;
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(900);
        rec.zoomApplied = await page.evaluate("(document.getElementById('zoomValue')||{}).textContent");
      }
      if (c.filter) rec.filterStep = await applyHideFilter(page, c.filter.own, c.filter.owner);
      if (c.filterFirstAt) { await page.setViewportSize(c.vp); await page.waitForTimeout(1600); }
      rec.targetBefore = await page.evaluate(NODE_RECT(c.target));
      rec.docStep = await makeDoc(page);
      rec.refStep = await addReference(page, c.target);
      rec.scrollBefore = await page.evaluate("(() => { const z = document.getElementById('zoomViewport'); return z ? { top: z.scrollTop, height: z.scrollHeight } : null; })()");
      await page.evaluate(CLEAR_TOAST);
      const jumped = await clickSel(page, '#wpLinkChips .wp-chip-open', { settle: 1800 });
      rec.chipClicked = jumped;
      await page.waitForTimeout(1400);
      rec.toast = await page.evaluate(READ_TOAST);
      rec.after = await page.evaluate(MEASURE(c.target));
      await page.screenshot({ path: SHOTDIR + '/r15_bq_' + TAG + '_' + c.name + '.png' });
    } catch (e) { rec.threw = String(e.message).slice(0, 240); }
    rec.errors = h.errors.slice(0, 6);
    await h.close();
    console.log(c.name + ' -> ' + JSON.stringify({ toast: rec.toast, inspectorHidden: rec.after && rec.after.inspectorHidden,
      heading: rec.after && rec.after.inspectorHeading, residual: rec.after && rec.after.residual,
      scrollTop: rec.after && rec.after.scrollTop, pane: rec.after && rec.after.paneDisplay,
      filterStep: rec.filterStep, refStep: rec.refStep, threw: rec.threw }));
    out.cases.push(rec);
  }

  await build.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('written ' + OUT);
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(1); });
