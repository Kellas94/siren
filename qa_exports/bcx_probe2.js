#!/usr/bin/env node
/* JOB BC - SKEPTIC PROBE 2
 * The other engineer proved "non-destructive loses nothing" on six SOURCE-touching callers,
 * all with an IMMEDIATE press of Undo. This probe takes the same question one step sideways:
 *
 *   - a neutral caller that touches something OTHER than the source (Delete class -> styleClasses,
 *     Reset every block style -> nodeStyles). Neither writes a restore point.
 *   - Undo pressed immediately          (their test)
 *   - Undo pressed after a RELOAD       (the ordinary thing an auditor does)
 *   - and whether any restore point holds the thing at all.
 *
 * Usage: node bcx_probe2.js --app <path> --port <n> --tag <base|merged>
 */
const fs = require('fs');
const path = require('path');
const { openApp, setSource } = require('./r7_lib');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round12/app.html');
const PORT = Number(arg('port', '9832'));
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
    while (n) {
      if (n.tagName === 'DETAILS' && !n.open) { n.open = true; opened++; }
      if (n.hidden) n.hidden = false;
      n = n.parentElement;
    }
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

const READ_DIALOG = `(() => {
  const d = document.getElementById('confirmDialog');
  if (!d || !d.open) return JSON.stringify({ open: false });
  const ok = document.getElementById('confirmActionButton');
  const cs = getComputedStyle(ok);
  return JSON.stringify({
    open: true,
    title: (document.getElementById('confirmDialogTitle').textContent || '').trim(),
    message: (document.getElementById('confirmDialogMessage').textContent || '').trim(),
    okText: (ok.textContent || '').trim(),
    okDanger: ok.classList.contains('danger'),
    okBg: cs.backgroundColor,
    cancelHidden: document.getElementById('cancelConfirmButton').hidden
  });
})()`;

/* The on-screen truth about classes + the persisted truth about restore points. */
const READ_STATE = `(async () => {
  const opts = Array.from(document.querySelectorAll('#styleClassSelect option')).map(o => o.value).filter(Boolean);
  const raw = await new Promise(res => {
    const rq = indexedDB.open('t-industries-siren-db');
    rq.onerror = () => res(null);
    rq.onsuccess = () => {
      const db = rq.result;
      let names = [];
      try { names = Array.from(db.objectStoreNames); } catch (e) {}
      if (!names.length) { res(null); return; }
      const tx = db.transaction(names[0], 'readonly');
      const all = tx.objectStore(names[0]).getAll();
      const keys = tx.objectStore(names[0]).getAllKeys();
      all.onsuccess = () => { keys.onsuccess = () => res({ store: names[0], keys: keys.result, values: all.result }); };
      all.onerror = () => res(null);
    };
  });
  let stateRec = null, versions = null;
  if (raw) {
    raw.keys.forEach((k, i) => {
      const v = raw.values[i];
      const s = typeof v === 'string' ? v : (v && typeof v.value === 'string' ? v.value : null);
      if (!s) return;
      if (/state/.test(String(k))) stateRec = s;
      if (/version/i.test(String(k))) versions = s;
    });
  }
  let styleClasses = null, nodeStyles = null;
  try {
    const p = JSON.parse(stateRec);
    const d = (p.diagrams || [])[0] || {};
    styleClasses = Object.keys(d.styleClasses || {});
    nodeStyles = Object.keys(d.nodeStyles || {});
  } catch (e) {}
  let vlist = [];
  try { vlist = (JSON.parse(versions) || []).map(v => ({ reason: v.reason, len: (v.source || '').length })); } catch (e) {}
  return JSON.stringify({
    selectOptions: opts,
    persistedStyleClasses: styleClasses,
    persistedNodeStyles: nodeStyles,
    restorePoints: vlist,
    storeKeys: raw ? raw.keys.map(String) : null,
    undoDisabled: document.getElementById('undoButton') ? document.getElementById('undoButton').disabled : 'absent',
    source: document.getElementById('source').value
  });
})()`;

async function readState(page) { return JSON.parse(await page.evaluate(READ_STATE)); }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 950 });
  const out = { tag: TAG, app: APP, steps: {} };
  try {
    await killTour(page);
    await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
    await page.waitForTimeout(700);
    await setSource(page, FIXTURE, 2600);
    out.steps.fixtureAsserted = await page.evaluate(`document.getElementById('source').value`);

    // ---------- create a style class with a real name typed by a real keyboard ----------
    out.steps.openPanel = await openAncestors(page, '#styleClassName');
    await page.waitForTimeout(400);
    const nameBox = JSON.parse(await page.evaluate(`(() => {
      const e = document.getElementById('styleClassName');
      const r = e.getBoundingClientRect();
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height });
    })()`));
    out.steps.nameBox = nameBox;
    await page.mouse.click(nameBox.x, nameBox.y);
    await page.keyboard.type(CLASSNAME, { delay: 25 });
    out.steps.typed = await page.evaluate(`document.getElementById('styleClassName').value`);
    out.steps.createClick = await realClick(page, '#createStyleClassButton');
    await page.waitForTimeout(1200);
    out.steps.afterCreate = await readState(page);

    // ---------- 1. Delete class, Undo immediately (their test, on a new caller) ----------
    out.steps.deleteClick = await realClick(page, '#deleteStyleClassButton');
    out.steps.dialog = JSON.parse(await page.evaluate(READ_DIALOG));
    out.steps.confirmClick = await realClick(page, '#confirmActionButton');
    await page.waitForTimeout(1200);
    out.steps.afterDelete = await readState(page);
    out.steps.undoClick = await realClick(page, '#undoButton');
    await page.waitForTimeout(1200);
    out.steps.afterUndoImmediate = await readState(page);

    // ---------- 2. Same delete, then a RELOAD before Undo ----------
    // Put the class back deterministically if undo did not.
    if (!(out.steps.afterUndoImmediate.selectOptions || []).includes(CLASSNAME)) {
      await page.mouse.click(nameBox.x, nameBox.y);
      await page.keyboard.type(CLASSNAME, { delay: 20 });
      await realClick(page, '#createStyleClassButton');
      await page.waitForTimeout(1200);
    }
    out.steps.beforeSecondDelete = await readState(page);
    out.steps.deleteClick2 = await realClick(page, '#deleteStyleClassButton');
    out.steps.dialog2 = JSON.parse(await page.evaluate(READ_DIALOG));
    out.steps.confirmClick2 = await realClick(page, '#confirmActionButton');
    await page.waitForTimeout(2500);           // let scheduleSave land
    out.steps.afterDelete2 = await readState(page);

    await page.reload({ waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(4000);
    await killTour(page);
    await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
    await page.waitForTimeout(900);
    await openAncestors(page, '#styleClassName');
    await page.waitForTimeout(500);
    out.steps.afterReload = await readState(page);
    out.steps.undoAfterReload = await realClick(page, '#undoButton');
    await page.waitForTimeout(1500);
    out.steps.afterUndoPostReload = await readState(page);
    // Press Undo several more times - an auditor would.
    for (let i = 0; i < 4; i++) { await realClick(page, '#undoButton'); await page.waitForTimeout(500); }
    out.steps.afterUndoX5 = await readState(page);
  } catch (e) {
    out.error = String(e && e.stack || e).slice(0, 900);
  }
  out.errors = errors;
  fs.writeFileSync(path.join(OUT, TAG + '_probe2.json'), JSON.stringify(out, null, 2));
  console.log('DONE ' + TAG);
  await close();
})();
