#!/usr/bin/env node
/* Is the non-breaking space in the slash fix transient, as disclosed, or permanent?
 *
 * Round 9 fixed three ways typing after "/" was destroyed - real work, and the most valuable thing
 * in the round. But it resumes the paragraph by writing `editor.innerHTML = '/&nbsp;'`, and the
 * handback calls that a rich-text representation "until more text arrives, normalising to an
 * ordinary space in the visible and stored document".
 *
 * If that is true, nothing here matters. If it is not, then every document a person writes this way
 * stores the literal entity, and the phrase they can see on screen is not the phrase that is stored,
 * exported or searched. That is the quiet kind of defect this project exists to catch, so it gets
 * measured rather than taken on report.
 *
 * Usage: node verify_nbsp.js [--app <path>] [--port 9900]
 */
const { openApp, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round9/merged.html');
const PORT = Number(arg('port', '9900'));
const TAG = arg('tag', 'merged');

const OPEN_DOCS = `(async () => {
  document.getElementById('workpapersButton').click();
  await new Promise(r => setTimeout(r, 1000));
  const nw = document.getElementById('wpNewButton') || document.getElementById('wpEmptyNewButton');
  if (nw) { nw.click(); await new Promise(r => setTimeout(r, 800)); }
  const m = document.querySelector('.struct-menu');
  if (m) {
    const row = Array.from(m.querySelectorAll('.struct-menu-item')).find(b => /note/i.test(b.textContent));
    (row || m.querySelector('.struct-menu-item')).click();
    await new Promise(r => setTimeout(r, 1000));
  }
  const add = document.getElementById('wpAddTextButton');
  if (add) { add.click(); await new Promise(r => setTimeout(r, 800)); }
  const eds = Array.from(document.querySelectorAll('#wpBlocks .wp-text'));
  const e = eds.find(x => !x.textContent.trim());
  if (!e) return JSON.stringify({ ok: false });
  const r = e.getBoundingClientRect();
  return JSON.stringify({ ok: true, x: Math.round(r.left + 30), y: Math.round(r.top + r.height / 2) });
})()`;

/* Read the character codes, not the rendered text. A non-breaking space looks exactly like a space
   and every string comparison in a probe will happily agree that it is one. */
const READ = `(() => {
  const eds = Array.from(document.querySelectorAll('#wpBlocks .wp-text'));
  const withText = eds.filter(e => e.textContent.trim());
  const target = withText[withText.length - 1] || eds[eds.length - 1];
  if (!target) return JSON.stringify({ none: true });
  const text = target.textContent || '';
  return JSON.stringify({
    text,
    codes: Array.from(text).slice(0, 14).map(c => c.charCodeAt(0)),
    html: target.innerHTML.slice(0, 60),
    hasNbspChar: text.indexOf(String.fromCharCode(160)) >= 0,
    hasNbspEntity: target.innerHTML.indexOf('&nbsp;') >= 0
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  const spot = JSON.parse(await page.evaluate(OPEN_DOCS));
  if (!spot.ok) { check('setup', false, 'an empty Docs paragraph', 'not found'); await close(); process.exit(1); }

  // the exact route the fix is for: slash, space, then a word
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(300);
  await page.keyboard.type('/', { delay: 60 });
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  // The case the report actually describes: type the space and STOP. Chrome only rewrites the
  // non-breaking space when the next printable key lands in the same text node, so this is the path
  // where it can persist - and typing a word afterwards, which is what the first probe did, hides it.
  if (process.argv.indexOf('--stop') < 0) { await page.keyboard.type('limaword', { delay: 50 }); }
  await page.waitForTimeout(1200);
  // click away, so the blur sanitiser runs
  await page.mouse.click(spot.x, spot.y + 90);
  await page.waitForTimeout(900);

  let r = JSON.parse(await page.evaluate(READ));
  console.log(`\n  ${TAG} after typing: text=${JSON.stringify(r.text)}`);
  console.log(`  codes: [${(r.codes || []).join(', ')}]   html: ${JSON.stringify(r.html)}\n`);

  check(`${TAG}.typingSurvives`, /limaword/.test(r.text || ''),
    'the word after the slash is there at all', JSON.stringify(r.text));

  check(`${TAG}.spaceIsAnOrdinarySpace`, r.hasNbspChar === false,
    'the space is U+0020, not U+00A0',
    `code at index 1 = ${(r.codes || [])[1]} (32 is a space, 160 is non-breaking)`);

  check(`${TAG}.noEntityInMarkup`, r.hasNbspEntity === false,
    'the stored markup holds no literal &nbsp; entity',
    JSON.stringify(r.html));

  // and does it survive a reload, which is what decides "stored"
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(require('./r7_lib').SETTLE);
  await page.evaluate(`(async () => { document.getElementById('workpapersButton').click();
    await new Promise(r => setTimeout(r, 1300)); })()`);
  r = JSON.parse(await page.evaluate(READ));
  console.log(`  ${TAG} after reload: text=${JSON.stringify(r.text)} codes=[${(r.codes || []).join(', ')}]`);
  console.log(`  html: ${JSON.stringify(r.html)}\n`);

  check(`${TAG}.stillOrdinaryAfterReload`, r.hasNbspChar === false && r.hasNbspEntity === false,
    'and it is still an ordinary space once reloaded from storage',
    `char U+00A0: ${r.hasNbspChar}, entity in markup: ${r.hasNbspEntity}`);

  check(`${TAG}.noErrors`, errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await close();
  report(`nbsp (${TAG})`);
  process.exit(0);
})();
