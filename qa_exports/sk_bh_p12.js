/* JOB BH skeptic probe 12 - the vacuity re-run.
   Their "no pointless scrolling" check: a 2-block diagram that already fits.
   BASE never scrolls at all, so if MERGED also does not, the check separates nothing.
   node sk_bh_p12.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

const TWO = 'flowchart TD\n  A[Open the file] --> B[Sign it off]';

(async () => {
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1024, height: 700 });
  const out = { tag: TAG };
  try {
    await L.setSource(page, TWO, 3200);
    out.fixture = await page.$eval('#source', e => e.value);
    await L.makeReference(page, 'B');
    await L.armObservers(page);
    const before = await L.snapshot(page, 'B');
    await L.clickChip(page);
    await page.waitForTimeout(1500);
    const after = await L.snapshot(page, 'B');
    out.beforeScroll = [before.scrollTop, before.scrollLeft];
    out.afterScroll = [after.scrollTop, after.scrollLeft];
    out.distinctScrollSamples = after.scrolls.length;
    out.beforeVis = before.visible; out.afterVis = after.visible;
    out.inspectorHidden = after.inspectorHidden; out.heading = after.inspectorHeading;
    out.ring = after.ring; out.toasts = after.toasts.map(t => t.text);
    out.errors = errors.slice();
  } catch (e) { out.ERROR = String(e.message); }
  finally { await close(); }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p12_' + TAG + '.json', JSON.stringify(out, null, 1));
  console.log(TAG, JSON.stringify(out).slice(0, 700));
})();
