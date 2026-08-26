#!/usr/bin/env node
/* One step sideways from the fixture the patch was written for.
 *
 * Everything above was measured on a flowchart. The tour, the editor's Tab and the tour's Escape
 * are global, so they have to behave the same on a diagram type the patch never saw. Reached the
 * app's own way - the type picker, then the New starter button FOUND BY LABEL, then the confirm
 * dialog - and the fixture is ASSERTED from #source before anything is measured.
 *
 * The starter confirmation is also a free (b) check: a native dialog is open over the tour card.
 */
const fs = require('fs');
const { openSession, waitTour, ACTIVE } = require('./r14_tourlib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round14/app.html');
const PORT = Number(arg('port', '9721'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/r14_sideways_out.json');
const TYPE = arg('type', 'state');

const TOUR = "(() => { const c = document.querySelector('.tour-card'); return c ? (c.querySelector('strong')||{}).textContent : null; })()";
const IN_CARD = "(() => { const a = document.activeElement; return !!(a && a.closest && a.closest('.tour-card')); })()";

async function clickSel(page, sel, opts = {}) {
  const box = await page.evaluate(`(() => { const n = document.querySelector(${JSON.stringify(sel)});
    if (!n) return null; const r = n.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) return null;
  await page.mouse.click(box.x, box.y, opts);
  await page.waitForTimeout(opts.wait || 450);
  return box;
}

(async () => {
  const session = await openSession(APP, PORT);
  const h = await session.freshPage();
  const rec = { app: APP, type: TYPE };
  try {
    rec.tourWaitMs = await waitTour(h.page, 12000);
    rec.tourAtStart = await h.page.evaluate(TOUR);

    // Code mode so #source and the type picker are on screen.
    await clickSel(h.page, '#codeModeButton');
    await clickSel(h.page, '#textModeButton');
    // Step 1's card sits on top of the left panel and swallows the click aimed at the disclosure
    // underneath it. Advance the tour with its own Next button until the card is anchored over the
    // preview instead. The tour stays up throughout - that is the point of this probe.
    for (let i = 0; i < 3; i++) {
      const clear = await h.page.evaluate(`(() => {
        const d = document.querySelector('details.advanced-tools-card');
        if (!d) return true;
        const r = d.querySelector('summary').getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(e && e.closest('.tour-card')); })()`);
      if (clear) break;
      const next = await h.page.evaluate(`(() => {
        const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /next|done/i.test(x.textContent));
        if (!b) return null; const r = b.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      if (!next) break;
      await h.page.mouse.click(next.x, next.y);
      await h.page.waitForTimeout(600);
    }
    rec.tourStepUsed = await h.page.evaluate(TOUR);

    // The picker lives inside the collapsed "Diagram type, templates & tools" card; open it with a
    // real click on its own summary, or selectOption waits forever on an invisible control.
    const opened = await h.page.evaluate(`(() => {
      const d = document.querySelector('details.advanced-tools-card');
      if (!d) return null;
      const s = d.querySelector('summary');
      const r = s.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, wasOpen: d.open }; })()`);
    rec.toolsCard = opened ? ('summary at y=' + Math.round(opened.y) + ' wasOpen=' + opened.wasOpen) : 'NOT FOUND';
    if (opened && !opened.wasOpen) { await h.page.mouse.click(opened.x, opened.y); await h.page.waitForTimeout(600); }
    await h.page.selectOption('#diagramTypeSelect', TYPE);
    await h.page.waitForTimeout(600);
    rec.pickerValue = await h.page.evaluate("document.getElementById('diagramTypeSelect').value");

    // The starter button BY LABEL, not by a guessed id.
    const btn = await h.page.evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test((x.textContent || '').trim()));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!b.disabled, label: b.textContent.trim() }; })()`);
    rec.starterButton = btn ? btn.label + (btn.disabled ? ' (DISABLED)' : '') : 'NOT FOUND';
    if (!btn || btn.disabled) throw new Error('starter button unusable');
    await h.page.mouse.click(btn.x, btn.y);
    await h.page.waitForTimeout(700);

    // (b) free check: a native dialog is now open over the tour card. Escape must be the dialog's.
    rec.dialogOverCard = await h.page.evaluate("(() => { const d = document.querySelector('dialog[open]'); return d ? (d.id || 'unnamed') : null; })()");
    rec.tourBeforeDialogEscape = await h.page.evaluate(TOUR);
    if (rec.dialogOverCard) {
      await h.page.keyboard.press('Escape');
      await h.page.waitForTimeout(700);
      rec.dialogAfterEscape = await h.page.evaluate("(() => { const d = document.querySelector('dialog[open]'); return d ? (d.id || 'unnamed') : null; })()");
      rec.tourAfterDialogEscape = await h.page.evaluate(TOUR);
      // Re-open and confirm it properly this time.
      await h.page.mouse.click(btn.x, btn.y);
      await h.page.waitForTimeout(700);
    }
    const confirmed = await h.page.evaluate(`(() => {
      const d = document.querySelector('dialog[open]');
      if (!d) return 'no dialog';
      const b = Array.from(d.querySelectorAll('button')).find(x =>
        /replace|confirm|yes|continue|ok|start|create/i.test(x.textContent) && !/cancel|keep|no/i.test(x.textContent));
      if (!b) return 'buttons: ' + Array.from(d.querySelectorAll('button')).map(x => x.textContent.trim()).join(' | ');
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: b.textContent.trim() }; })()`);
    rec.confirmButton = typeof confirmed === 'string' ? confirmed : confirmed.label;
    if (typeof confirmed !== 'string') { await h.page.mouse.click(confirmed.x, confirmed.y); await h.page.waitForTimeout(2600); }

    // ASSERT THE FIXTURE.
    rec.source = await h.page.evaluate("document.getElementById('source').value");
    rec.firstLine = rec.source.split('\n')[0].trim();
    rec.isStateDiagram = /^stateDiagram/i.test(rec.firstLine);
    rec.tourAfterStarter = await h.page.evaluate(TOUR);

    // (a) Tab in the editor, on a diagram type the patch never saw.
    const box = await h.page.evaluate(`(() => { const s = document.getElementById('source');
      const r = s.getBoundingClientRect(); return r.width < 5 ? null : { x: r.left + 70, y: r.top + 26 }; })()`);
    if (box) { await h.page.mouse.click(box.x, box.y); await h.page.waitForTimeout(300); }
    rec.editorFocus = await h.page.evaluate(ACTIVE);
    rec.lenBefore = await h.page.evaluate("document.getElementById('source').value.length");
    await h.page.keyboard.press('Tab');
    await h.page.waitForTimeout(500);
    rec.lenAfter = await h.page.evaluate("document.getElementById('source').value.length");
    rec.editorIndented = rec.lenAfter === rec.lenBefore + 4;
    rec.focusAfterTab = await h.page.evaluate(ACTIVE);

    // (b) how far is the card, on this type?
    await h.page.evaluate("(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); })()");
    let presses = -1;
    for (let i = 1; i <= 150; i++) {
      await h.page.keyboard.press('Tab');
      await h.page.waitForTimeout(30);
      if (await h.page.evaluate(IN_CARD)) { presses = i; break; }
    }
    rec.tabsToCard = presses;

    // (b) Escape still ends it, on this type.
    await h.page.mouse.click(40, 120);
    await h.page.waitForTimeout(300);
    await h.page.keyboard.press('Escape');
    await h.page.waitForTimeout(800);
    rec.tourAfterEscape = await h.page.evaluate(TOUR);
    // and a second press in case another surface owned the first
    if (rec.tourAfterEscape) {
      await h.page.keyboard.press('Escape');
      await h.page.waitForTimeout(800);
      rec.tourAfterSecondEscape = await h.page.evaluate(TOUR);
    }
    rec.sourceAtEnd = (await h.page.evaluate("document.getElementById('source').value")).length;
  } catch (e) { rec.threw = String(e.message).slice(0, 240); }
  rec.errors = h.errors.slice(0, 8);
  await h.dispose();
  await session.close();
  console.log(JSON.stringify(rec));
  fs.writeFileSync(OUT, JSON.stringify(rec, null, 2));
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(1); });
