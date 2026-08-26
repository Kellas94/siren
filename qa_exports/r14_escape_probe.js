#!/usr/bin/env node
/* Round 14, deletion 7: the tour's Escape handler moved off the capture phase and gained a
 * defaultPrevented guard.
 *
 * Two halves, measured identically on both builds:
 *   (a) does Escape reach the surface that owns it - the inspector's revert above all
 *   (b) does Escape STILL dismiss the tour, and does an open native dialog still win first
 *
 * Every scenario gets its OWN browser context. Escape ends the tour and writes tourDone, so a
 * second scenario in the same storage would be measuring the no-tour path.
 *
 * Usage: node r14_escape_probe.js --app <path> --port <n> --out <json>
 */
const fs = require('fs');
const { openSession, waitTour, setSourceChecked, clickNode, ACTIVE } = require('./r14_tourlib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round14/app.html');
const PORT = Number(arg('port', '9711'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/r14_esc_out.json');
const ONLY = arg('only', '');
const NL = String.fromCharCode(10);

/* A[State] -> A[ZZZTEST] is +2 characters, the same delta the report describes. */
const FIXTURE = [
  'flowchart TD',
  '  A[State] --> B[Second block]',
  '  B --> C[Third block]',
  '  C --> D[Fourth block]',
  '  D --> E[Fifth block]'
].join(NL);

const TOUR = "(() => { const c = document.querySelector('.tour-card'); return c ? (c.querySelector('strong')||{}).textContent : null; })()";
const INSP = "(() => { const n = document.getElementById('nodeInspector'); return !!n && !n.hidden; })()";

/* A point that belongs to nobody: not the card, not a control, not a diagram block. */
async function clickNeutral(page) {
  const pt = await page.evaluate(`(() => {
    for (let y = 120; y < window.innerHeight - 40; y += 25) {
      for (let x = 40; x < window.innerWidth - 40; x += 35) {
        const e = document.elementFromPoint(x, y);
        if (!e) continue;
        if (e.closest('.tour-card, dialog, a, button, input, select, textarea, [contenteditable], summary, label')) continue;
        if (e.closest('#diagram, .tour-highlight, #nodeInspector, #commandPalette')) continue;
        return { x, y, on: e.tagName + '#' + (e.id || '') };
      }
    }
    return null;
  })()`);
  if (!pt) return null;
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(700);
  return pt;
}

async function clickSel(page, sel, opts = {}) {
  const box = await page.evaluate(`(() => { const n = document.querySelector(${JSON.stringify(sel)});
    if (!n) return null; const r = n.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) return null;
  await page.mouse.click(box.x, box.y, opts);
  await page.waitForTimeout(opts.wait || 400);
  return box;
}

/* Put the code editor on screen and the caret in it. */
async function focusEditor(page) {
  await clickSel(page, '#codeModeButton');
  await clickSel(page, '#textModeButton');
  const box = await page.evaluate(`(() => { const s = document.getElementById('source');
    const r = s.getBoundingClientRect(); if (r.width < 5) return null;
    return { x: r.left + Math.min(80, r.width / 3), y: r.top + 26 }; })()`);
  if (!box) return null;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(350);
  return box;
}

/* Open the inspector on block A with a real click and type ZZZTEST over its label. */
async function armLabel(page, rec) {
  rec.fixtureOk = (await setSourceChecked(page, FIXTURE)).ok;
  rec.srcBefore = await page.evaluate("document.getElementById('source').value");
  rec.lenBefore = rec.srcBefore.length;
  const hit = await clickNode(page, 'A');
  rec.clickedOn = hit ? hit.topmost : 'NODE-NOT-FOUND';
  rec.inspectorOpen = await page.evaluate(INSP);
  rec.labelAtOpen = await page.evaluate("document.getElementById('inspectorBlockLabel').value");
  const box = await page.evaluate(`(() => { const r = document.getElementById('inspectorBlockLabel').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.mouse.click(box.x, box.y, { clickCount: 3 });
  await page.waitForTimeout(150);
  await page.keyboard.type('ZZZTEST', { delay: 55 });
  rec.labelTyped = await page.evaluate("document.getElementById('inspectorBlockLabel').value");
  rec.focusBeforeEsc = await page.evaluate(ACTIVE);
}

async function readAfter(page, rec) {
  await page.waitForTimeout(900);
  rec.srcAfter = await page.evaluate("document.getElementById('source').value");
  rec.lenAfter = rec.srcAfter.length;
  rec.sourceUnchanged = rec.srcAfter === rec.srcBefore;
  rec.committedZZZ = rec.srcAfter.indexOf('ZZZTEST') >= 0;
  rec.delta = rec.lenAfter - rec.lenBefore;
}

const SCENARIOS = {};

/* ---- 1a. THE HEADLINE: Escape then click ANOTHER BLOCK (inspector stays open) ---- */
SCENARIOS['label-esc-then-other-block'] = async (page, rec) => {
  await armLabel(page, rec);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  rec.labelAfterEsc = await page.evaluate("document.getElementById('inspectorBlockLabel').value");
  rec.tourAfterEsc = await page.evaluate(TOUR);
  rec.focusAfterEsc = await page.evaluate(ACTIVE);
  rec.inspectorAfterEsc = await page.evaluate(INSP);
  const away = await clickNode(page, 'B');
  rec.clickedAway = away ? away.topmost : 'B-NOT-FOUND';
  await readAfter(page, rec);
};

/* ---- 1b. Escape then click a control INSIDE the inspector ---- */
SCENARIOS['label-esc-then-inpanel'] = async (page, rec) => {
  await armLabel(page, rec);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  rec.labelAfterEsc = await page.evaluate("document.getElementById('inspectorBlockLabel').value");
  rec.tourAfterEsc = await page.evaluate(TOUR);
  rec.inspectorAfterEsc = await page.evaluate(INSP);
  const target = await page.evaluate(`(() => {
    const n = document.getElementById('nodeInspector');
    const c = n && n.querySelector('#metadataOwner, #inspectorFontSize, #inspectorShape, input:not([type=hidden]):not(#inspectorBlockLabel)');
    if (!c) return null; const r = c.getBoundingClientRect();
    if (r.width < 3) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: c.id || c.tagName }; })()`);
  rec.clickedAway = target ? target.id : 'NO-INPANEL-CONTROL';
  if (target) { await page.mouse.click(target.x, target.y); await page.waitForTimeout(500); }
  await readAfter(page, rec);
};

/* ---- 1c. CONTROL: no Escape at all. Where does a typed label go? ---- */
SCENARIOS['label-noesc-then-other-block'] = async (page, rec) => {
  await armLabel(page, rec);
  const away = await clickNode(page, 'B');
  rec.clickedAway = away ? away.topmost : 'B-NOT-FOUND';
  await readAfter(page, rec);
};

/* ---- 1d. CONTROL: no Escape, click empty space ---- */
SCENARIOS['label-noesc-then-empty'] = async (page, rec) => {
  await armLabel(page, rec);
  rec.clickedAway = await clickNeutral(page);
  await readAfter(page, rec);
};

/* ---- 2. the diagram title, reached through the Style panel ---- */
SCENARIOS['diagram-title'] = async (page, rec) => {
  await clickSel(page, '#styleShortcutButton', { wait: 900 });
  await page.evaluate(`(() => { const s = document.getElementById('settingsSection'); if (s) s.open = true;
    const t = document.getElementById('diagramTitle'); if (t) t.scrollIntoView({ block: 'center' }); })()`);
  await page.waitForTimeout(500);
  rec.titleBefore = await page.evaluate("document.getElementById('diagramTitle').value");
  const box = await clickSel(page, '#diagramTitle', { clickCount: 3, wait: 250 });
  rec.clickedTitle = !!box;
  if (!box) { rec.skip = 'title not clickable'; return; }
  rec.focusOnTitle = await page.evaluate(ACTIVE);
  await page.keyboard.type('ZZZTEST', { delay: 55 });
  rec.titleTyped = await page.evaluate("document.getElementById('diagramTitle').value");
  rec.tourBeforeEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  rec.titleAfterEsc = await page.evaluate("document.getElementById('diagramTitle').value");
  rec.tourAfterEsc = await page.evaluate(TOUR);
  rec.focusAfterEsc = await page.evaluate(ACTIVE);
  rec.previewAfterEsc = await page.evaluate("(document.getElementById('diagramTitlePreview')||{}).textContent");
};

/* ---- 3. the command palette owns its own Escape ---- */
SCENARIOS['command-palette'] = async (page, rec) => {
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(700);
  rec.paletteOpen = await page.evaluate("(() => { const p = document.getElementById('commandPalette'); return !!p && !p.hidden; })()");
  await page.keyboard.type('exp', { delay: 55 });
  await page.waitForTimeout(300);
  rec.focusInPalette = await page.evaluate(ACTIVE);
  rec.tourBeforeEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  rec.paletteAfterEsc = await page.evaluate("(() => { const p = document.getElementById('commandPalette'); return !!p && !p.hidden; })()");
  rec.tourAfterEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  rec.tourAfterSecondEsc = await page.evaluate(TOUR);
};

/* ---- 4. a native <dialog> must get Escape BEFORE the tour ---- */
SCENARIOS['native-dialog'] = async (page, rec) => {
  const tab = await page.evaluate(`(() => { const t = document.querySelector('.diagram-tab'); if (!t) return null;
    const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (tab) {
    await page.mouse.click(tab.x, tab.y, { button: 'right' });
    await page.waitForTimeout(500);
    const item = await page.evaluate(`(() => {
      const it = Array.from(document.querySelectorAll('.struct-menu-item, [role=menuitem], button'))
        .find(b => /rename/i.test(b.textContent || '') && b.getBoundingClientRect().width > 4);
      if (!it) return null; const r = it.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (item) { await page.mouse.click(item.x, item.y); await page.waitForTimeout(700); }
  }
  rec.dialogOpen = await page.evaluate("(() => { const d = document.querySelector('dialog[open]'); return d ? (d.id || 'unnamed') : null; })()");
  rec.tourBeforeEsc = await page.evaluate(TOUR);
  if (!rec.dialogOpen) { rec.skip = 'no dialog opened'; return; }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  rec.dialogAfterEsc = await page.evaluate("(() => { const d = document.querySelector('dialog[open]'); return d ? (d.id || 'unnamed') : null; })()");
  rec.tourAfterEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  rec.tourAfterSecondEsc = await page.evaluate(TOUR);
};

/* ---- 5. a Docs surface with its own cancel: the find bar, over a real document ---- */
SCENARIOS['docs-find'] = async (page, rec) => {
  await clickSel(page, '#workpapersButton', { wait: 1400 });
  rec.docsOpen = await page.evaluate("(() => { const w = document.getElementById('wpWorkspace'); return !!w && !w.hidden; })()");
  rec.tourAfterOpeningDocs = await page.evaluate(TOUR);
  // Create a document so there is something to search.
  await clickSel(page, '#wpEmptyNewButton, #wpNewButton', { wait: 700 });
  rec.tourAfterNewButton = await page.evaluate(TOUR);
  const type = await page.evaluate(`(() => {
    const it = document.querySelector('.struct-menu-item');
    if (!it) return null; const r = it.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: (it.textContent||'').trim().slice(0,24) }; })()`);
  rec.newDocType = type ? type.t : 'NO-TYPE-MENU';
  if (type) { await page.mouse.click(type.x, type.y); await page.waitForTimeout(1400); }
  rec.tourAfterNewDoc = await page.evaluate(TOUR);
  rec.docEditor = await page.evaluate("!!document.querySelector('.wp-surface [contenteditable=\"true\"]')");
  await page.keyboard.press('Control+f');
  await page.waitForTimeout(700);
  rec.findOpen = await page.evaluate("(() => { const f = document.getElementById('wpFindBar'); return !!f && !f.hidden; })()");
  rec.focusInFind = await page.evaluate(ACTIVE);
  if (rec.findOpen) { await page.keyboard.type('a', { delay: 60 }); await page.waitForTimeout(400); }
  rec.tourBeforeEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  rec.findAfterEsc = await page.evaluate("(() => { const f = document.getElementById('wpFindBar'); return !!f && !f.hidden; })()");
  rec.tourAfterEsc = await page.evaluate(TOUR);
};

/* ---- 6. CONTROL: plain Escape on nobody's field must still end the tour ---- */
SCENARIOS['plain-escape'] = async (page, rec) => {
  rec.clickedAway = await clickNeutral(page);
  rec.focusBeforeEsc = await page.evaluate(ACTIVE);
  rec.tourBeforeEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  rec.tourAfterEsc = await page.evaluate(TOUR);
};

/* ---- 7. Escape from inside the code editor ---- */
SCENARIOS['editor-escape'] = async (page, rec) => {
  const box = await focusEditor(page);
  rec.clickedEditor = !!box;
  rec.focusBeforeEsc = await page.evaluate(ACTIVE);
  rec.tourBeforeEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  rec.focusAfterEsc = await page.evaluate(ACTIVE);
  rec.tourAfterEsc = await page.evaluate(TOUR);
  rec.sourceIntact = (await page.evaluate("document.getElementById('source').value")).length;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  rec.tourAfterSecondEsc = await page.evaluate(TOUR);
};

/* ---- 8. inspector open, focus NOT in the label: who gets Escape ---- */
SCENARIOS['inspector-open-escape'] = async (page, rec) => {
  rec.fixtureOk = (await setSourceChecked(page, FIXTURE)).ok;
  const hit = await clickNode(page, 'A');
  rec.clickedOn = hit ? hit.topmost : 'NODE-NOT-FOUND';
  rec.inspectorOpen = await page.evaluate(INSP);
  rec.focusBeforeEsc = await page.evaluate(ACTIVE);
  rec.tourBeforeEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  rec.inspectorAfterEsc = await page.evaluate(INSP);
  rec.tourAfterEsc = await page.evaluate(TOUR);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  rec.tourAfterSecondEsc = await page.evaluate(TOUR);
};

/* ---- 9. persistence: Escape-dismiss must survive a reload ---- */
SCENARIOS['escape-persists'] = async (page, rec) => {
  await clickNeutral(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  rec.tourAfterEsc = await page.evaluate(TOUR);
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'load' });
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate("!!document.querySelector('#diagram svg')")) break;
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(6000);
  rec.tourAfterReload = await page.evaluate(TOUR);
};

/* ---- 9b. POSITIVE CONTROL for 9: no Escape, reload, the tour must come back ---- */
SCENARIOS['noescape-reload-control'] = async (page, rec) => {
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'load' });
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate("!!document.querySelector('#diagram svg')")) break;
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(6000);
  rec.tourAfterReload = await page.evaluate(TOUR);
};

(async () => {
  const session = await openSession(APP, PORT);
  const out = { app: APP, scenarios: [] };
  const names = ONLY ? ONLY.split(',') : Object.keys(SCENARIOS);
  for (const name of names) {
    const body = SCENARIOS[name];
    if (!body) { console.log('  ?? unknown scenario ' + name); continue; }
    const h = await session.freshPage();
    const rec = { name };
    try {
      rec.tourWaitMs = await waitTour(h.page, 12000);
      rec.tourAtStart = await h.page.evaluate(TOUR);
      await body(h.page, rec);
    } catch (e) { rec.threw = String(e.message).slice(0, 240); }
    rec.errors = h.errors.slice(0, 8);
    await h.dispose();
    console.log('  ' + name + ' -> ' + JSON.stringify(rec));
    out.scenarios.push(rec);
  }
  await session.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(1); });
