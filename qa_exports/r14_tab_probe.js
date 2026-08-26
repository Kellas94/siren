#!/usr/bin/env node
/* Round 14, deletion 6: the tour's Tab capture branch is gone.
 *
 *   (a) does Tab now do its own job again - indent in the editor, move through the Visual
 *       builder without discarding a typed label, walk the header and panel controls, and
 *       navigate an open menu - both WITH the tour up and with it dismissed
 *   (b) the branch existed so the tour card was REACHABLE. How many Tab presses does it take
 *       now, from a first-run context with empty storage?
 *
 * Usage: node r14_tab_probe.js --app <path> --port <n> --out <json>
 */
const fs = require('fs');
const { openSession, waitTour, skipTour, setSourceChecked, ACTIVE } = require('./r14_tourlib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round14/app.html');
const PORT = Number(arg('port', '9713'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/r14_tab_out.json');
const ONLY = arg('only', '');
const NL = String.fromCharCode(10);

const FIXTURE = ['flowchart TD', '  A[State] --> B[Second block]', '  B --> C[Third block]'].join(NL);
const TOUR = "(() => { const c = document.querySelector('.tour-card'); return c ? (c.querySelector('strong')||{}).textContent : null; })()";

/* Everything the browser would put in the tab ring right now, in document order, so the walk
   below can be scored against a real denominator instead of a remembered number. */
const TABBABLES = `(() => {
  const sel = 'a[href], button, input, select, textarea, [tabindex]';
  const all = Array.from(document.querySelectorAll(sel)).filter(n => {
    if (n.disabled) return false;
    const ti = n.getAttribute('tabindex');
    if (ti !== null && Number(ti) < 0) return false;
    if (n.type === 'hidden') return false;
    if (n.closest('[hidden]')) return false;
    const r = n.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    return true;
  });
  const key = n => (n.id ? '#' + n.id : n.tagName.toLowerCase() + '[' + ((n.getAttribute('aria-label') || n.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 20)) + ']');
  const header = all.filter(n => n.closest('header, .app-header, .topbar, .app-topbar, .diagram-workspace-bar'));
  const panel = all.filter(n => n.closest('.side-panel, .panel, aside, .editor-pane, .controls'));
  return {
    total: all.length,
    headerCount: header.length,
    headerKeys: header.map(key),
    panelCount: panel.length,
    inTourCard: all.filter(n => n.closest('.tour-card')).length
  };
})()`;

/* The 19 real header and panel controls a 26-press walk reaches on a build where Tab works. Taken
   from the tour-dismissed walk, not from memory: the three raw-Mermaid line spans, the three
   disclosure summaries below the editor and the splitter handle are tab stops too, but they are
   not controls, so they are not in the denominator. */
const THE_19 = [
  'button[Diagram 1', 'button#findDiagramButton', 'button#addDiagramButton', 'button#diagramMoreButton',
  'button#codeModeButton', 'button#workpapersButton', 'button#undoButton', 'button#undoHistoryButton',
  'summary[Diagram type', 'button#textModeButton', 'button#structureModeButton', 'button#popOutEditorButton',
  'button#copyButton', 'button#zoomChipButton', 'button#zoomMenuButton', 'button#filterButton',
  'button#previewViewButton', 'button#previewInspectButton', 'button#presentButton'
];

async function clickNeutral(page) {
  const pt = await page.evaluate(`(() => {
    for (let y = 120; y < window.innerHeight - 40; y += 25) {
      for (let x = 40; x < window.innerWidth - 40; x += 35) {
        const e = document.elementFromPoint(x, y);
        if (!e) continue;
        if (e.closest('.tour-card, dialog, a, button, input, select, textarea, [contenteditable], summary, label')) continue;
        if (e.closest('#diagram, .tour-highlight, #nodeInspector, #commandPalette')) continue;
        return { x, y };
      }
    }
    return null;
  })()`);
  if (pt) { await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(400); }
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

/* Press Tab n times with REAL key presses, recording who ends up with focus each time. */
async function tabWalk(page, n, back) {
  const seq = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    await page.waitForTimeout(45);
    seq.push(await page.evaluate(ACTIVE));
  }
  return seq;
}

/* How many presses until focus is inside the tour card. -1 means it never got there. */
async function tabsToCard(page, cap) {
  for (let i = 1; i <= cap; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(35);
    const inCard = await page.evaluate("(() => { const a = document.activeElement; return !!(a && a.closest && a.closest('.tour-card')); })()");
    if (inCard) return i;
  }
  return -1;
}

/* The three (a) readings, run identically with the tour up and with it dismissed. */
async function measureTabWork(page, rec, tag) {
  // --- editor indent ---
  await clickSel(page, '#codeModeButton');
  await clickSel(page, '#textModeButton');
  await setSourceChecked(page, FIXTURE, 1800);
  const box = await page.evaluate(`(() => { const s = document.getElementById('source');
    const r = s.getBoundingClientRect(); return r.width < 5 ? null : { x: r.left + 70, y: r.top + 24 }; })()`);
  if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(300); }
  rec[tag + '_editorFocus'] = await page.evaluate(ACTIVE);
  const beforeLen = await page.evaluate("document.getElementById('source').value.length");
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  rec[tag + '_editorLenBefore'] = beforeLen;
  rec[tag + '_editorLenAfter'] = await page.evaluate("document.getElementById('source').value.length");
  rec[tag + '_editorIndented'] = rec[tag + '_editorLenAfter'] === beforeLen + 4;
  rec[tag + '_editorFocusAfterTab'] = await page.evaluate(ACTIVE);

  // The indent test just wrote four spaces into the middle of "flowchart TD" on whichever build
  // let it through, and an unparseable source refuses to open the Visual builder at all. Put the
  // fixture back so the next reading is about Tab and not about a broken diagram.
  await setSourceChecked(page, FIXTURE, 1800);
  rec[tag + '_fixtureRestored'] = await page.evaluate("document.getElementById('source').value.length");

  // --- Visual builder: type a label, press Tab, see if the label survives and where focus goes ---
  await clickSel(page, '#visualModeButton', { wait: 900 });
  rec[tag + '_visualPanel'] = await page.evaluate("(() => { const p = document.getElementById('visualModePanel'); return !!p && !p.hidden; })()");
  const lab = await clickSel(page, '#visualNodeLabel', { wait: 300 });
  rec[tag + '_labelClicked'] = !!lab;
  if (lab) {
    await page.keyboard.type('Review request', { delay: 45 });
    rec[tag + '_labelTyped'] = await page.evaluate("document.getElementById('visualNodeLabel').value");
    rec[tag + '_nodesBefore'] = await page.evaluate("(document.getElementById('visualNodeCount')||{}).textContent");
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    rec[tag + '_labelAfterTab'] = await page.evaluate("document.getElementById('visualNodeLabel').value");
    rec[tag + '_focusAfterTabInBuilder'] = await page.evaluate(ACTIVE);
    // Keep tabbing until the Add block button has focus, then press it with the keyboard.
    let reached = -1;
    for (let i = 1; i <= 12; i++) {
      const on = await page.evaluate("document.activeElement && document.activeElement.id");
      if (on === 'addVisualNodeButton') { reached = i - 1; break; }
      await page.keyboard.press('Tab');
      await page.waitForTimeout(60);
    }
    rec[tag + '_tabsToAddBlock'] = reached;
    if (reached >= 0) {
      rec[tag + '_labelAtAddBlock'] = await page.evaluate("document.getElementById('visualNodeLabel').value");
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1400);
      rec[tag + '_nodesAfter'] = await page.evaluate("(document.getElementById('visualNodeCount')||{}).textContent");
      rec[tag + '_sourceHasBlock'] = (await page.evaluate("document.getElementById('source').value")).indexOf('Review request') >= 0;
    }
  }

  // --- the header / panel walk ---
  await clickSel(page, '#codeModeButton');
  await clickSel(page, '#textModeButton');
  await clickNeutral(page);
  rec[tag + '_ring'] = await page.evaluate(TABBABLES);
  const fwd = await tabWalk(page, 22, false);
  // Forwards, Tab is legitimately swallowed by the code editor - that is the editor's own indent,
  // not a refusal. The preview-side controls sit past it, so they are counted on a BACKWARDS walk
  // from the same neutral start, which wraps round the end of the document. Same two walks on
  // both builds; nothing here is build-specific.
  await clickNeutral(page);
  const back = await tabWalk(page, 14, true);
  // The preview toolbar sits past the editor in document order, so neither of the two walks above
  // arrives there. Start a third one from empty preview space and step backwards into it.
  const pv = await page.evaluate(`(() => {
    const pane = document.querySelector('#zoomViewport, .preview-pane');
    if (!pane) return null;
    const r = pane.getBoundingClientRect();
    for (let dy = 12; dy < r.height - 12; dy += 14) {
      for (let dx = 8; dx < r.width - 8; dx += 18) {
        const x = r.left + dx, y = r.top + dy;
        const e = document.elementFromPoint(x, y);
        if (!e) continue;
        if (e.closest('.tour-card, #nodeInspector, g.node, [data-node-id], path, button, a, input')) continue;
        return { x, y };
      }
    }
    return null;
  })()`);
  if (pv) { await page.mouse.click(pv.x, pv.y); await page.waitForTimeout(400); }
  const prev = pv ? await tabWalk(page, 12, false) : [];
  const seq = fwd.concat(back, prev);
  rec[tag + '_walkForward'] = fwd;
  rec[tag + '_walkBackward'] = back;
  rec[tag + '_walkPreview'] = prev;
  const distinct = Array.from(new Set(seq.filter(s => s !== 'BODY' && s.indexOf('TOURCARD:') !== 0)));
  rec[tag + '_distinctAppStops'] = distinct.length;
  rec[tag + '_stopsInCard'] = seq.filter(s => s.indexOf('TOURCARD:') === 0).length;
  rec[tag + '_of19'] = THE_19.filter(k => seq.some(s => s.indexOf(k) === 0)).length;
  rec[tag + '_missing19'] = THE_19.filter(k => !seq.some(s => s.indexOf(k) === 0));

  // --- an open menu ---
  await clickSel(page, '#themeMenuButton', { wait: 700 });
  rec[tag + '_themeMenuOpen'] = await page.evaluate("(() => { const m = document.getElementById('themeMenu'); return !!m && !m.hidden; })()");
  if (rec[tag + '_themeMenuOpen']) {
    const before = await page.evaluate(ACTIVE);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    rec[tag + '_menuFocusBefore'] = before;
    rec[tag + '_menuFocusAfterTab'] = await page.evaluate(ACTIVE);
    rec[tag + '_menuStillOpenAfterTab'] = await page.evaluate("(() => { const m = document.getElementById('themeMenu'); return !!m && !m.hidden; })()");
  }
}

const SCENARIOS = {};

/* (b) THE WIN THE BRANCH BOUGHT: how far away is the card now? */
SCENARIOS['tabs-to-tour-card'] = async (page, rec) => {
  rec.tourCardPresent = await page.evaluate(TOUR);
  rec.ring = await page.evaluate(TABBABLES);
  await clickNeutral(page);
  rec.startFocus = await page.evaluate(ACTIVE);
  rec.tabsToCard = await tabsToCard(page, 150);
  rec.focusAtEnd = await page.evaluate(ACTIVE);
  rec.tourStillUp = await page.evaluate(TOUR);
};

/* Same question from the top of the document, in case a neutral click lands mid-ring. */
SCENARIOS['tabs-to-tour-card-from-top'] = async (page, rec) => {
  rec.tourCardPresent = await page.evaluate(TOUR);
  await page.evaluate("(() => { const f = document.querySelector('a[href], button, input, select, textarea'); if (f) f.focus(); })()");
  rec.startFocus = await page.evaluate(ACTIVE);
  rec.tabsToCard = await tabsToCard(page, 150);
  rec.tourStillUp = await page.evaluate(TOUR);
};

/* (a) with the tour ON SCREEN. */
SCENARIOS['tab-work-tour-up'] = async (page, rec) => {
  rec.tourAtStart = await page.evaluate(TOUR);
  await measureTabWork(page, rec, 'up');
  rec.tourAtEnd = await page.evaluate(TOUR);
};

/* (a) with the tour dismissed by its own Skip button. */
SCENARIOS['tab-work-tour-gone'] = async (page, rec) => {
  rec.skipped = await skipTour(page);
  rec.tourAtStart = await page.evaluate(TOUR);
  await measureTabWork(page, rec, 'gone');
};

/* One step sideways: somebody typing a block label presses Tab expecting Add block, then presses
   Enter on whatever it landed on. On a build that yanks focus to the tour card, that Enter is
   Skip - and the label they typed has to survive it. */
SCENARIOS['visual-label-tab-then-enter'] = async (page, rec) => {
  rec.tourAtStart = await page.evaluate(TOUR);
  await setSourceChecked(page, FIXTURE, 1800);
  await clickSel(page, '#visualModeButton', { wait: 1000 });
  rec.visualPanel = await page.evaluate("(() => { const p = document.getElementById('visualModePanel'); return !!p && !p.hidden; })()");
  const lab = await clickSel(page, '#visualNodeLabel', { wait: 300 });
  rec.labelClicked = !!lab;
  if (!lab) { rec.skip = 'no label field'; return; }
  await page.keyboard.type('Review request', { delay: 45 });
  rec.labelTyped = await page.evaluate("document.getElementById('visualNodeLabel').value");
  rec.nodesBefore = await page.evaluate("(document.getElementById('visualNodeCount')||{}).textContent");
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  rec.focusAfterTab = await page.evaluate(ACTIVE);
  rec.labelAfterTab = await page.evaluate("document.getElementById('visualNodeLabel').value");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1400);
  rec.tourAfterEnter = await page.evaluate(TOUR);
  rec.labelAfterEnter = await page.evaluate("document.getElementById('visualNodeLabel').value");
  rec.nodesAfterEnter = await page.evaluate("(document.getElementById('visualNodeCount')||{}).textContent");
  rec.sourceHasBlock = (await page.evaluate("document.getElementById('source').value")).indexOf('Review request') >= 0;
  rec.labelSurvived = rec.labelAfterEnter === 'Review request';
};

/* Shift+Tab, one step sideways from the fixture the branch was written for. */
SCENARIOS['shift-tab-tour-up'] = async (page, rec) => {
  rec.tourAtStart = await page.evaluate(TOUR);
  await clickSel(page, '#codeModeButton');
  await clickSel(page, '#textModeButton');
  await setSourceChecked(page, FIXTURE, 1500);
  const box = await page.evaluate(`(() => { const s = document.getElementById('source');
    const r = s.getBoundingClientRect(); return r.width < 5 ? null : { x: r.left + 70, y: r.top + 40 }; })()`);
  if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(300); }
  // Put the caret on an indented line so an outdent has something to remove.
  await page.evaluate("(() => { const s = document.getElementById('source'); s.setSelectionRange(20, 20); })()");
  const before = await page.evaluate("document.getElementById('source').value.length");
  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(500);
  rec.lenBefore = before;
  rec.lenAfter = await page.evaluate("document.getElementById('source').value.length");
  rec.outdented = rec.lenAfter < before;
  rec.focusAfter = await page.evaluate(ACTIVE);
  rec.tourAtEnd = await page.evaluate(TOUR);
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
