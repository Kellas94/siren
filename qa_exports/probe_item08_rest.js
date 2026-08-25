#!/usr/bin/env node
/* The two halves of Ideas 08 that were not measured with the others.
 *
 *   (d) "the type chip carries 'Full visual editing is available'" - an honesty claim that is
 *       false on the sixteen types the builder cannot edit, and was invisible in the markup.
 *       The chip is visible now; the question is whether it still says that.
 *   (e) "a beginner cannot find the diagram types at all: '+ Diagram' never asks."
 *
 * An item is closed on a number, not on a release note.
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9875'));
const NL = String.fromCharCode(10);
const SPACE_RUN = new RegExp(String.fromCharCode(92) + 's+', 'g');   // written this way on purpose

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
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

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('\nMeasured on ' + APP + '\n');

  // ---- (d) what the type chip promises, per type ----
  console.log('08d  what the type chip says about editing');
  for (const [name, src] of [
    ['flowchart', 'flowchart TD' + NL + '  A[One] --> B[Two]'],
    ['pie', 'pie title Spend' + NL + '  "Audit" : 40'],
    ['kanban', 'kanban' + NL + '  Todo' + NL + '    [Draft]']
  ]) {
    await setSource(page, src, 2600);
    const chip = JSON.parse(await page.evaluate(`(() => {
      const c = document.getElementById('diagramTypeChip');
      if (!c) return JSON.stringify({ absent: true });
      const r = c.getBoundingClientRect();
      return JSON.stringify({
        visible: r.width > 2 && r.height > 2,
        text: (c.textContent || '').trim(),
        title: c.title || c.getAttribute('aria-label') || null
      });
    })()`));
    console.log('  ' + name.padEnd(12) + JSON.stringify(chip));
  }

  const claim = await page.evaluate(`(() => {
    const hits = [];
    document.querySelectorAll('*').forEach(e => {
      if (e.children.length) return;
      const t = (e.textContent || '').trim();
      if (/full visual editing is available/i.test(t)) {
        const r = e.getBoundingClientRect();
        hits.push((r.width > 2 && r.height > 2 ? 'VISIBLE' : 'hidden') + ' ' + (e.id || e.tagName) + ' :: ' + t.slice(0, 60));
      }
    });
    document.querySelectorAll('[title]').forEach(e => {
      if (/full visual editing is available/i.test(e.title)) hits.push('TOOLTIP ' + (e.id || e.tagName) + ' :: ' + e.title.slice(0, 60));
    });
    return JSON.stringify(hits);
  })()`);
  console.log('  "Full visual editing is available" on screen: ' + claim);

  // ---- (e) does "+ Diagram" ask what kind ----
  console.log('\n08e  does adding a diagram ask what kind it is');
  const add = JSON.parse(await page.evaluate(`(async () => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => /^\\+?\\s*(new )?diagram$/i.test((b.textContent || '').trim())) ||
      document.getElementById('newDiagramButton') || document.getElementById('addDiagramButton');
    if (!btn) return JSON.stringify({ error: 'no add-diagram button found',
      candidates: Array.from(document.querySelectorAll('button')).map(b => (b.textContent||'').trim())
        .filter(t => /diagram/i.test(t)).slice(0, 8) });
    const before = (window.state && state.diagrams ? state.diagrams.length : null);
    btn.click();
    await new Promise(r => setTimeout(r, 1000));
    const menu = document.querySelector('.struct-menu');
    const dlg = document.querySelector('dialog[open]');
    return JSON.stringify({
      pressed: (btn.textContent || '').trim(),
      askedViaMenu: menu ? Array.from(menu.querySelectorAll('.struct-menu-item, .struct-menu-heading'))
        .map(x => (x.textContent || '').trim()).slice(0, 12) : null,
      askedViaDialog: dlg ? (dlg.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120) : null,
      whatItMadeInstead: {
        tabsBefore: before,
        tabsNow: document.querySelectorAll('.diagram-tab').length,
        sourceHead: (document.getElementById('source').value || '').split(String.fromCharCode(10))[0],
        typeNow: (document.getElementById('diagramTypeSelect') || {}).value || null,
        chip: ((document.getElementById('diagramTypeChip') || {}).textContent || '').trim(),
        typePickerReachable: (() => {
          const sel = document.getElementById('diagramTypeSelect');
          if (!sel) return 'absent';
          const r = sel.getBoundingClientRect();
          if (r.width > 2 && r.height > 2) return 'visible on screen';
          const fold = sel.closest('details');
          return fold ? (fold.open ? 'zero-size inside an open fold' : 'inside a CLOSED disclosure') : 'zero-size';
        })()
      }
    });
  })()`));
  console.log('  ' + JSON.stringify(add, null, 1).replace(SPACE_RUN, ' '));

  console.log('\n  errors: ' + (errors.length ? errors.slice(0, 3).join(' // ') : 'none'));
  await close();
})();
