/* SKEPTIC probe for job BE - the workpaper marker route.
 * Run: node skep_be1.js <appPath> <port> <tag>
 * Drives real input only. Writes skep_be1_<tag>.json
 */
const fs = require('fs');
const { openApp, setSource } = require('./r7_lib.js');

const APP = process.argv[2];
const PORT = Number(process.argv[3]);
const TAG = process.argv[4];

const FIX = 'flowchart TD\n  A[Alpha step] --> B[Bravo step]\n  B --> C[Charlie step]\n  D[Delta step] --> A\n';

const out = { tag: TAG, app: APP, steps: [], errors: [] };
function rec(id, value) { out.steps.push({ id, value }); console.log('[' + id + '] ' + JSON.stringify(value)); }

async function killTour(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const n = await page.evaluate(`(() => {
      let n = 0;
      document.querySelectorAll('.tour-card button').forEach(b => {
        if (/skip|done|got it|close|next|finish/i.test(b.textContent)) { b.click(); n++; }
      });
      return n;
    })()`);
    if (!n) await page.waitForTimeout(250);
  }
}

async function state(page) {
  return page.evaluate(`(() => {
    const wp = document.getElementById('wpWorkspace');
    const insp = document.getElementById('nodeInspector') || document.querySelector('[id*="odeInspector"]');
    const inplace = document.getElementById('canvasInplace');
    const dlg = document.querySelector('dialog[open]');
    return {
      docsOpen: !!(wp && !wp.hidden),
      inspectorOpen: !!(insp && !insp.hidden && getComputedStyle(insp).display !== 'none'),
      inplaceOpen: !!(inplace && !inplace.hidden && getComputedStyle(inplace).display !== 'none'),
      inplaceValue: inplace ? inplace.value : null,
      dialogOpen: dlg ? (dlg.id || dlg.getAttribute('aria-label') || 'dialog') : null,
      source: document.getElementById('source').value,
      focus: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
      connectMode: document.body.classList.contains('connect-mode'),
      status: (document.getElementById('statusText') || {}).textContent || null,
      docCount: (window.state && window.state.workpapers) ? window.state.workpapers.length : -1
    };
  })()`);
}

async function markerRect(page, nodeId) {
  return page.evaluate(`(() => {
    const m = document.querySelector('#diagram [data-t-workpaper-node="' + ${JSON.stringify(nodeId)} + '"]');
    if (!m) return null;
    const hit = m.querySelector('rect') || m;
    const r = hit.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  })()`);
}

async function nodeRect(page, nodeId) {
  return page.evaluate(`(() => {
    const g = Array.from(document.querySelectorAll('#diagram g.node')).find(n => (n.id || '').includes('-' + ${JSON.stringify(nodeId)} + '-'));
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  })()`);
}

async function closeDocs(page) {
  await page.evaluate(`(() => { const b = document.getElementById('closeWpButton'); if (b && !document.getElementById('wpWorkspace').hidden) b.click(); })()`);
  await page.waitForTimeout(400);
}

async function resetUi(page) {
  await closeDocs(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // click empty canvas far from anything
  await page.mouse.click(300, 820);
  await page.waitForTimeout(400);
  await closeDocs(page);
  await page.waitForTimeout(200);
}

async function makeDoc(page, nodeId) {
  const nr = await nodeRect(page, nodeId);
  await page.mouse.click(nr.cx, nr.cy);
  await page.waitForTimeout(600);
  await page.evaluate(`(() => {
    const list = document.getElementById('nodeDocList');
    const det = list && list.closest('details');
    if (det) det.open = true;
  })()`);
  await page.waitForTimeout(300);
  await page.evaluate(`(() => { const b = document.getElementById('nodeDocNewButton'); if (b) b.scrollIntoView({ block: 'center' }); })()`);
  await page.waitForTimeout(400);
  const btn = await page.evaluate(`(() => {
    const b = document.getElementById('nodeDocNewButton');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 && r.y > 0 && r.y < innerHeight };
  })()`);
  if (!btn || !btn.vis) return { made: false, why: 'nodeDocNewButton not visible' };
  await page.mouse.click(btn.x, btn.y);
  await page.waitForTimeout(900);
  // wpTitle is focused and selected right after creation - type a distinguishable name.
  await page.keyboard.type('DOC-FOR-' + nodeId, { delay: 25 });
  await page.waitForTimeout(600);
  const title = await page.evaluate(`(document.getElementById('wpTitle')||{}).value`);
  await closeDocs(page);
  await page.waitForTimeout(900);
  return { made: true, title };
}

(async () => {
  const app = await openApp(APP, PORT, { width: 1440, height: 900 });
  const page = app.page;
  try {
    await killTour(page, 4000);
    await setSource(page, FIX, 3200);
    await killTour(page, 1500);
    rec('fixture_source_ok', (await page.evaluate(`document.getElementById('source').value`)).includes('Bravo step'));
    rec('node_count', await page.evaluate(`document.querySelectorAll('#diagram g.node').length`));

    // --- create a document on B, then one on A (two markers) ---
    rec('makeDocB', await makeDoc(page, 'B'));
    await resetUi(page);
    rec('makeDocA', await makeDoc(page, 'A'));
    await resetUi(page);
    rec('markers', await page.evaluate(`document.querySelectorAll('#diagram [data-t-workpaper-node]').length`));

    const mB = await markerRect(page, 'B');
    const mA = await markerRect(page, 'A');
    const nB = await nodeRect(page, 'B');
    const nC = await nodeRect(page, 'C');
    rec('geom', { mB, mA, nB, nC });
    if (!mB || !mA) throw new Error('markers missing');

    const srcBefore = await page.evaluate(`document.getElementById('source').value`);

    // ================= T1: plain marker click, timing =================
    {
      await resetUi(page);
      const t0 = Date.now();
      await page.mouse.click(mB.cx, mB.cy);
      let ms = -1;
      for (let i = 0; i < 60; i++) {
        const open = await page.evaluate(`!document.getElementById('wpWorkspace').hidden`);
        if (open) { ms = Date.now() - t0; break; }
        await page.waitForTimeout(25);
      }
      rec('T1_plain_click_opens_docs_ms', ms);
      rec('T1_state', await state(page));
      await resetUi(page);
    }

    // ================= T2: IMPATIENT DOUBLE-CLICK on the marker =================
    // The advertised action is "click to open". A user who sees nothing for half a
    // second clicks again. What does the app do?
    {
      await resetUi(page);
      await page.mouse.dblclick(mB.cx, mB.cy);
      await page.waitForTimeout(1400);
      const s = await state(page);
      rec('T2_dblclick_marker', {
        docsOpen: s.docsOpen, inplaceOpen: s.inplaceOpen, inplaceValue: s.inplaceValue,
        dialogOpen: s.dialogOpen, inspectorOpen: s.inspectorOpen, focus: s.focus,
        sourceChanged: s.source !== srcBefore
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await resetUi(page);
    }

    // ================= T2b: two SEPARATE clicks 300ms apart (still inside 520ms) =====
    {
      await resetUi(page);
      await page.mouse.click(mB.cx, mB.cy);
      await page.waitForTimeout(300);
      await page.mouse.click(mB.cx, mB.cy);
      await page.waitForTimeout(1400);
      const s = await state(page);
      rec('T2b_two_clicks_300ms', {
        docsOpen: s.docsOpen, inplaceOpen: s.inplaceOpen, inplaceValue: s.inplaceValue,
        dialogOpen: s.dialogOpen, sourceChanged: s.source !== srcBefore
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await resetUi(page);
    }

    // ================= T3: marker click, then click ANOTHER BLOCK at +150ms ==========
    {
      await resetUi(page);
      await page.mouse.click(mB.cx, mB.cy);
      await page.waitForTimeout(150);
      await page.mouse.click(nC.cx, nC.cy);
      await page.waitForTimeout(150);
      const mid = await state(page);
      await page.waitForTimeout(1200);
      const end = await state(page);
      rec('T3_marker_then_other_block', {
        at300ms: { docsOpen: mid.docsOpen, inspectorOpen: mid.inspectorOpen },
        at1500ms: { docsOpen: end.docsOpen, inspectorOpen: end.inspectorOpen, focus: end.focus }
      });
      await resetUi(page);
    }

    // ================= T4: marker A then marker B inside the window =================
    {
      await resetUi(page);
      await page.mouse.click(mA.cx, mA.cy);
      await page.waitForTimeout(200);
      await page.mouse.click(mB.cx, mB.cy);
      await page.waitForTimeout(1600);
      const which = await page.evaluate(`(() => {
        const wp = document.getElementById('wpWorkspace');
        const t = document.getElementById('wpTitle');
        return { docsOpen: !!(wp && !wp.hidden), title: t ? t.value : null };
      })()`);
      rec('T4_markerA_then_markerB', which);
      await resetUi(page);
      // control: click marker A alone
      await page.mouse.click(mA.cx, mA.cy);
      await page.waitForTimeout(1600);
      rec('T4c_markerA_alone', await page.evaluate(`(() => ({ docsOpen: !document.getElementById('wpWorkspace').hidden, title: (document.getElementById('wpTitle')||{}).value }))()`));
      await resetUi(page);
    }

    // ================= T5: marker click then a REAL DIALOG at +150ms =================
    {
      await resetUi(page);
      await page.mouse.click(mB.cx, mB.cy);
      await page.waitForTimeout(150);
      await page.keyboard.press('Control+k');   // command palette
      await page.waitForTimeout(150);
      const mid = await page.evaluate(`(() => {
        const p = document.getElementById('commandPalette');
        return { paletteOpen: !!(p && !p.hidden && getComputedStyle(p).display !== 'none'), dlg: (document.querySelector('dialog[open]')||{}).id || null, focus: document.activeElement ? (document.activeElement.id||document.activeElement.tagName) : null };
      })()`);
      await page.waitForTimeout(1200);
      const end = await page.evaluate(`(() => {
        const p = document.getElementById('commandPalette');
        return { paletteOpen: !!(p && !p.hidden && getComputedStyle(p).display !== 'none'), docsOpen: !document.getElementById('wpWorkspace').hidden, focus: document.activeElement ? (document.activeElement.id||document.activeElement.tagName) : null };
      })()`);
      rec('T5_marker_then_palette', { at300ms: mid, at1500ms: end });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await resetUi(page);
    }

    // ================= T6: micro-drag from the marker (10px out and back) ============
    {
      await resetUi(page);
      await page.mouse.move(mB.cx, mB.cy);
      await page.mouse.down();
      await page.mouse.move(mB.cx + 6, mB.cy + 6, { steps: 3 });
      await page.mouse.move(mB.cx + 12, mB.cy + 10, { steps: 3 });
      await page.mouse.move(mB.cx, mB.cy, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(1400);
      const s = await state(page);
      rec('T6_microdrag_marker', { docsOpen: s.docsOpen, inspectorOpen: s.inspectorOpen, sourceChanged: s.source !== srcBefore });
      await resetUi(page);
    }

    // ================= T7: real block drag, then marker click inside 400ms ==========
    {
      await resetUi(page);
      await page.mouse.move(nC.cx, nC.cy);
      await page.mouse.down();
      await page.mouse.move(nC.cx + 40, nC.cy + 30, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(120);
      const t0 = Date.now();
      await page.mouse.click(mB.cx, mB.cy);
      let ms = -1;
      for (let i = 0; i < 60; i++) {
        const open = await page.evaluate(`!document.getElementById('wpWorkspace').hidden`);
        if (open) { ms = Date.now() - t0; break; }
        await page.waitForTimeout(25);
      }
      rec('T7_marker_click_after_drag_ms', ms);
      await resetUi(page);
    }

    // ================= T8: connect mode via right-click on D, click B's marker =======
    {
      await resetUi(page);
      const nD = await nodeRect(page, 'D');
      await page.mouse.click(nD.cx, nD.cy, { button: 'right' });
      await page.waitForTimeout(500);
      const armed = await page.evaluate(`(() => {
        const rows = Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], .structure-menu button, [role="menu"] button'));
        const r = rows.find(x => /connect from here/i.test(x.textContent));
        if (!r) return { found: false, rows: rows.map(x => x.textContent.trim()).slice(0, 12) };
        const b = r.getBoundingClientRect();
        return { found: true, x: b.x + b.width / 2, y: b.y + b.height / 2, disabled: r.disabled === true };
      })()`);
      if (armed.found && !armed.disabled) {
        await page.mouse.click(armed.x, armed.y);
        await page.waitForTimeout(500);
      }
      const cm = await page.evaluate(`document.body.classList.contains('connect-mode')`);
      const before = await page.evaluate(`document.getElementById('source').value`);
      await page.mouse.click(mB.cx, mB.cy);
      await page.waitForTimeout(1400);
      const after = await page.evaluate(`document.getElementById('source').value`);
      const s = await state(page);
      rec('T8_connect_at_marker', {
        armed: armed.found, connectMode: cm,
        edgeAdded: /D\s*-->\s*B/.test(after) && !/D\s*-->\s*B/.test(before),
        docsOpen: s.docsOpen, sourceAfterTail: after.split('\n').slice(-3).join(' | ')
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      await resetUi(page);
    }

    // ================= T9: Escape inside the wait =================
    {
      await resetUi(page);
      await page.mouse.click(mB.cx, mB.cy);
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1200);
      const s = await state(page);
      rec('T9_escape_after_marker_click', { docsOpen: s.docsOpen });
      await resetUi(page);
    }

    // ================= T10: edge waypoint mode armed, click the marker =============
    {
      await resetUi(page);
      // select the A-->B edge by clicking its midpoint, then arm waypoints
      const nA = await nodeRect(page, 'A');
      const midx = (nA.cx + nB.cx) / 2, midy = (nA.y + nA.h + nB.y) / 2;
      await page.mouse.click(midx, midy);
      await page.waitForTimeout(600);
      const wp = await page.evaluate(`(() => {
        const b = document.getElementById('edgeWaypointAdd');
        if (!b) return { found: false };
        const r = b.getBoundingClientRect();
        return { found: true, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, onscreen: r.y > 0 && r.y < innerHeight };
      })()`);
      let armed = false;
      if (wp.found && wp.w > 0) {
        if (!wp.onscreen) { await page.evaluate(`document.getElementById('edgeWaypointAdd').scrollIntoView({block:'center'})`); await page.waitForTimeout(300); }
        const r2 = await page.evaluate(`(() => { const r = document.getElementById('edgeWaypointAdd').getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`);
        await page.mouse.click(r2.x, r2.y);
        await page.waitForTimeout(500);
        armed = await page.evaluate(`(() => { const b = document.getElementById('edgeWaypointAdd'); return b ? b.getAttribute('aria-pressed') : null; })()`);
      }
      const beforeWp = await page.evaluate(`document.getElementById('source').value`);
      await page.mouse.click(mB.cx, mB.cy);
      await page.waitForTimeout(1200);
      const s = await state(page);
      rec('T10_waypoint_mode_at_marker', {
        edgeInspectorReached: wp.found && wp.w > 0, armedAria: armed,
        docsOpen: s.docsOpen, sourceChanged: s.source !== beforeWp
      });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      await resetUi(page);
    }

    rec('final_source_equals_start', (await page.evaluate(`document.getElementById('source').value`)) === srcBefore);
    rec('cursor_marker_vs_node', await page.evaluate(`(() => {
      const m = document.querySelector('#diagram [data-t-workpaper-node]');
      const g = document.querySelector('#diagram g.node');
      return { marker: m ? getComputedStyle(m).cursor : null, node: g ? getComputedStyle(g).cursor : null };
    })()`));
    rec('marker_title', await page.evaluate(`(() => {
      const m = document.querySelector('#diagram [data-t-workpaper-node]');
      const t = m && m.querySelector('title');
      return t ? t.textContent : null;
    })()`));
  } catch (e) {
    out.errors.push('PROBE ERROR: ' + String(e && e.stack || e));
    console.log('PROBE ERROR', e);
  }
  out.pageErrors = app.errors;
  fs.writeFileSync(__dirname + '/skep_be1_' + TAG + '.json', JSON.stringify(out, null, 1));
  await app.close();
  console.log('DONE ' + TAG);
})();
