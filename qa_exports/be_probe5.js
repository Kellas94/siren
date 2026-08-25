/* JOB BE round 5: the deferred open fires 520ms after the click. Can it land on top of
 * someone who has already moved on and started typing?
 * Usage: node be_probe5.js <appPath> <port> <tag>
 */
const path = require('path'), fs = require('fs'), http = require('http');
const lib = require('./r7_lib.js');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4] || 'x';
const FLOW = ['flowchart TD', '  A[Alpha step] --> B[Bravo step]', '  B --> C[Charlie step]', '  D[Delta step] --> A'].join('\n');
const out = { app: APP, tag: TAG, tests: {}, errors: [] };
async function ev(page, expr) { return JSON.parse(await page.evaluate(`JSON.stringify((() => { ${expr} })())`)); }
async function geomFor(page, id) {
  return ev(page, `
    const m = document.querySelector('#diagram [data-t-workpaper-node="${id}"]');
    const r = m && m.querySelector('rect') ? m.querySelector('rect').getBoundingClientRect() : null;
    const groups = Array.from(document.querySelectorAll('#diagram g.node, #diagram [data-node-id]'));
    let nb = null;
    for (const g of groups) { const gid = g.getAttribute('data-node-id') || g.getAttribute('id') || ''; if (gid === '${id}' || gid.indexOf('-${id}-') >= 0 || gid.endsWith('-${id}')) { nb = g.getBoundingClientRect(); break; } }
    const f = b => b ? { x:+b.x.toFixed(2), y:+b.y.toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2), cx:+(b.x+b.width/2).toFixed(2), cy:+(b.y+b.height/2).toFixed(2) } : null;
    return { rect: f(r), node: f(nb) };
  `);
}
async function makeDocOn(page, id) {
  const g = await geomFor(page, id);
  await page.mouse.click(g.node.cx, g.node.cy); await page.waitForTimeout(900);
  await ev(page, `const d = document.getElementById('nodeDocNewButton'); if (d) { const det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({ block: 'center' }); } return 1;`);
  await page.waitForTimeout(400);
  const b = await ev(page, `const d = document.getElementById('nodeDocNewButton'); const r = d.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, inView: r.top >= 0 && r.bottom <= innerHeight };`);
  if (b && b.w > 2 && b.inView) await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1500);
  return b;
}
async function reset(page, fixture) {
  await page.keyboard.press('Escape'); await page.waitForTimeout(140);
  await ev(page, `
    const inp = document.getElementById('canvasInplace'); if (inp && !inp.hidden) inp.hidden = true;
    if (document.body.classList.contains('connect-mode')) { const cm = document.getElementById('connectModeButton'); if (cm) cm.click(); }
    const wp = document.getElementById('wpWorkspace'); if (wp && !wp.hidden) { const c = document.getElementById('closeWpButton'); if (c) c.click(); }
    const insp = document.getElementById('nodeInspector'); if (insp && !insp.hidden) { const d = document.getElementById('inspectorDoneButton'); if (d) d.click(); }
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
    const menu = document.querySelector('.struct-menu'); if (menu) menu.remove(); return 1;
  `);
  await page.waitForTimeout(250);
  const src = await page.evaluate(`document.getElementById('source').value`);
  if (src.trim() !== fixture.trim()) await lib.setSource(page, fixture, 2600);
  await page.waitForTimeout(500);
}
(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])), (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(lib.SETTLE);
  for (let i = 0; i < 20; i++) {
    const gone = await page.evaluate(`(() => { const c = document.querySelector('.tour-card'); if (!c) return true; const b = Array.from(c.querySelectorAll('button')).find(x=>/skip|done|got it|close|finish/i.test(x.textContent))||c.querySelector('button'); if (b) b.click(); return false; })()`);
    if (gone && i > 6) break; await page.waitForTimeout(180);
  }
  try {
    await lib.setSource(page, FLOW, 3200);
    await makeDocOn(page, 'B');
    await reset(page, FLOW);
    // ---- A: Code mode. Click the marker, then click into the visible code editor and type. ----
    await ev(page, `document.getElementById('codeModeButton')?.click(); return 1;`);
    await page.waitForTimeout(700);
    await ev(page, `document.getElementById('textModeButton')?.click(); return 1;`);
    await page.waitForTimeout(900);
    let before = await page.evaluate(`document.getElementById('source').value`);
    out.sourceBefore = before;
    let g = await geomFor(page, 'B');
    out.geomCodeMode = g;
    const srcBox = await ev(page, `const s = document.getElementById('source'); const r = s.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + Math.min(r.height - 20, 120), w: r.width, h: r.height, visible: r.width > 10 && r.height > 10 };`);
    out.sourceBox = srcBox;
    if (g.rect && srcBox.visible) {
      await page.mouse.click(g.rect.cx, g.rect.cy);
      await page.waitForTimeout(90);
      await page.mouse.click(srcBox.x, srcBox.y);
      await page.keyboard.press('Control+End');
      const focusAtStart = await page.evaluate(`(document.activeElement && document.activeElement.id) || document.activeElement.tagName`);
      const typed = 'E[Typed while it was thinking] --> C';
      await page.keyboard.press('Enter');
      for (const ch of typed) { await page.keyboard.type(ch); await page.waitForTimeout(28); }
      await page.waitForTimeout(1800);
      const after = await page.evaluate(`document.getElementById('source').value`);
      const focusAtEnd = await ev(page, `const a = document.activeElement; return { id: a ? a.id : null, tag: a ? a.tagName : null, inDocs: !!(a && a.closest && a.closest('#wpWorkspace')) };`);
      const docsOpen = await page.evaluate(`!document.getElementById('wpWorkspace').hidden`);
      out.tests.type_into_code_editor = {
        focusAtStart, focusAtEnd, docsOpen,
        typedChars: typed.length + 1,
        landedWhole: after.indexOf(typed) >= 0,
        charsGained: after.length - before.length,
        sourceAfterTail: after.slice(-70).replace(/\n/g, ' | ')
      };
    } else {
      out.tests.type_into_code_editor = { skipped: true, srcBox, marker: !!(g && g.rect) };
    }

    // ---- B: back on the canvas. Select the block, click its marker, then type. ----
    await ev(page, `document.getElementById('visualModeButton')?.click(); return 1;`);
    await page.waitForTimeout(900);
    await reset(page, FLOW);
    before = await page.evaluate(`document.getElementById('source').value`);
    g = await geomFor(page, 'B');
    if (g.rect && g.node) {
      await page.mouse.click(g.node.x + 20, g.node.cy);   // select the block the ordinary way
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');                 // close the inspector, keep the canvas selection
      await page.waitForTimeout(300);
      g = await geomFor(page, 'B');
      await page.mouse.click(g.rect.cx, g.rect.cy);
      const typed = 'Payments reconciliation';
      for (const ch of typed) { await page.keyboard.type(ch); await page.waitForTimeout(30); }
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1800);
      const after = await page.evaluate(`document.getElementById('source').value`);
      const focusAtEnd = await ev(page, `const a = document.activeElement; return { id: a ? a.id : null, tag: a ? a.tagName : null, inDocs: !!(a && a.closest && a.closest('#wpWorkspace')) };`);
      out.tests.type_on_canvas = {
        focusAtEnd, docsOpen: await page.evaluate(`!document.getElementById('wpWorkspace').hidden`),
        typedChars: typed.length, landedWhole: after.indexOf(typed) >= 0,
        sourceChanged: after !== before, sourceAfter: after.replace(/\n/g, ' | ')
      };
    }
    out.errors = errors.slice(0, 20);
  } catch (e) { out.crash = String((e && e.stack) || e).slice(0, 900); out.errors = errors.slice(0, 20); }
  fs.writeFileSync(path.join(__dirname, 'be5_' + TAG + '.json'), JSON.stringify(out, null, 1));
  console.log('done ' + TAG);
  await browser.close(); server.close(); process.exit(0);
})();
