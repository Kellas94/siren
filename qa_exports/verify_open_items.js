#!/usr/bin/env node
/* Are the open Ideas and Cheap items still open?
 *
 * Six of them describe defects that later releases claim to have fixed. A worklist that still lists
 * closed work is the same class of defect as an app that promises what it cannot do, so each claim
 * is re-read out of the SHIPPED build here rather than out of a changelog.
 *
 * Every check prints what it measured, not a verdict, so an item is closed only on a number.
 *
 * Usage: node verify_open_items.js [--app <path>] [--port 9860]
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9860'));
const NL = String.fromCharCode(10);

const KANBAN = ['kanban', '  Todo', '    [Draft the memo]', '  Doing', '    [Walkthrough]'].join(NL);
const GANTT = ['gantt', '  title Fieldwork', '  section Planning', '  Scoping :a1, 2026-01-01, 20d'].join(NL);
const PIE = ['pie title Spend', '  "Audit" : 40', '  "Tax" : 60'].join(NL);
const TALL = ['flowchart TD'].concat(
  Array.from({ length: 26 }, (_, i) => '  N' + i + '[Step ' + i + '] --> N' + (i + 1) + '[Step ' + (i + 1) + ']')
).join(NL);

async function killTour(page) {
  for (let i = 0; i < 26; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent))
        || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(180);
  }
}

const say = (id, line) => console.log('  ' + id.padEnd(28) + line);

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('\nMeasured on ' + APP + '\n');

  // ---------- Ideas 04: thirteen types got a panel that promises blocks and has none ----------
  console.log('IDEAS 04  the universal builder panel');
  const TYPES = {
    flowchart: 'flowchart TD' + NL + '  A[One] --> B[Two]',
    sequenceDiagram: 'sequenceDiagram' + NL + '  A->>B: hi',
    pie: PIE, kanban: KANBAN, gantt: GANTT,
    classDiagram: 'classDiagram' + NL + '  class Order',
    'stateDiagram-v2': 'stateDiagram-v2' + NL + '  [*] --> Draft',
    mindmap: 'mindmap' + NL + '  root((Audit))' + NL + '    Scope',
    timeline: 'timeline' + NL + '  title Audit' + NL + '  2026 : Planning',
    erDiagram: 'erDiagram' + NL + '  CLIENT ||--o{ ENGAGEMENT : has'
  };
  for (const [type, src] of Object.entries(TYPES)) {
    await setSource(page, src, 2300);
    await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
    await page.waitForTimeout(250);
    const r = JSON.parse(await page.evaluate(`(() => {
      const b = document.getElementById('visualModeButton');
      return JSON.stringify({ label: (b.textContent || '').trim(), slot: b.dataset.slot || null });
    })()`));
    await page.locator('#visualModeButton').click().catch(() => {});
    await page.waitForTimeout(700);
    const after = JSON.parse(await page.evaluate(`(() => {
      const vp = document.getElementById('visualModePanel');
      const shown = !!(vp && !vp.hidden && vp.getBoundingClientRect().height > 2);
      const dead = shown ? Array.from(vp.querySelectorAll('button, input, select')).filter(e => e.disabled).length : 0;
      return JSON.stringify({ builderShown: shown, deadControls: dead,
        guidedRows: document.querySelectorAll('#structureRows .struct-code').length });
    })()`));
    say(type, `tab "${r.label}" -> builder panel ${after.builderShown ? 'SHOWN with ' + after.deadControls + ' disabled controls' : 'not shown'}, guided rows ${after.guidedRows}`);
  }

  // ---------- Ideas 06c + 08a: what a kanban and a pie say about themselves ----------
  console.log('\nIDEAS 06c / 08a  what the app says about a diagram that is not a flowchart');
  for (const [name, src] of [['kanban', KANBAN], ['gantt', GANTT], ['pie', PIE]]) {
    await setSource(page, src, 2600);
    const t = JSON.parse(await page.evaluate(`(() => JSON.stringify({
      status: ((document.getElementById('visualBuilderStatus') || {}).textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 96),
      previewHeading: (document.getElementById('previewHeading') || {}).textContent,
      titlePreview: (document.getElementById('diagramTitlePreview') || {}).textContent,
      chip: (() => { const c = document.getElementById('diagramTypeChip');
        if (!c) return 'absent';
        const r = c.getBoundingClientRect();
        return (r.width > 2 && r.height > 2 ? 'visible: ' : 'hidden: ') + (c.textContent || '').trim().slice(0, 40); })()
    }))()`));
    say(name + ' status', JSON.stringify(t.status));
    say(name + ' title', `preview "${t.previewHeading}" / chip "${t.titlePreview}"`);
    say(name + ' type chip', t.chip);
  }

  // ---------- Ideas 06b: does the app report success for nothing ----------
  console.log('\nIDEAS 06b  a success message for work that did not happen');
  await setSource(page, GANTT, 2600);
  const styled = JSON.parse(await page.evaluate(`(async () => {
    const before = document.getElementById('source').value;
    const btn = document.getElementById('styleShortcutButton') || document.getElementById('inspectorApplyStyle');
    const toastsBefore = document.querySelectorAll('.toast, [role="status"]').length;
    if (btn) { btn.click(); await new Promise(r => setTimeout(r, 900)); }
    const texts = Array.from(document.querySelectorAll('.toast, [role="status"]'))
      .map(t => (t.textContent || '').replace(/\\s+/g, ' ').trim()).filter(Boolean);
    return JSON.stringify({ control: btn ? (btn.id || 'found') : 'no style control reachable',
      sourceUnchanged: document.getElementById('source').value === before,
      toasts: texts.slice(0, 3), toastsBefore });
  })()`));
  say('gantt style attempt', JSON.stringify(styled));

  // ---------- Ideas 08b: does the type you pick survive ----------
  console.log('\nIDEAS 08b  the type you just picked');
  for (const want of ['kanban', 'mindmap', 'block-beta']) {
    const res = JSON.parse(await page.evaluate(`(async () => {
      const sel = document.getElementById('diagramTypeSelect');
      if (!sel) return JSON.stringify({ error: 'no #diagramTypeSelect' });
      const opt = Array.from(sel.options).find(o => o.value === ${JSON.stringify(want)})
        || Array.from(sel.options).find(o => /${want.split('-')[0]}/i.test(o.textContent));
      if (!opt) return JSON.stringify({ error: 'no option for ' + ${JSON.stringify(want)},
        options: Array.from(sel.options).map(o => o.value).slice(0, 8) });
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1800));
      const starter = document.getElementById('newStarterButton')
        || Array.from(document.querySelectorAll('button')).find(b => /new starter/i.test(b.textContent));
      return JSON.stringify({ picked: opt.value, selectNowReads: sel.value,
        selectLabel: (sel.options[sel.selectedIndex] || {}).textContent,
        starterDisabled: starter ? starter.disabled : 'no starter button' });
    })()`));
    say(want, JSON.stringify(res));
  }

  // ---------- Cheap 12: does fit fit the whole diagram ----------
  console.log('\nCHEAP 12  fit the whole diagram, or only its width');
  await setSource(page, TALL, 3800);
  const fit = JSON.parse(await page.evaluate(`(async () => {
    const read = () => {
      const svg = document.querySelector('#diagram svg');
      const view = document.getElementById('zoomViewport') || document.getElementById('diagram');
      if (!svg || !view) return null;
      const s = svg.getBoundingClientRect(), v = view.getBoundingClientRect();
      return { svgW: Math.round(s.width), svgH: Math.round(s.height),
               viewW: Math.round(v.width), viewH: Math.round(v.height),
               fitsWidth: s.width <= v.width + 2, fitsHeight: s.height <= v.height + 2 };
    };
    const out = { before: read(), buttons: {} };
    for (const id of ['fitPageButton', 'fitWidthButton']) {
      const b = document.getElementById(id);
      if (!b) { out.buttons[id] = 'absent'; continue; }
      b.click(); await new Promise(r => setTimeout(r, 1100));
      out.buttons[id] = { title: b.title || (b.getAttribute('aria-label') || ''), after: read() };
    }
    return JSON.stringify(out);
  })()`));
  say('before any fit', JSON.stringify(fit.before));
  for (const [id, v] of Object.entries(fit.buttons)) say(id, JSON.stringify(v));

  console.log('\n  page/console errors: ' + (errors.length ? errors.slice(0, 3).join(' // ') : 'none'));
  await close();
})();
