#!/usr/bin/env node
/* The code editor's Escape says, in its own comment, that it lands focus "in the editor's own
 * header rather than on <body>, so the next Tab continues from where the user was". On the base
 * build the tour swallowed that Escape entirely, so the promise was never testable while the tour
 * was up. Now that round 14 lets it through, check whether it is kept - with the tour up and with
 * the tour gone, and both with and without an undo entry to land on.
 */
const fs = require('fs');
const { openSession, waitTour, skipTour, setSourceChecked, ACTIVE } = require('./r14_tourlib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round14/app.html');
const PORT = Number(arg('port', '9723'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/r14_editoresc_out.json');
const NL = String.fromCharCode(10);
const FIXTURE = ['flowchart TD', '  A[State] --> B[Second block]'].join(NL);

async function clickSel(page, sel, wait = 400) {
  const box = await page.evaluate(`(() => { const n = document.querySelector(${JSON.stringify(sel)});
    if (!n) return null; const r = n.getBoundingClientRect(); if (r.width < 3) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) return null;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(wait);
  return box;
}

async function run(session, name, tourUp, typeFirst) {
  const h = await session.freshPage();
  const rec = { name, tourUp, typeFirst };
  try {
    await waitTour(h.page, 12000);
    if (!tourUp) rec.skipped = await skipTour(h.page);
    rec.tour = await h.page.evaluate("!!document.querySelector('.tour-card')");
    await clickSel(h.page, '#codeModeButton');
    await clickSel(h.page, '#textModeButton');
    if (!process.env.R14_DEFAULT_SRC) await setSourceChecked(h.page, FIXTURE, 1800);
    const box = await h.page.evaluate(`(() => { const s = document.getElementById('source');
      const r = s.getBoundingClientRect(); return r.width < 5 ? null : { x: r.left + 70, y: r.top + 26 }; })()`);
    await h.page.mouse.click(box.x, box.y);
    await h.page.waitForTimeout(300);
    if (typeFirst) { await h.page.keyboard.type(' ', { delay: 60 }); await h.page.waitForTimeout(1400); }
    rec.focusBefore = await h.page.evaluate(ACTIVE);
    rec.undoDisabled = await h.page.evaluate("(() => { const b = document.getElementById('undoButton'); return b ? !!b.disabled : 'absent'; })()");
    await h.page.keyboard.press('Escape');
    await h.page.waitForTimeout(700);
    rec.focusAfter = await h.page.evaluate(ACTIVE);
    rec.landedOnBody = rec.focusAfter === 'BODY';
    // "so the next Tab continues from where the user was"
    await h.page.keyboard.press('Tab');
    await h.page.waitForTimeout(250);
    rec.nextTabLandsOn = await h.page.evaluate(ACTIVE);
  } catch (e) { rec.threw = String(e.message).slice(0, 200); }
  rec.errors = h.errors.slice(0, 5);
  await h.dispose();
  console.log('  ' + JSON.stringify(rec));
  return rec;
}

(async () => {
  const session = await openSession(APP, PORT);
  const out = { app: APP, cases: [] };
  out.cases.push(await run(session, 'tour-up-no-undo', true, false));
  out.cases.push(await run(session, 'tour-up-with-undo', true, true));
  out.cases.push(await run(session, 'tour-gone-no-undo', false, false));
  out.cases.push(await run(session, 'tour-gone-with-undo', false, true));
  await session.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(1); });
