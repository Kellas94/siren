#!/usr/bin/env node
/* The three fixes cut for 1.70.0, measured the same way on the build that has them and the build
 * that does not, so every claim carries its own positive control.
 *
 *   1. the second editor tab is no longer painted unavailable while it works
 *   2. the editor heading names the editor that is actually on screen
 *   3. a context menu heading built from a name somebody typed wraps instead of being cut
 *
 * Every reading below is taken with a real mouse press or real typing. The tab test in particular
 * must NOT be driven by .click() from inside the page: the whole defect is that the control carries
 * aria-disabled while remaining pointer-operable, and only a real press distinguishes the two.
 *
 * Emits one line beginning RESULT= with the whole measurement as JSON, so two runs can be compared
 * by a machine rather than by eye.
 *
 * Usage: node verify_170_fixes.js --app <path> [--port 9950]
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/r10fix/app.html');
const PORT = Number(arg('port', '9950'));
const NL = String.fromCharCode(10);

const LONG_NAME = '2026_Q3_Revenue_Recognition_Walkthrough_Workpaper_FINAL_v2';

const SOURCES = {
  flowchart:        ['flowchart TD', '  A[Purchase request] --> B{Approved}', '  B --> C[Raise order]'].join(NL),
  sequenceDiagram:  ['sequenceDiagram', '  Alice->>Bob: Send the request', '  Bob-->>Alice: Approve'].join(NL),
  pie:              ['pie title Spend', '  "Audit" : 40', '  "Tax" : 60'].join(NL),
  classDiagram:     ['classDiagram', '  class Order', '  Order : +id'].join(NL),
  'stateDiagram-v2':['stateDiagram-v2', '  [*] --> Draft', '  Draft --> Filed'].join(NL),
  mindmap:          ['mindmap', '  root((Audit))', '    Scope', '    Testing'].join(NL)
};

/* What the tab tells a person before anybody touches it. */
const READ_TAB = `(() => {
  const b = document.getElementById('visualModeButton');
  if (!b) return JSON.stringify({ absent: true });
  const cs = getComputedStyle(b);
  const r = b.getBoundingClientRect();
  return JSON.stringify({
    label: (b.textContent || '').trim(),
    slot: b.dataset.slot || null,
    title: b.title || null,
    ariaDisabled: b.getAttribute('aria-disabled'),
    unavailable: b.classList.contains('is-unavailable'),
    opacity: cs.opacity,
    cursor: cs.cursor,
    pointerEvents: cs.pointerEvents,
    box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
  });
})()`;

/* What a person is looking at afterwards. */
const READ_EDITOR = `(() => {
  const rows = document.querySelectorAll('#structureRows .struct-code').length;
  const se = document.getElementById('structureEditor');
  const ce = document.getElementById('codeEditor');
  const vp = document.getElementById('visualModePanel');
  const sp = document.getElementById('sequencePanel');
  const vis = e => !!(e && !e.hidden && e.getBoundingClientRect().height > 2);
  return JSON.stringify({
    heading: (document.getElementById('editorHeading') || {}).textContent,
    sub: ((document.getElementById('editorSubheading') || {}).textContent || '').slice(0, 46),
    guidedRows: rows,
    guidedShowing: vis(se),
    textShowing: vis(ce),
    visualShowing: vis(vp),
    sequenceShowing: vis(sp)
  });
})()`;

/* The heading of whatever menu is open, and how far past the clip edge its text runs.
   The clip edge is the PADDING box - rect.left + borderLeft + clientWidth - because that is
   where overflow:auto actually clips. An earlier harness used the content box and reported
   every cut 5px too large. */
const READ_MENU_HEADING = `(() => {
  const m = document.querySelector('.struct-menu');
  if (!m) return JSON.stringify({ noMenu: true });
  const head = m.querySelector('.struct-menu-heading');
  if (!head) return JSON.stringify({ noHeading: true, menuText: (m.textContent || '').slice(0, 40) });
  const cs = getComputedStyle(m);
  const mr = m.getBoundingClientRect();
  const clipEdge = mr.left + parseFloat(cs.borderLeftWidth || '0') + m.clientWidth;
  const range = document.createRange();
  range.selectNodeContents(head);
  const rects = Array.from(range.getClientRects()).filter(r => r.width > 0.01);
  const textRight = rects.length ? Math.max.apply(null, rects.map(r => r.right)) : mr.left;
  return JSON.stringify({
    text: (head.textContent || '').trim(),
    lines: rects.length,
    menuBox: [Math.round(mr.left * 10) / 10, Math.round(mr.width * 10) / 10],
    clipEdge: Math.round(clipEdge * 10) / 10,
    textRight: Math.round(textRight * 10) / 10,
    cut: Math.round((textRight - clipEdge) * 10) / 10,
    hScroll: m.scrollWidth - m.clientWidth
  });
})()`;

/* The welcome tour arms on a timer AFTER the shared settle has finished looking for it, so it can
   arrive mid-probe and swallow every click - which is the AV defect itself, met here as a harness
   problem. Sweep it for a few seconds before driving anything. */
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

async function rightClickTab(page) {
  const box = JSON.parse(await page.evaluate(`(() => {
    const t = document.querySelector('.diagram-tab');
    if (!t) return JSON.stringify(null);
    const r = t.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return JSON.stringify(null);
    return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, name: (t.textContent || '').trim() });
  })()`));
  if (!box) return null;
  await page.mouse.click(box.x, box.y, { button: 'right' });
  await page.waitForTimeout(450);
  return box;
}

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  const out = { app: APP, tabs: {}, headingTrip: {}, menuHeading: {}, rename: null, errors: [] };
  await killTour(page);

  // ---------- 1 + 2: the tab, and where pressing it lands ----------
  for (const [type, src] of Object.entries(SOURCES)) {
    await setSource(page, src, 2600);
    // Start every type from the same place, so the reading is about the type and not about
    // whatever the previous type left behind.
    await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
    await page.waitForTimeout(350);
    await page.evaluate(`(() => { document.getElementById('textModeButton')?.click(); })()`);
    await page.waitForTimeout(350);

    const before = JSON.parse(await page.evaluate(READ_TAB));
    const rest = JSON.parse(await page.evaluate(READ_EDITOR));

    // A REAL press. Playwright refuses aria-disabled elements through the locator API, which is
    // the point of the finding, so this goes through raw mouse coordinates and reports whether
    // the higher-level route would have refused.
    let locatorRefused = null;
    try {
      await page.locator('#visualModeButton').click({ timeout: 2500 });
      locatorRefused = false;
    } catch (e) {
      locatorRefused = String(e.message).slice(0, 60);
      await page.mouse.click(before.box[0] + before.box[2] / 2, before.box[1] + before.box[3] / 2);
    }
    await page.waitForTimeout(900);
    const after = JSON.parse(await page.evaluate(READ_EDITOR));
    out.tabs[type] = { before, restingHeading: rest.heading, locatorRefused, after };
  }

  // ---------- 2b: the heading follows the Text / Guided switch both ways ----------
  await setSource(page, SOURCES.flowchart, 2600);
  await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
  await page.waitForTimeout(400);
  await page.locator('#textModeButton').click();
  await page.waitForTimeout(600);
  out.headingTrip.text = JSON.parse(await page.evaluate(READ_EDITOR));
  await page.locator('#structureModeButton').click();
  await page.waitForTimeout(800);
  out.headingTrip.guided = JSON.parse(await page.evaluate(READ_EDITOR));
  await page.locator('#textModeButton').click();
  await page.waitForTimeout(600);
  out.headingTrip.backToText = JSON.parse(await page.evaluate(READ_EDITOR));
  await page.locator('#visualModeButton').click();
  await page.waitForTimeout(800);
  out.headingTrip.visual = JSON.parse(await page.evaluate(READ_EDITOR));

  // ---------- 3: a menu heading built from a name somebody typed ----------
  // Renamed through the app's own dialog, reached from the tab's own menu, with real typing.
  const tab = await rightClickTab(page);
  if (tab) {
    const opened = await page.evaluate(`(async () => {
      const m = document.querySelector('.struct-menu');
      if (!m) return 'no menu';
      const row = Array.from(m.querySelectorAll('.struct-menu-item')).find(b => /rename/i.test(b.textContent));
      if (!row) return 'no rename row: ' + Array.from(m.querySelectorAll('.struct-menu-item')).map(b => b.textContent.trim()).join(' | ');
      row.click();
      await new Promise(r => setTimeout(r, 600));
      return document.getElementById('renameDialog')?.open ? 'dialog open' : 'dialog did not open';
    })()`);
    if (opened === 'dialog open') {
      await page.locator('#renameDialogInput').fill('');
      await page.locator('#renameDialogInput').type(LONG_NAME, { delay: 12 });
      await page.evaluate(`(() => {
        const d = document.getElementById('renameDialog');
        const b = Array.from(d.querySelectorAll('button')).find(x => /^rename$/i.test(x.textContent.trim()));
        (b || d.querySelector('button[type="submit"]')).click();
      })()`);
      await page.waitForTimeout(900);
    }
    out.rename = { opened, tabNow: await page.evaluate(`(document.querySelector('.diagram-tab')||{}).textContent`) };
  } else {
    out.rename = { opened: 'no tab to right-click' };
  }

  for (const w of [1440, 480, 412, 375, 320]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const box = await rightClickTab(page);
    if (!box) { out.menuHeading[w] = { unreachable: 'the tab is not visible at this width' }; continue; }
    out.menuHeading[w] = JSON.parse(await page.evaluate(READ_MENU_HEADING));
    if (w === 412) await page.screenshot({ path: APP.replace(/[^/]+$/, '') + 'menu_heading_412.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }

  out.errors = errors.slice(0, 6);
  await close();
  console.log('RESULT=' + JSON.stringify(out));
})();
