#!/usr/bin/env node
/* How far is the first-run tour card from the keyboard, really?
 *
 * Forwards is the number everyone quotes, but the card is appended LAST to <body>, so backwards
 * may be much closer. Both directions, from a neutral start and from the document's first stop,
 * measured identically on both builds. Also checks whether anything focuses the card by itself.
 */
const fs = require('fs');
const { openSession, waitTour, ACTIVE } = require('./r14_tourlib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round14/app.html');
const PORT = Number(arg('port', '9719'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/r14_reach_out.json');

const IN_CARD = "(() => { const a = document.activeElement; return !!(a && a.closest && a.closest('.tour-card')); })()";

async function press(page, key, cap) {
  for (let i = 1; i <= cap; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(35);
    if (await page.evaluate(IN_CARD)) return i;
  }
  return -1;
}

async function neutral(page) {
  const pt = await page.evaluate(`(() => {
    for (let y = 120; y < window.innerHeight - 40; y += 25) {
      for (let x = 40; x < window.innerWidth - 40; x += 35) {
        const e = document.elementFromPoint(x, y);
        if (!e) continue;
        if (e.closest('.tour-card, dialog, a, button, input, select, textarea, [contenteditable], summary, label')) continue;
        if (e.closest('#diagram, #nodeInspector, #commandPalette')) continue;
        return { x, y };
      }
    }
    return null; })()`);
  if (pt) { await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(350); }
  return pt;
}

(async () => {
  const session = await openSession(APP, PORT);
  const out = { app: APP, cases: [] };

  const cases = {
    'forward-from-neutral': async page => { await neutral(page); return press(page, 'Tab', 150); },
    'backward-from-neutral': async page => { await neutral(page); return press(page, 'Shift+Tab', 150); },
    'forward-from-first-stop': async page => {
      await page.evaluate("(() => { const f = document.querySelector('a[href], button, input, select, textarea'); if (f) f.focus(); })()");
      return press(page, 'Tab', 150);
    },
    'backward-from-first-stop': async page => {
      await page.evaluate("(() => { const f = document.querySelector('a[href], button, input, select, textarea'); if (f) f.focus(); })()");
      return press(page, 'Shift+Tab', 150);
    }
  };

  for (const [name, body] of Object.entries(cases)) {
    const h = await session.freshPage();
    const rec = { name };
    try {
      rec.tourWaitMs = await waitTour(h.page, 12000);
      rec.cardFocusedByItself = await h.page.evaluate(IN_CARD);
      rec.focusAtCardArrival = await h.page.evaluate(ACTIVE);
      rec.presses = await body(h.page);
      rec.focusAtEnd = await h.page.evaluate(ACTIVE);
      rec.cardStillUp = await h.page.evaluate("!!document.querySelector('.tour-card')");
    } catch (e) { rec.threw = String(e.message).slice(0, 200); }
    rec.errors = h.errors.slice(0, 5);
    await h.dispose();
    console.log('  ' + name + ' -> ' + JSON.stringify(rec));
    out.cases.push(rec);
  }

  await session.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(1); });
