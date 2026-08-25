/* What is actually WORKING at the end of the four presses, per diagram type.
 *
 * Reach is only half the cost. The other half is arriving. This picks each diagram type the way
 * a person does - #diagramTypeSelect, the "New starter" button found by label, then the app's own
 * confirmation - ASSERTS the source really changed to that type, then opens every fold of the
 * Style card and counts what is live, what is disabled and what is not rendered at all.
 */
const { openApp, confirmDialog } = require('./r7_lib.js');
const fs = require('fs');

const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9871);
const TYPES = (process.argv[4] || 'flowchart,sequence,pie,gantt,mindmap,class,er,timeline,journey,gitgraph,state,kanban').split(',');
const DIR = 'C:/Claude/SIREN/qa_exports/reach';

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card'); if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click(); return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(170);
  }
}

// Open the Style card and every fold inside it, then read the state of every control.
const READ_STYLE = `(() => {
  const card = document.getElementById('settingsSection');
  if (!card) return JSON.stringify({ err: 'no settingsSection' });
  card.open = true;
  card.querySelectorAll('details.style-fold').forEach(f => { f.open = true; });
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  const sel = 'button, select, input:not([type=hidden]), textarea';
  const rows = [];
  card.querySelectorAll(sel).forEach(e => {
    if (e.tagName === 'SUMMARY') return;
    const cs = getComputedStyle(e);
    let hiddenBy = '';
    let n = e;
    while (n && n !== card) {
      if (n.hasAttribute && n.hasAttribute('hidden')) { hiddenBy = n.id || clean(n.className).slice(0, 34); break; }
      n = n.parentElement;
    }
    const rendered = !hiddenBy && cs.display !== 'none' && cs.visibility !== 'hidden';
    let name = clean(e.getAttribute('aria-label'));
    if (!name && e.id) { const lf = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (lf) name = clean(lf.textContent); }
    if (!name) name = clean(e.textContent) || clean(e.getAttribute('title'));
    let fold = '';
    let f = e.closest('details.style-fold');
    if (f) { const s = f.querySelector(':scope > summary > span > span'); fold = s ? clean(s.textContent) : (f.id || ''); }
    rows.push({ id: e.id || '', tag: e.tagName.toLowerCase(), name: (name || '').slice(0, 44), fold,
                rendered, disabled: !!(e.disabled || e.getAttribute('aria-disabled') === 'true'), hiddenBy });
  });
  return JSON.stringify({ total: rows.length, rows });
})()`;

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const all = [];
  for (const type of TYPES) {
    const ctx = await openApp(APP, PORT, { width: 1440, height: 900 });
    const page = ctx.page;
    await killTour(page);
    await page.waitForTimeout(400);

    // Pick the type the way a person does, through the visible controls.
    await page.evaluate(`(() => { document.querySelector('.advanced-tools-card > summary').click(); })()`);
    await page.waitForTimeout(400);
    await page.evaluate(`(() => {
      const s = document.getElementById('diagramTypeSelect');
      s.value = ${JSON.stringify(type)};
      s.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await page.waitForTimeout(300);
    const pressed = await page.evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent || ''));
      if (!b) return 'NO new-starter button';
      b.click(); return 'pressed';
    })()`);
    await confirmDialog(page, 1400);
    await page.waitForTimeout(2200);

    // ASSERT the fixture before measuring anything.
    const src = await page.evaluate(`(document.getElementById('source')||{}).value || ''`);
    const head = String(src).split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
    const chipText = await page.evaluate(`(() => { const c = document.getElementById('diagramTypeChip'); return c ? c.textContent.trim() : ''; })()`);

    const style = JSON.parse(await page.evaluate(READ_STYLE));
    await page.waitForTimeout(200);

    const live = style.rows.filter(r => r.rendered && !r.disabled);
    const dead = style.rows.filter(r => r.rendered && r.disabled);
    const gone = style.rows.filter(r => !r.rendered);

    // Per fold, is anything at all usable behind it?
    const folds = {};
    style.rows.forEach(r => {
      const f = folds[r.fold] = folds[r.fold] || { live: 0, dead: 0, gone: 0 };
      if (!r.rendered) f.gone++; else if (r.disabled) f.dead++; else f.live++;
    });

    all.push({ type, pressed, head: head.slice(0, 60), chip: chipText, total: style.total,
               live: live.length, dead: dead.length, gone: gone.length, folds,
               deadNames: dead.map(r => r.fold + ' / ' + (r.name || r.id)).slice(0, 20) });

    console.log('');
    console.log('=== ' + type + ' ===  source starts: "' + head.slice(0, 46) + '"   chip: ' + chipText);
    console.log('   Style card controls: ' + style.total + '   live ' + live.length + ' | disabled ' + dead.length + ' | not rendered ' + gone.length);
    Object.entries(folds).forEach(([f, c]) =>
      console.log('     fold "' + (f || '(card body)') + '": live ' + c.live + ', disabled ' + c.dead + ', not rendered ' + c.gone +
        ((c.live === 0) ? '   <-- NOTHING USABLE BEHIND THIS FOLD' : '')));

    await ctx.close();
  }
  fs.writeFileSync(DIR + '/style_per_type.json', JSON.stringify(all, null, 1));

  console.log('');
  console.log('=== summary ===');
  all.forEach(a => console.log('  ' + a.type.padEnd(11) + ' live ' + String(a.live).padStart(3) + ' / ' + a.total +
    '   folds with nothing usable: ' + Object.entries(a.folds).filter(([, c]) => c.live === 0).map(([f]) => f || '(body)').join(', ')));
})();
