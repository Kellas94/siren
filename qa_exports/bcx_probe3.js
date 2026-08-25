#!/usr/bin/env node
/* JOB BC - SKEPTIC PROBE 3 : positive control + the loss, on both builds.
 *
 *  CONTROL  create the class, reload WITHOUT deleting -> it must still be there.
 *           (Without this, "gone after reload" proves nothing: the reload could be the thief.)
 *  LOSS     create it again, delete it through the real dialog, reload -> is it recoverable?
 *
 * Usage: node bcx_probe3.js --app <path> --port <n> --tag <base|merged>
 */
const fs = require('fs');
const path = require('path');
const { openApp, setSource } = require('./r7_lib');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round12/app.html');
const PORT = Number(arg('port', '9836'));
const TAG = arg('tag', 'x');
const OUT = 'C:/Claude/SIREN/qa_exports/bcx';
const NL = String.fromCharCode(10);
const CLASSNAME = 'KPMG control point';

const FIXTURE = [
  'flowchart TD',
  '    A[Raise purchase order] --> B[Three-way match]',
  '    B --> C[Post to ledger]'
].join(NL);

async function killTour(page) {
  for (let i = 0; i < 30; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent))
        || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 8) return;
    await page.waitForTimeout(200);
  }
}

async function openAncestors(page, sel) {
  return page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return 'absent';
    let n = e, opened = 0;
    while (n) { if (n.tagName === 'DETAILS' && !n.open) { n.open = true; opened++; } n = n.parentElement; }
    e.scrollIntoView({ block: 'center' });
    return 'opened:' + opened;
  })()`);
}

async function realClick(page, sel) {
  const box = JSON.parse(await page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return JSON.stringify(null);
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return JSON.stringify({ tiny: true });
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return JSON.stringify({ x, y, hit: top ? (top.id || top.tagName) : null, owns: !!(top && (top === e || e.contains(top))), disabled: !!e.disabled });
  })()`));
  if (!box || box.tiny || !box.owns) return { ok: false, box, sel };
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(600);
  return { ok: true, box, sel };
}

const READ = `(async () => {
  const opts = Array.from(document.querySelectorAll('#styleClassSelect option')).map(o => o.value).filter(Boolean);
  const raw = await new Promise(res => {
    const rq = indexedDB.open('t-industries-siren-db');
    rq.onerror = () => res(null);
    rq.onsuccess = () => {
      const db = rq.result;
      const names = Array.from(db.objectStoreNames);
      if (!names.length) { res(null); return; }
      const tx = db.transaction(names[0], 'readonly');
      const all = tx.objectStore(names[0]).getAll();
      const keys = tx.objectStore(names[0]).getAllKeys();
      all.onsuccess = () => { keys.onsuccess = () => res({ keys: keys.result, values: all.result }); };
      all.onerror = () => res(null);
    };
  });
  let classes = null, vlist = [];
  if (raw) raw.keys.forEach((k, i) => {
    const v = raw.values[i];
    const s = typeof v === 'string' ? v : (v && typeof v.value === 'string' ? v.value : null);
    if (!s) return;
    if (String(k) === 't-industries-siren-v23-state') {
      try { const p = JSON.parse(s); classes = (p.diagrams || []).map(d => Object.keys(d.styleClasses || {})); } catch (e) { classes = 'parse-fail'; }
    }
    if (String(k) === 't-industries-siren-v23-versions') {
      try { vlist = (JSON.parse(s) || []).map(x => ({ reason: x.reason, len: (x.source || '').length, classes: Object.keys((x.diagram && x.diagram.styleClasses) || {}) })); } catch (e) {}
    }
  });
  return JSON.stringify({
    selectOptions: opts,
    persistedClassesPerDiagram: classes,
    restorePoints: vlist,
    undoDisabled: document.getElementById('undoButton') ? document.getElementById('undoButton').disabled : 'absent'
  });
})()`;

async function read(page) { return JSON.parse(await page.evaluate(READ)); }

async function makeClass(page) {
  await openAncestors(page, '#styleClassName');
  await page.waitForTimeout(400);
  const b = JSON.parse(await page.evaluate(`(() => {
    const e = document.getElementById('styleClassName');
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  })()`));
  await page.mouse.click(b.x, b.y);
  await page.keyboard.type(CLASSNAME, { delay: 25 });
  const typed = await page.evaluate(`document.getElementById('styleClassName').value`);
  const click = await realClick(page, '#createStyleClassButton');
  await page.waitForTimeout(1500);
  return { typed, click };
}

async function settleAndReload(page) {
  await page.waitForTimeout(6000);            // let the debounced save land
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(4500);
  await killTour(page);
  await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
  await page.waitForTimeout(900);
  await openAncestors(page, '#styleClassName');
  await page.waitForTimeout(600);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 950 });
  const out = { tag: TAG, app: APP, steps: {} };
  try {
    await killTour(page);
    await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
    await page.waitForTimeout(700);
    await setSource(page, FIXTURE, 2600);
    out.steps.fixture = await page.evaluate(`document.getElementById('source').value`);

    // ---------------- CONTROL: does a class survive a reload at all? ----------------
    out.steps.make1 = await makeClass(page);
    out.steps.afterCreate = await read(page);
    await settleAndReload(page);
    out.steps.CONTROL_afterReloadNoDelete = await read(page);

    // ---------------- LOSS: delete it through the real dialog, then reload ----------------
    out.steps.deleteClick = await realClick(page, '#deleteStyleClassButton');
    out.steps.dialog = JSON.parse(await page.evaluate(`(() => {
      const d = document.getElementById('confirmDialog');
      if (!d || !d.open) return JSON.stringify({ open: false });
      const ok = document.getElementById('confirmActionButton');
      return JSON.stringify({
        open: true,
        title: (document.getElementById('confirmDialogTitle').textContent || '').replace(/[^\\x20-\\x7e]/g, "'").trim(),
        okText: (ok.textContent || '').trim(),
        okDanger: ok.classList.contains('danger'),
        okBg: getComputedStyle(ok).backgroundColor,
        okColor: getComputedStyle(ok).color
      });
    })()`));
    if (out.steps.dialog.open) {
      await page.locator('#confirmDialog').screenshot({ path: path.join(OUT, TAG + '_deleteClass.png') });
      out.steps.confirmClick = await realClick(page, '#confirmActionButton');
    }
    await page.waitForTimeout(1500);
    out.steps.afterDelete = await read(page);
    await settleAndReload(page);
    out.steps.LOSS_afterReload = await read(page);
    out.steps.undoTry = await realClick(page, '#undoButton');
    await page.waitForTimeout(1200);
    out.steps.afterUndoTry = await read(page);
  } catch (e) {
    out.error = String(e && e.stack || e).slice(0, 900);
  }
  out.errors = errors;
  fs.writeFileSync(path.join(OUT, TAG + '_probe3.json'), JSON.stringify(out, null, 2));
  console.log('DONE ' + TAG);
  await close();
})();
