/* JOB BH skeptic probe 2 - THE STANDING RULE.
   A block label typed into the Build card and not yet applied is what somebody wrote.
   Does clicking a Docs reference chip throw it away?
   node sk_bh_p2.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

const SRC = [
  'flowchart TD',
  '  ALPHA[Alpha step] --> BRAVO[Bravo step]',
  '  BRAVO --> CHARLIE[Charlie step]',
  '  CHARLIE --> DELTA[Delta step]',
  '  DELTA --> ECHO[Echo step]'
].join('\n');

(async () => {
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1280, height: 900 });
  const out = { tag: TAG, app: APP };
  try {
    await L.setSource(page, SRC, 3200);
    const src = await page.$eval('#source', e => e.value);
    out.fixtureOk = /CHARLIE\[Charlie step\]/.test(src);

    // Build mode, by real click on its toolbar button.
    await L.realClick(page, '#visualModeButton', 'Build mode');
    await page.waitForTimeout(800);

    // The Block card is behind progressive disclosure. Expand it by clicking its own header.
    const hdr = await page.evaluate(() => {
      const f = document.getElementById('visualNodeEditLabel');
      let sec = f;
      while (sec && !(sec.classList && sec.classList.contains('visual-section'))) sec = sec.parentElement;
      if (!sec) return null;
      const head = sec.querySelector('button, summary, .visual-section-head, [role="button"]') || sec.firstElementChild;
      if (!head) return null;
      const r = head.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: head.tagName, txt: (head.textContent || '').trim().slice(0, 40), w: r.width, h: r.height, cls: String(sec.className) };
    });
    out.sectionHeader = hdr;
    if (hdr && hdr.w > 1) { await page.mouse.click(hdr.x, hdr.y); await page.waitForTimeout(600); }

    // Pick ALPHA in the Block dropdown the way the app expects.
    await page.selectOption('#visualNodeSelect', 'ALPHA').catch(e => { out.selectErr = String(e.message).slice(0, 120); });
    await page.waitForTimeout(500);

    const box = await page.evaluate(() => {
      const n = document.getElementById('visualNodeEditLabel');
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height), value: n.value, disabled: n.disabled };
    });
    out.labelFieldBox = box;
    if (!(box.w > 1)) throw new Error('Block label field still not visible: ' + JSON.stringify(box));

    // Real typing. Deliberately NOT applied - no Update press.
    await page.mouse.click(box.x, box.y, { clickCount: 3 });
    await page.keyboard.press('Control+A');
    await page.keyboard.type('UNSAVED WORK 2026');
    await page.waitForTimeout(300);
    out.typedValue = await page.$eval('#visualNodeEditLabel', n => n.value);
    out.focusAfterTyping = await page.evaluate(() => document.activeElement && document.activeElement.id);
    const srcBeforeDocs = await page.$eval('#source', e => e.value);

    const ref = await L.makeReference(page, 'CHARLIE');
    out.ref = ref;
    out.afterOpeningDocs = await page.$eval('#visualNodeEditLabel', n => n.value);

    await L.armObservers(page);
    await L.clickChip(page);
    await page.waitForTimeout(1500);
    out.afterChipClick = await page.$eval('#visualNodeEditLabel', n => n.value);
    const snap = await L.snapshot(page, 'CHARLIE');
    out.lostTypedText = out.typedValue === 'UNSAVED WORK 2026' && out.afterChipClick !== 'UNSAVED WORK 2026';
    out.sourceUnchanged = srcBeforeDocs === snap.source;
    out.warnedBeforeLosing = (snap.toasts || []).length > 0;
    out.toasts = snap.toasts;
    out.inspectorHeading = snap.inspectorHeading;
    out.buildSelect = snap.buildSelect;
    out.styleTarget = snap.styleTarget;
    out.errors = errors.slice();
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_clobber_' + TAG + '.png' });
  } catch (e) {
    out.ERROR = String(e.message);
  } finally { await close(); }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p2_' + TAG + '.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1).slice(0, 4000));
})();
