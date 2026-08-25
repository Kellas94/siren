#!/usr/bin/env node
/* Does typing after "/" in a Docs paragraph still destroy the text?
 *
 * This is the defect that outranked everything else in round 8: a person types "/2026" and keeps
 * only the slash, on screen and in storage. Codex says it is fixed. This checks it the way it
 * actually happens - a real mouse click into the paragraph and real keystrokes - because the whole
 * defect lives in a keydown handler that synthetic events walk straight past.
 *
 * Run against BOTH builds. The base must fail; if it does not, the probe is not reaching the defect
 * and its pass on the patched build proves nothing.
 *
 * Usage: node verify_slash_typing.js [--app <path>] [--port 9770]
 */
const { openApp, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round8/app.html');
const PORT = Number(arg('port', '9770'));
const TAG = arg('tag', 'patched');

const OPEN_DOCS = `(async () => {
  document.getElementById('workpapersButton').click();
  await new Promise(r => setTimeout(r, 900));
  const nw = document.getElementById('wpNewButton') || document.getElementById('wpEmptyNewButton');
  if (nw) { nw.click(); await new Promise(r => setTimeout(r, 700)); }
  const menu = document.querySelector('.struct-menu');
  if (menu) {
    const row = Array.from(menu.querySelectorAll('.struct-menu-item')).find(b => /note|narrative/i.test(b.textContent));
    (row || menu.querySelector('.struct-menu-item')).click();
    await new Promise(r => setTimeout(r, 900));
  }
  const add = document.getElementById('wpAddTextButton');
  if (add) { add.click(); await new Promise(r => setTimeout(r, 700)); }
  const eds = Array.from(document.querySelectorAll('#wpBlocks .wp-text'));
  const empty = eds.find(e => !e.textContent.trim()) || eds[eds.length - 1];
  if (!empty) return JSON.stringify({ ok: false, why: 'no empty paragraph', count: eds.length });
  const r = empty.getBoundingClientRect();
  return JSON.stringify({ ok: true, x: Math.round(r.left + 30), y: Math.round(r.top + r.height / 2),
    blocks: Array.from(document.querySelectorAll('#wpBlocks .wp-block')).map(b => b.dataset.blockId) });
})()`;

const READ = `(() => JSON.stringify({
  texts: Array.from(document.querySelectorAll('#wpBlocks .wp-text')).map(e => e.textContent),
  all: Array.from(document.querySelectorAll('#wpBlocks .wp-block')).map(b => ({
    id: b.dataset.blockId, text: b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40) })),
  menuOpen: !!document.querySelector('.struct-menu')
}))()`;

async function typeInto(page, spot, text) {
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(300);
  await page.keyboard.type(text, { delay: 45 });
  await page.waitForTimeout(700);
}

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  const spot = JSON.parse(await page.evaluate(OPEN_DOCS));
  if (!spot.ok) { check('setup', false, 'an empty Docs paragraph', spot.why); await close(); process.exit(1); }

  // ---- the exact scenario -----------------------------------------------------------------
  await typeInto(page, spot, '/2026 field work');
  let r = JSON.parse(await page.evaluate(READ));
  const kept = r.texts.some(t => t === '/2026 field work');
  check('typed.keepsEveryCharacter', kept,
    'the paragraph holds all sixteen characters of "/2026 field work"',
    JSON.stringify(r.all));

  check('typed.noPhantomBlock', r.all.length === spot.blocks.length,
    `block count unchanged (${spot.blocks.length})`,
    `${r.all.length} blocks: ${r.all.map(b => b.id).join(', ')}`);

  // ---- and it has to survive a reload, read back from storage ------------------------------
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(require('./r7_lib').SETTLE);
  await page.evaluate(`(async () => { document.getElementById('workpapersButton').click();
    await new Promise(r => setTimeout(r, 1200)); })()`);
  const after = JSON.parse(await page.evaluate(READ));
  check('typed.survivesReload', after.texts.some(t => t === '/2026 field work'),
    'the same string is still there after a reload',
    JSON.stringify(after.all));

  // ---- sideways: a path, with no space at all ----------------------------------------------
  const spot2 = JSON.parse(await page.evaluate(OPEN_DOCS));
  if (spot2.ok) {
    await typeInto(page, spot2, '/mnt/data/evidence.pdf');
    const p = JSON.parse(await page.evaluate(READ));
    check('path.keepsEveryCharacter', p.texts.some(t => t === '/mnt/data/evidence.pdf'),
      'all twenty-two characters of a path survive',
      JSON.stringify(p.all));
  }

  // ---- sideways: a slash mid-sentence must not open a menu ----------------------------------
  const spot3 = JSON.parse(await page.evaluate(OPEN_DOCS));
  if (spot3.ok) {
    await typeInto(page, spot3, 'Sample 12/2026 reviewed');
    const m = JSON.parse(await page.evaluate(READ));
    check('midSentence.noMenu', !m.menuOpen && m.texts.some(t => t === 'Sample 12/2026 reviewed'),
      'a slash inside a sentence is just a character',
      `menuOpen=${m.menuOpen} | ${JSON.stringify(m.all)}`);
  }

  // ---- the feature must still work: bare slash opens the menu -------------------------------
  const spot4 = JSON.parse(await page.evaluate(OPEN_DOCS));
  if (spot4.ok) {
    await page.mouse.click(spot4.x, spot4.y);
    await page.waitForTimeout(300);
    await page.keyboard.type('/', { delay: 40 });
    await page.waitForTimeout(800);
    const f = JSON.parse(await page.evaluate(`(() => JSON.stringify({
      menu: !!document.querySelector('.struct-menu'),
      rows: Array.from(document.querySelectorAll('.struct-menu .struct-menu-item')).map(b => b.textContent.trim())
    }))()`));
    check('bareSlash.stillOpensMenu', f.menu && f.rows.length >= 5,
      'a bare slash still offers the five Add block rows',
      `menu=${f.menu} rows=${f.rows.join(' | ')}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await page.screenshot({ path: `C:/Claude/SIREN/pending/round8/slash_${TAG}.png` });
  await close();
  report(`slash typing (${TAG})`);
  process.exit(0);
})();
