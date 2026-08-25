#!/usr/bin/env node
/* After pressing Guided, which tab does the app say you are on?
 *
 * All twenty types reach the Guided rows when the tab is pressed - measured. So "not clickable" is
 * not about nothing happening. The screenshot shows CODE lit and GUIDED dark, immediately after
 * pressing Guided. Guided lives INSIDE code mode, so applyEditorMode('code') marks the Code tab
 * selected and leaves the tab you actually pressed looking untouched.
 *
 * If that is what is happening, the control performs its action and then tells you it did something
 * else - which reads exactly like a dead button.
 *
 * Usage: node probe_guided_selection.js [--app <path>] [--port 9785]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9785'));

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
    await page.waitForTimeout(170);
  }
}

const TABS = `(() => {
  const read = id => {
    const b = document.getElementById(id);
    if (!b) return null;
    const cs = getComputedStyle(b);
    return {
      text: (b.textContent || '').trim(),
      ariaSelected: b.getAttribute('aria-selected'),
      tabIndex: b.tabIndex,
      bg: cs.backgroundColor,
      color: cs.color,
      fontWeight: cs.fontWeight
    };
  };
  return JSON.stringify({
    second: read('visualModeButton'),
    code: read('codeModeButton'),
    heading: (document.getElementById('editorHeading') || {}).textContent,
    guidedRows: document.querySelectorAll('#structureRows .struct-code').length,
    // the OTHER pair of buttons, inside the code panel, that also claim to own this
    textPressed: (document.getElementById('textModeButton') || {}).getAttribute
      ? document.getElementById('textModeButton').getAttribute('aria-pressed') : null,
    structurePressed: (document.getElementById('structureModeButton') || {}).getAttribute
      ? document.getElementById('structureModeButton').getAttribute('aria-pressed') : null,
    switchVisible: (() => {
      const sw = document.getElementById('editorModeSwitch');
      if (!sw) return 'absent';
      const r = sw.getBoundingClientRect();
      return r.width > 2 && r.height > 2 ? 'visible' : 'not visible';
    })()
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('\nMeasured on ' + APP + '\n');

  for (const t of ['pie', 'kanban', 'flowchart']) {
    // Report what the source actually became. The first version of this probe assumed the pick
    // landed and silently measured a flowchart three times - the instrument, not the app.
    const picked = JSON.parse(await page.evaluate(`(async () => {
      const sel = document.getElementById('diagramTypeSelect');
      sel.value = ${JSON.stringify(t)};
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 900));
      const st = document.getElementById('newStarterButton')
        || Array.from(document.querySelectorAll('button')).find(b => /new starter/i.test(b.textContent || ''));
      if (st && !st.disabled) { st.click(); await new Promise(r => setTimeout(r, 900)); }
      const dlg = document.querySelector('dialog[open]');
      if (dlg) { const go = Array.from(dlg.querySelectorAll('button')).find(b => /continue|replace|start|yes|ok/i.test(b.textContent||'')); if (go) { go.click(); await new Promise(r => setTimeout(r, 1400)); } }
      document.getElementById('codeModeButton')?.click(); await new Promise(r => setTimeout(r, 300));
      document.getElementById('textModeButton')?.click(); await new Promise(r => setTimeout(r, 300));
      return JSON.stringify({ firstLine: (document.getElementById('source').value || '').split(String.fromCharCode(10))[0].slice(0, 40) });
    })()`));

    const before = JSON.parse(await page.evaluate(TABS));
    console.log('  (source now starts: ' + JSON.stringify(picked.firstLine) + ')');
    await page.locator('#visualModeButton').click();
    await page.waitForTimeout(900);
    const after = JSON.parse(await page.evaluate(TABS));
    await page.screenshot({ path: 'C:/Claude/SIREN/pending/ui/guided_' + t + '.png', clip: { x: 0, y: 0, width: 700, height: 260 } });

    console.log('  === ' + t + ' ===');
    console.log('    before press:  ' + before.second.text + ' selected=' + before.second.ariaSelected
      + '   |   ' + before.code.text + ' selected=' + before.code.ariaSelected);
    console.log('    AFTER press:   ' + after.second.text + ' selected=' + after.second.ariaSelected
      + '   |   ' + after.code.text + ' selected=' + after.code.ariaSelected);
    console.log('    tab colours:   pressed one bg=' + after.second.bg + '  other bg=' + after.code.bg);
    console.log('    editor says:   "' + after.heading + '", ' + after.guidedRows + ' guided rows');
    console.log('    the inner pair: Text pressed=' + after.textPressed + ', Guided pressed=' + after.structurePressed
      + ', switch ' + after.switchVisible);
    const lies = after.second.ariaSelected === 'false' && after.guidedRows > 0 && after.heading === 'Guided lines';
    console.log('    >> ' + (lies
      ? 'THE TAB YOU PRESSED READS UNSELECTED while its own panel is what is showing'
      : 'the pressed tab reads selected'));
    console.log('');
  }

  console.log('  errors: ' + (errors.length ? errors.slice(0, 3).join(' // ') : 'none'));
  await close();
})();
