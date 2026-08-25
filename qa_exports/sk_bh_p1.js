/* JOB BH skeptic probe 1 - reproduce the reported pass, then step sideways.
   node sk_bh_p1.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');

const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

const CHARLIE = [
  'flowchart TD',
  '  ALPHA[Alpha step] --> BRAVO[Bravo step]',
  '  BRAVO --> CHARLIE[Charlie step]',
  '  CHARLIE --> DELTA[Delta step]',
  '  DELTA --> ECHO[Echo step]'
].join('\n');

const out = { tag: TAG, app: APP, scenarios: {} };

async function scenarioCharlie() {
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1024, height: 700 });
  try {
    await L.setSource(page, CHARLIE, 3200);
    const src = await page.$eval('#source', e => e.value);
    if (!/CHARLIE\[Charlie step\]/.test(src)) throw new Error('FIXTURE MISMATCH: ' + src.slice(0, 120));
    const ref = await L.makeReference(page, 'CHARLIE');
    await L.armObservers(page);
    const before = await L.snapshot(page, 'CHARLIE');
    await L.clickChip(page);
    await page.waitForTimeout(1400);
    const after = await L.snapshot(page, 'CHARLIE');
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_charlie_' + TAG + '.png' });
    return { ref, before, after, errors: errors.slice() };
  } finally { await close(); }
}

/* THE STANDING RULE. A block label typed into the Build card and not yet applied is
   what somebody wrote. Does clicking a Docs reference chip throw it away? */
async function scenarioClobber() {
  const { page, errors, close } = await L.openApp(APP, PORT + 1, { width: 1280, height: 820 });
  try {
    await L.setSource(page, CHARLIE, 3200);
    // Open the Build panel the way a person does, select ALPHA, and type a new label.
    const opened = await page.evaluate(() => {
      const b = document.getElementById('visualModeButton') || document.getElementById('buildModeButton');
      if (b) { b.click(); return b.id; }
      return null;
    });
    await page.waitForTimeout(700);
    await page.selectOption('#visualNodeSelect', 'ALPHA').catch(() => {});
    await page.waitForTimeout(400);
    // Real typing into the label field, deliberately NOT applied.
    const lbl = await page.evaluate(() => {
      const n = document.getElementById('visualNodeEditLabel');
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, before: n.value, disabled: n.disabled };
    });
    let typedVia = 'mouse';
    if (lbl && lbl.w > 1) {
      await page.mouse.click(lbl.x, lbl.y, { clickCount: 3 });
      await page.keyboard.press('Control+A');
      await page.keyboard.type('UNSAVED WORK 2026');
    } else {
      typedVia = 'none';
    }
    const typed = await page.$eval('#visualNodeEditLabel', n => n.value);
    const srcBefore = await page.$eval('#source', e => e.value);

    const ref = await L.makeReference(page, 'CHARLIE');
    const midDocs = await page.$eval('#visualNodeEditLabel', n => n.value);
    await L.armObservers(page);
    await L.clickChip(page);
    await page.waitForTimeout(1400);
    const afterChip = await page.$eval('#visualNodeEditLabel', n => n.value);
    const snap = await L.snapshot(page, 'CHARLIE');
    return {
      openedBuildVia: opened, typedVia, labelFieldBox: lbl,
      typedValue: typed, afterOpeningDocs: midDocs, afterChipClick: afterChip,
      lostTypedText: typed === 'UNSAVED WORK 2026' && afterChip !== 'UNSAVED WORK 2026',
      sourceUnchanged: srcBefore === snap.source,
      ref, toasts: snap.toasts, inspectorHeading: snap.inspectorHeading,
      inspectorHidden: snap.inspectorHidden, styleTarget: snap.styleTarget,
      errors: errors.slice()
    };
  } finally { await close(); }
}

(async () => {
  const only = process.argv[5];
  try { if (!only || only === 'charlie') out.scenarios.charlie = await scenarioCharlie(); }
  catch (e) { out.scenarios.charlie = { ERROR: String(e.message) }; }
  try { if (!only || only === 'clobber') out.scenarios.clobber = await scenarioClobber(); }
  catch (e) { out.scenarios.clobber = { ERROR: String(e.message) }; }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p1_' + TAG + '.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1).slice(0, 6000));
})();
