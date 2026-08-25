#!/usr/bin/env node
/* The gap row above the declaration: does "Insert block below" break the document?
 *
 * The claim is that on a source shaped
 *
 *     (blank)
 *     ---
 *     title: X
 *     ---
 *     (blank)
 *     flowchart TD
 *       A --> B
 *
 * the blank row BENEATH the closing delimiter still offers Insert block below, and taking the offer
 * writes a Mermaid node above the declaration - which is not a diagram any more.
 *
 * The attribution matters and is checked here rather than argued: the gate added in 1.69.0 is
 * `frontmatterEnd >= 0 && index <= frontmatterEnd`, which stops AT the closing delimiter. It never
 * covered the line beneath it. On the old build that row was protected by accident, because the app
 * could not see front matter at all and disabled every row for the wrong reason. So this measures
 * three builds, not two, and reports which of them can reach the corruption.
 *
 * Usage: node verify_frontmatter_gap.js --app <path> [--tag x] [--port 9912]
 */
const { openApp, setSource, openGuided, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round9/merged.html');
const PORT = Number(arg('port', '9912'));
const TAG = arg('tag', 'merged');

const NL = String.fromCharCode(10);
const SRC = ['', '---', 'title: Q3 approvals', '---', '', 'flowchart TD',
             '  A[Request] --> B[Approve]'].join(NL);

/* Find the blank row that sits between the closing delimiter and the declaration. */
const FIND_GAP = `(() => {
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const texts = rows.map(r => r.textContent.replace(/\\s+/g, ' ').trim());
  // rows are numbered; the gap row is the one whose code part is empty, after the second ---
  let seen = 0, idx = -1;
  for (let i = 0; i < texts.length; i += 1) {
    if (texts[i].indexOf('---') >= 0) { seen += 1; continue; }
    if (seen >= 2 && /^\\d+$/.test(texts[i])) { idx = i; break; }
  }
  if (idx < 0) return JSON.stringify({ ok: false, texts });
  const b = rows[idx].getBoundingClientRect();
  return JSON.stringify({ ok: true, idx, texts,
    x: Math.round(b.left + Math.min(40, b.width / 2)), y: Math.round(b.top + b.height / 2) });
})()`;

const MENU = `(() => {
  const m = document.querySelector('.struct-menu');
  if (!m) return JSON.stringify({ open: false });
  return JSON.stringify({ open: true, rows: Array.from(m.querySelectorAll('.struct-menu-item'))
    .map(b => ({ text: b.textContent.replace(/\\s+/g, ' ').trim(), off: b.disabled, why: b.title || '' })) });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1500, height: 1000 });
  await setSource(page, SRC, 4200);
  const rowCount = await openGuided(page);
  await page.waitForTimeout(600);

  const gap = JSON.parse(await page.evaluate(FIND_GAP));
  if (!gap.ok) {
    check(`${TAG}.setup`, false, 'a blank Guided row between the front matter and the declaration',
      JSON.stringify(gap.texts));
    await close(); process.exit(1);
  }
  console.log(`\n  ${TAG}: ${rowCount} rows, gap row at index ${gap.idx}`);

  await page.evaluate(`document.querySelector('.struct-menu')?.remove()`);
  await page.mouse.click(gap.x, gap.y, { button: 'right' });
  await page.waitForTimeout(800);
  const menu = JSON.parse(await page.evaluate(MENU));
  const insert = (menu.rows || []).find(r => /insert block below/i.test(r.text));
  console.log(`  menu: ${(menu.rows || []).map(r => r.text + (r.off ? ' [off]' : '')).join(' | ')}\n`);

  check(`${TAG}.gapRowOffersInsert`, !!insert && !insert.off,
    'whether the gap row offers a live Insert block below',
    insert ? (insert.off ? 'disabled: ' + insert.why : 'LIVE') : 'row absent');

  if (insert && !insert.off) {
    const before = await page.evaluate(`document.getElementById('source').value`);
    await page.evaluate(`(() => {
      const m = document.querySelector('.struct-menu');
      const b = Array.from(m.querySelectorAll('.struct-menu-item')).find(x => /insert block below/i.test(x.textContent));
      if (b) b.click();
    })()`);
    await page.waitForTimeout(1600);
    const after = await page.evaluate(`document.getElementById('source').value`);
    const lines = after.split(/\r?\n/);
    const declAt = lines.findIndex(l => /^\s*flowchart\b/.test(l));
    const nodeAt = lines.findIndex(l => /N\d|New block/.test(l));
    console.log('  after:', JSON.stringify(after));
    console.log(`  declaration at line ${declAt}, inserted node at line ${nodeAt}\n`);

    check(`${TAG}.nodeNotAboveDeclaration`, !(nodeAt >= 0 && declAt >= 0 && nodeAt < declAt),
      'an inserted node does not land above the flowchart declaration',
      nodeAt < 0 ? 'nothing inserted' : `node at ${nodeAt}, declaration at ${declAt}`);

    const err = await page.evaluate(`(() => { const e = document.getElementById('editorError');
      return e && !e.hidden ? e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70) : null; })()`);
    check(`${TAG}.diagramStillRenders`, !err,
      'the diagram still renders after the insert', err || 'no error');
  }

  check(`${TAG}.noErrors`, errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await close();
  report(`front-matter gap (${TAG})`);
  process.exit(0);
})();
