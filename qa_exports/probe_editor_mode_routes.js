#!/usr/bin/env node
/* One verb - "show me the guided line editor" - and every route to it.
 *
 * Routes measured:
 *   R1  the second editor TAB (#visualModeButton, whose label is Build / Sequence / Guided)
 *   R2  the inner pair inside the code panel (#structureModeButton, always "Guided")
 *   R3  the command palette row harvested from R2  (group "Other", title "Guided")
 *   R4  the command palette's CURATED row, "Visual builder"
 *   R5  the command palette's CURATED row, "Mermaid code"
 *   R6  right-click on the drawing -> "Edit as code"
 *
 * After each, the probe records what is on screen, which tab claims to be selected, and
 * what the editor heading says it is. Any route where the thing on screen and the thing
 * the tab strip claims disagree is the finding.
 *
 * Usage: node probe_editor_mode_routes.js [--port 9812]
 */
const { openApp, confirmDialog } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9812'));
const TYPES = (arg('types', 'flowchart,sequence,pie,gantt,classDiagram,stateDiagram') || '').split(',');

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(160);
  }
}

const STATE = `(() => {
  const sel = id => { const b = document.getElementById(id); return b ? b.getAttribute('aria-selected') : null; };
  const press = id => { const b = document.getElementById(id); return b ? b.getAttribute('aria-pressed') : null; };
  const vis = id => { const e = document.getElementById(id); return !!(e && !e.hidden && e.getBoundingClientRect().height > 2); };
  const txt = id => { const e = document.getElementById(id); return e ? String(e.textContent||'').replace(/\\s+/g,' ').trim() : null; };
  return JSON.stringify({
    tabLabel: txt('visualModeButton'),
    tabSel: sel('visualModeButton'), codeSel: sel('codeModeButton'),
    innerText: press('textModeButton'), innerGuided: press('structureModeButton'),
    showing: vis('structureEditor') ? 'GUIDED rows'
      : vis('sequencePanel') ? 'SEQUENCE builder'
      : vis('visualModePanel') ? 'VISUAL builder'
      : vis('codeEditor') ? 'plain CODE'
      : 'nothing',
    heading: txt('editorHeading')
  });
})()`;

async function pickType(page, type) {
  await page.evaluate(`(async () => {
    const sel = document.getElementById('diagramTypeSelect');
    if (!sel) return;
    const match = Array.from(sel.options).find(o => o.value === ${JSON.stringify(type)})
      || Array.from(sel.options).find(o => o.value.toLowerCase().startsWith(${JSON.stringify(type.toLowerCase())}));
    if (match) { sel.value = match.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 700));
    const st = document.getElementById('newDiagramTypeButton')
      || Array.from(document.querySelectorAll('button')).find(b => /new starter/i.test(b.textContent || ''));
    if (st && !st.disabled) { st.click(); await new Promise(r => setTimeout(r, 800)); }
  })()`);
  await confirmDialog(page, 1200);
  await page.waitForTimeout(900);
  return page.evaluate(`(document.getElementById('source').value || '').split(String.fromCharCode(10)).find(l => l.trim()) || ''`);
}

async function runPalette(page, exactTitle) {
  return page.evaluate(`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const input = document.getElementById('commandPaletteInput');
    if (!input) return 'no palette';
    input.value = ${JSON.stringify(exactTitle)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const rows = Array.from(document.querySelectorAll('#commandPaletteList .palette-row'));
    const want = ${JSON.stringify(exactTitle.toLowerCase())};
    const hit = rows.find(r => String(r.querySelector('span')?.textContent || '').toLowerCase().replace(/[^a-z ]/g,'').trim() === want.replace(/[^a-z ]/g,'').trim())
      || rows[0];
    if (!hit) { document.getElementById('commandPalette').hidden = true; return 'no row for ' + ${JSON.stringify(exactTitle)}; }
    const got = String(hit.querySelector('span')?.textContent || '').trim();
    hit.click();
    await new Promise(r => setTimeout(r, 700));
    const p = document.getElementById('commandPalette'); if (p) p.hidden = true;
    return 'ran: ' + got;
  })()`);
}

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP + '\n');

  for (const type of TYPES) {
    const first = await pickType(page, type);
    console.log('===== requested "' + type + '"  ->  source starts: ' + JSON.stringify(first.slice(0, 42)) + ' =====');
    // Assert the fixture actually changed type before believing a single line below it.
    const okFixture = new RegExp('^\\s*' + type.replace(/[^a-zA-Z]/g, '').slice(0, 5), 'i').test(first.trim())
      || (type === 'flowchart' && /^(flowchart|graph)/i.test(first.trim()));
    if (!okFixture) { console.log('  SKIPPED - the starter did not land as ' + type + '\n'); continue; }

    // Start every route from the same place: plain code.
    await page.evaluate(`(async () => {
      document.getElementById('codeModeButton')?.click(); await new Promise(r => setTimeout(r, 250));
      document.getElementById('textModeButton')?.click();
    })()`);
    await page.waitForTimeout(600);

    const routes = [
      ['R1 second TAB', async () => { await page.locator('#visualModeButton').click({ timeout: 2500 }); }],
      ['R2 inner Guided', async () => { await page.locator('#structureModeButton').click({ timeout: 2500 }); }],
      ['R3 palette "Guided"', async () => { const r = await runPalette(page, 'Guided'); if (/^no /.test(r)) throw new Error(r); }],
      ['R4 palette "Visual builder"', async () => { const r = await runPalette(page, 'Visual builder'); if (/^no /.test(r)) throw new Error(r); }],
      ['R5 palette "Mermaid code"', async () => { const r = await runPalette(page, 'Mermaid code'); if (/^no /.test(r)) throw new Error(r); }]
    ];

    for (const [name, run] of routes) {
      // reset to plain code before each route so routes are compared, not chained
      await page.evaluate(`(async () => {
        document.getElementById('codeModeButton')?.click(); await new Promise(r => setTimeout(r, 200));
        document.getElementById('textModeButton')?.click();
      })()`);
      await page.waitForTimeout(500);
      let note = '';
      try { await run(); } catch (e) { note = '  << COULD NOT RUN: ' + String(e.message).split('\n')[0].slice(0, 46); }
      await page.waitForTimeout(800);
      const s = JSON.parse(await page.evaluate(STATE));
      const lie = (s.showing === 'GUIDED rows' && s.tabSel === 'false' && s.codeSel === 'true')
        ? '   <<< TAB STRIP SAYS "Code", SCREEN SHOWS GUIDED' : '';
      console.log('  ' + name.padEnd(28)
        + 'tab=' + String(s.tabLabel).padEnd(12)
        + ' sel[' + String(s.tabSel).padEnd(5) + '|' + String(s.codeSel).padEnd(5) + ']'
        + ' inner[T=' + String(s.innerText).padEnd(5) + ' G=' + String(s.innerGuided).padEnd(5) + ']'
        + '  showing: ' + String(s.showing).padEnd(16)
        + '  heading: ' + s.heading + note + lie);
    }
    console.log('');
  }

  console.log('errors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
