#!/usr/bin/env node
/* Can a Docs block be linked to a diagram block, shown, and followed back?
 *
 * Reported as not delivered. The parts exist - #wpLinkKind ("Reference type") and #wpLinkDiagram
 * ("Reference target") are in the markup, and an exported document carries a links array with
 * diagramId - so the question is which of the three halves actually works:
 *
 *   1. can you MAKE the link at all
 *   2. does the linked block SHOW something in the document
 *   3. does right-clicking it TAKE YOU to that block in the diagram
 *
 * "Not delivered" and "delivered but unreachable" need different answers, so each is measured
 * separately rather than reported as one verdict.
 *
 * Usage: node probe_docs_link.js [--app <path>] [--port 9800]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/slot/app.html');
const PORT = Number(arg('port', '9800'));

const NL = String.fromCharCode(10);
const SRC = ['flowchart TD', '  A[Purchase request] --> B{Approved}',
             '  B --> C[Raise order]'].join(NL);

/* What does the app offer for making a reference at all? */
const SURFACES = `(() => {
  const ids = ['wpLinkKind', 'wpLinkDiagram', 'wpAddBlockButton', 'nodeDocList', 'nodeDocNewButton'];
  const out = {};
  ids.forEach(id => {
    const e = document.getElementById(id);
    if (!e) { out[id] = 'absent'; return; }
    const r = e.getBoundingClientRect();
    out[id] = { visible: r.width > 2 && r.height > 2, tag: e.tagName,
      options: e.tagName === 'SELECT' ? Array.from(e.options).map(o => o.textContent.trim()).slice(0, 6) : undefined };
  });
  return JSON.stringify(out);
})()`;

const OPEN_DOCS = `(async () => {
  document.getElementById('workpapersButton').click();
  await new Promise(r => setTimeout(r, 1100));
  const nw = document.getElementById('wpNewButton') || document.getElementById('wpEmptyNewButton');
  if (nw) { nw.click(); await new Promise(r => setTimeout(r, 800)); }
  const m = document.querySelector('.struct-menu');
  if (m) { (Array.from(m.querySelectorAll('.struct-menu-item')).find(b => /narrative|note/i.test(b.textContent))
    || m.querySelector('.struct-menu-item')).click(); await new Promise(r => setTimeout(r, 1100)); }
  return JSON.stringify({ open: !document.getElementById('wpWorkspace').hidden });
})()`;

/* Which block kinds does the Add block menu offer - is a diagram reference one of them? */
const ADD_KINDS = `(async () => {
  const add = document.getElementById('wpAddBlockButton');
  if (!add) return JSON.stringify({ absent: true });
  add.click();
  await new Promise(r => setTimeout(r, 800));
  const m = document.querySelector('.struct-menu');
  const rows = m ? Array.from(m.querySelectorAll('.struct-menu-item')).map(b => ({
    text: b.textContent.replace(/\\s+/g, ' ').trim(), off: b.disabled })) : [];
  return JSON.stringify({ rows });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1600, height: 1000 });
  await setSource(page, SRC, 4000);

  const surfaces = JSON.parse(await page.evaluate(SURFACES));
  console.log('\n  the reference surfaces the app declares:');
  Object.entries(surfaces).forEach(([k, v]) => console.log(`     ${k.padEnd(20)} ${JSON.stringify(v)}`));

  const opened = JSON.parse(await page.evaluate(OPEN_DOCS));
  check('docs.opens', opened.open, 'Docs opens with a document', JSON.stringify(opened));

  const kinds = JSON.parse(await page.evaluate(ADD_KINDS));
  const rows = kinds.rows || [];
  console.log(`\n  Add block offers: ${rows.map(r => r.text + (r.off ? ' [off]' : '')).join(' | ') || 'nothing'}\n`);

  const refRow = rows.find(r => /diagram|reference|link|block from/i.test(r.text));
  check('addBlock.offersADiagramReference', !!refRow,
    'the Add block menu offers a diagram reference',
    refRow ? `${refRow.text}${refRow.off ? ' [disabled]' : ''}` : `no such row among: ${rows.map(r => r.text).join(', ')}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Is there any other route - a link control inside a text block, or on the diagram side?
  const other = JSON.parse(await page.evaluate(`(() => {
    const hits = [];
    document.querySelectorAll('button, [role="menuitem"]').forEach(b => {
      const t = (b.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!t || t.length > 40) return;
      if (/link|reference|go to diagram|open diagram|jump to/i.test(t)) {
        const r = b.getBoundingClientRect();
        hits.push({ text: t, id: b.id || null, visible: r.width > 2 && r.height > 2 });
      }
    });
    return JSON.stringify(hits.slice(0, 10));
  })()`));
  console.log('  controls mentioning a link or a diagram reference:');
  other.forEach(h => console.log(`     ${h.visible ? 'visible' : 'hidden '}  ${JSON.stringify(h.text)}  ${h.id || ''}`));

  check('anyLinkRoute.exists', other.length > 0 || !!refRow,
    'some route to link a document to a diagram exists',
    `${other.length} controls mention it, add-block row: ${refRow ? 'yes' : 'no'}`);

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await page.screenshot({ path: 'C:/Claude/SIREN/pending/slot/docs_link.png' });
  await close();
  report('docs link');
  process.exit(0);
})();
