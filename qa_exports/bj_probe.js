/* JOB BJ - navigation keys must not edit the document.
 * Same script drives BASE and MERGED. Every number printed is measured, not read off a diff.
 */
const path = require('path');
const { openApp, setSource } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const LABEL = process.argv[4] || path.basename(APP);

const FIXTURE = [
  'flowchart TD',
  '  A[Start] --> B[Check invoice]',
  '  B --> C[Approve]'
].join('\n');

const out = { label: LABEL, app: APP, steps: [] };
function rec(o) { out.steps.push(o); console.log(JSON.stringify(o)); }

async function src(page) { return page.evaluate(`document.getElementById('source').value`); }

async function selectFirstNode(page) {
  // real mouse click on the first rendered block
  const box = await page.evaluate(`(() => {
    const n = document.querySelector('#diagram g.node, #diagram [data-node-id]');
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`);
  if (!box) return null;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(900);
  return box;
}

async function focusState(page) {
  return page.evaluate(`(() => {
    const a = document.activeElement;
    if (!a) return { tag: 'none' };
    return {
      tag: a.tagName,
      id: a.id || '',
      cls: (a.getAttribute && a.getAttribute('class') || '').slice(0, 70),
      inViewport: !!(a.closest && a.closest('#zoomViewport')),
      label: (a.getAttribute && (a.getAttribute('aria-label') || '')) || (a.textContent || '').trim().slice(0, 40)
    };
  })()`);
}

async function selectionState(page) {
  return page.evaluate(`(() => ({
    handles: document.querySelectorAll('#diagram [data-handle-for]').length,
    selected: document.querySelectorAll('#diagram .canvas-selected, #diagram [data-canvas-selected]').length,
    inspectorOpen: (() => { const i = document.getElementById('nodeInspector'); return !!(i && !i.hidden); })(),
    popover: (() => { const p = document.querySelector('.canvas-popover'); return !!(p && !p.hidden); })(),
    dialogOpen: !!document.querySelector('dialog[open]')
  }))()`);
}

/* Put focus on a real focusable element INSIDE #zoomViewport, the way a keyboard walk does. */
async function focusInsideViewport(page) {
  return page.evaluate(`(() => {
    const vp = document.getElementById('zoomViewport');
    if (!vp) return { ok: false, why: 'no #zoomViewport' };
    const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), svg[tabindex], g[tabindex]';
    const cands = Array.from(vp.querySelectorAll(sel)).filter(e => e.offsetParent !== null || e.ownerSVGElement);
    const list = cands.slice(0, 12).map(e => e.tagName + '#' + (e.id || '') + '.' + ((e.getAttribute('class')||'').split(' ')[0]));
    if (!cands.length) {
      // fall back: make the viewport itself take focus the way the app may
      if (vp.tabIndex >= 0) { vp.focus(); return { ok: document.activeElement === vp, via: 'viewport tabindex', list: [] }; }
      return { ok: false, why: 'no focusable descendant', list: [] };
    }
    cands[0].focus();
    return { ok: !!(document.activeElement && document.activeElement.closest('#zoomViewport')), via: 'descendant', list };
  })()`);
}

async function keyTrial(page, key, setup) {
  await setSource(page, FIXTURE, 1800);
  const prep = await setup(page);
  const before = await src(page);
  const fBefore = await focusState(page);
  const selBefore = await selectionState(page);
  await page.keyboard.press(key);
  await page.waitForTimeout(1100);
  const after = await src(page);
  const fAfter = await focusState(page);
  const selAfter = await selectionState(page);
  return {
    key,
    prep,
    mutated: before !== after,
    beforeLen: before.length,
    afterLen: after.length,
    added: after.length > before.length ? JSON.stringify(after.slice(before.length === 0 ? 0 : 0)).slice(0, 0) : '',
    afterSource: before !== after ? after : null,
    focusBefore: fBefore, focusAfter: fAfter,
    focusMoved: JSON.stringify(fBefore) !== JSON.stringify(fAfter),
    selBefore, selAfter
  };
}

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  try {
    await setSource(page, FIXTURE, 2500);
    const fixture = await src(page);
    rec({ step: 'fixture', ok: fixture === FIXTURE, value: fixture });

    const box = await selectFirstNode(page);
    const selAfterClick = await selectionState(page);
    const focusAfterClick = await focusState(page);
    rec({ step: 'clickNode', box, sel: selAfterClick, focus: focusAfterClick });

    const vpFocus = await focusInsideViewport(page);
    rec({ step: 'focusableInsideViewport', vpFocus });

    // ---- 1. bare navigation keys, focus INSIDE the preview viewport, node selected ----
    const setupSelectedInViewport = async (p) => {
      await selectFirstNode(p);
      const f = await focusInsideViewport(p);
      return { mode: 'node selected + focus inside #zoomViewport', vp: f };
    };
    const KEYS = ['Tab', 'Shift+Tab', 'Enter', 'ArrowDown', 'Space', 'Home', 'End', 'PageDown'];
    for (const k of KEYS) {
      const r = await keyTrial(page, k, setupSelectedInViewport);
      rec({ step: 'key_selected_viewport', ...r });
    }

    // ---- 1b. same keys with focus left on BODY after clicking the node ----
    const setupSelectedBody = async (p) => {
      await selectFirstNode(p);
      await p.evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
      return { mode: 'node selected, focus on body' };
    };
    for (const k of KEYS) {
      const r = await keyTrial(page, k, setupSelectedBody);
      rec({ step: 'key_selected_body', ...r });
    }

    // ---- 2. THE ROUTE THAT MUST SURVIVE: Ctrl+Enter / Ctrl+Shift+Enter ----
    for (const combo of ['Control+Enter', 'Control+Shift+Enter']) {
      await setSource(page, FIXTURE, 1800);
      await selectFirstNode(page);
      const before = await src(page);
      await page.keyboard.press(combo);
      await page.waitForTimeout(900);
      const sel = await selectionState(page);
      const pop = await page.evaluate(`(() => {
        const p = document.querySelector('.canvas-popover');
        if (!p) return { present: false };
        return { present: true, hidden: !!p.hidden, role: p.getAttribute('data-role') || '',
                 inputs: p.querySelectorAll('input').length,
                 focus: document.activeElement ? document.activeElement.tagName + '.' + (document.activeElement.getAttribute('class')||'').split(' ')[0] : 'none' };
      })()`);
      // drive it to completion the way a person would
      let created = null;
      if (pop.present && !pop.hidden) {
        await page.keyboard.type('Recon step');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1400);
        const after = await src(page);
        created = { mutated: after !== before, after };
      }
      rec({ step: 'creationRoute', combo, before, pop, sel, created });
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }

    // ---- 3. sideways: Tab with NOTHING selected ----
    await setSource(page, FIXTURE, 1800);
    await page.evaluate(`(() => { const vp = document.getElementById('zoomViewport'); const r = vp.getBoundingClientRect(); return r; })()`);
    const vpRect = await page.evaluate(`(() => { const r = document.getElementById('zoomViewport').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
    // click an empty patch of canvas, bottom-left corner of the viewport
    await page.mouse.click(vpRect.x + 25, vpRect.y + vpRect.h - 25);
    await page.waitForTimeout(700);
    {
      const sel = await selectionState(page);
      const before = await src(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(1000);
      const after = await src(page);
      rec({ step: 'tab_nothing_selected', sel, mutated: before !== after, focusAfter: await focusState(page), after: before !== after ? after : null });
    }

    // ---- 3b. Tab in Guided rows ----
    await setSource(page, FIXTURE, 1800);
    const guidedRows = await page.evaluate(`(async () => {
      document.getElementById('codeModeButton')?.click();
      await new Promise(r => setTimeout(r, 500));
      document.getElementById('structureModeButton')?.click();
      await new Promise(r => setTimeout(r, 1200));
      return document.querySelectorAll('#structureRows .struct-code').length;
    })()`);
    {
      const firstRow = await page.evaluate(`(() => {
        const r = document.querySelector('#structureRows .struct-code');
        if (!r) return null;
        const b = r.getBoundingClientRect();
        return { x: b.left + Math.min(30, b.width/2), y: b.top + b.height/2 };
      })()`);
      let res = { rows: guidedRows, clicked: firstRow };
      if (firstRow) {
        await page.mouse.click(firstRow.x, firstRow.y);
        await page.waitForTimeout(600);
        const before = await src(page);
        const fB = await focusState(page);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(900);
        const after = await src(page);
        res = { ...res, mutated: before !== after, focusBefore: fB, focusAfter: await focusState(page), after: before !== after ? after : null };
      }
      rec({ step: 'tab_guided', ...res });
    }
    // back to text view
    await page.evaluate(`(() => { document.querySelector('.layout-switch button')?.click(); })()`);
    await page.waitForTimeout(500);

    // ---- 3c. Tab with the inspector open ----
    await setSource(page, FIXTURE, 1800);
    await selectFirstNode(page);
    {
      const insp = await page.evaluate(`(() => {
        const i = document.getElementById('nodeInspector');
        return { present: !!i, hidden: i ? !!i.hidden : null };
      })()`);
      const before = await src(page);
      const fB = await focusState(page);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(900);
      const after = await src(page);
      rec({ step: 'tab_inspector', insp, mutated: before !== after, focusBefore: fB, focusAfter: await focusState(page), after: before !== after ? after : null });
    }

    // ---- 3d. Tab inside Docs ----
    await setSource(page, FIXTURE, 1500);
    const docs = await page.evaluate(`(async () => {
      const b = document.getElementById('workpapersButton');
      if (!b) return { opened: false, why: 'no #workpapersButton' };
      b.click();
      await new Promise(r => setTimeout(r, 1500));
      const w = document.getElementById('wpWorkspace');
      return { opened: !!(w && !w.hidden) };
    })()`);
    {
      let res = { docs };
      if (docs.opened) {
        const target = await page.evaluate(`(() => {
          const ed = document.querySelector('#wpWorkspace [contenteditable="true"]');
          if (!ed) return null;
          const r = ed.getBoundingClientRect();
          return { x: r.left + Math.min(40, r.width/2), y: r.top + Math.min(14, r.height/2) };
        })()`);
        if (target) { await page.mouse.click(target.x, target.y); await page.waitForTimeout(500); }
        const before = await src(page);
        const fB = await focusState(page);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(900);
        const after = await src(page);
        res = { ...res, target, mutated: before !== after, focusBefore: fB, focusAfter: await focusState(page), after: before !== after ? after : null };
      }
      rec({ step: 'tab_docs', ...res });
      await page.evaluate(`(() => { document.getElementById('wpCloseButton')?.click(); document.getElementById('workpapersButton')?.click(); })()`).catch(() => {});
      await page.waitForTimeout(800);
    }

    rec({ step: 'pageErrors', errors: errors.slice(0, 20), count: errors.length });
  } catch (e) {
    rec({ step: 'FATAL', error: String(e && e.stack || e).slice(0, 900) });
  } finally {
    console.log('BJ_JSON ' + JSON.stringify(out));
    await close();
  }
})();
