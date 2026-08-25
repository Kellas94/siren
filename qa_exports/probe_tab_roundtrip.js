#!/usr/bin/env node
/* One step sideways from the fix: pressing Code while the Guided rows are showing.
 *
 * Guided lives inside code mode, so the app is ALREADY in code mode when Guided is on screen.
 * Pressing the Code tab therefore asks for a mode it is already in - and if the tab selection now
 * follows the second slot, Code could stay unselected after being pressed. That would be a new dead
 * button, created by the fix for the old one.
 *
 * Usage: node probe_tab_roundtrip.js [--app <path>] [--port 9790]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/uifix/app.html');
const PORT = Number(arg('port', '9790'));

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

const STATE = `(() => {
  const sel = id => { const b = document.getElementById(id); return b ? b.getAttribute('aria-selected') : null; };
  const press = id => { const b = document.getElementById(id); return b ? b.getAttribute('aria-pressed') : null; };
  const vis = id => { const e = document.getElementById(id); return !!(e && !e.hidden && e.getBoundingClientRect().height > 2); };
  return JSON.stringify({
    secondTab: sel('visualModeButton'), codeTab: sel('codeModeButton'),
    innerText: press('textModeButton'), innerGuided: press('structureModeButton'),
    showing: vis('structureEditor') ? 'Guided rows' : vis('codeEditor') ? 'plain text'
      : vis('visualModePanel') ? 'visual builder' : vis('sequencePanel') ? 'sequence builder' : 'nothing',
    heading: (document.getElementById('editorHeading') || {}).textContent
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('\nMeasured on ' + APP + '\n');

  const setup = JSON.parse(await page.evaluate(`(async () => {
    const sel = document.getElementById('diagramTypeSelect');
    sel.value = 'pie'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 900));
    // #newStarterButton does not exist; the control is found by its label. Relying on the id alone
    // left the source a flowchart and quietly measured the wrong diagram type twice.
    const st = document.getElementById('newStarterButton')
      || Array.from(document.querySelectorAll('button')).find(b => /new starter/i.test(b.textContent || ''));
    if (st && !st.disabled) { st.click(); await new Promise(r => setTimeout(r, 900)); }
    const dlg = document.querySelector('dialog[open]');
    if (dlg) { const go = Array.from(dlg.querySelectorAll('button')).find(b => /continue|replace|start|yes|ok/i.test(b.textContent||'')); if (go) { go.click(); await new Promise(r => setTimeout(r, 1400)); } }
    document.getElementById('codeModeButton')?.click(); await new Promise(r => setTimeout(r, 300));
    document.getElementById('textModeButton')?.click(); await new Promise(r => setTimeout(r, 400));
    return JSON.stringify({ firstLine: (document.getElementById('source').value || '').split(String.fromCharCode(10))[0].slice(0, 30) });
  })()`));

  // Assert the fixture before measuring anything on it.
  console.log('  fixture: source starts ' + JSON.stringify(setup.firstLine));
  if (!/^pie/i.test(setup.firstLine)) {
    console.log('  ABORT - the pie starter did not land, so nothing below would be about pie.');
    await close();
    return;
  }
  console.log('');

  const steps = [
    ['start, on plain text', null],
    ['press the Guided tab', '#visualModeButton'],
    ['press the Code tab', '#codeModeButton'],
    ['press the Guided tab again', '#visualModeButton'],
    ['press the inner Text button', '#textModeButton'],
    ['press the Code tab again', '#codeModeButton']
  ];

  for (const [label, sel] of steps) {
    let note = '';
    if (sel) {
      // A control that cannot be pressed at this moment IS the finding, so this records it
      // rather than throwing and losing every step after it.
      try {
        await page.locator(sel).click({ timeout: 2500 });
      } catch (e) {
        note = '   << ' + sel + ' COULD NOT BE PRESSED: ' + String(e.message).split('\n')[0].slice(0, 44);
      }
      await page.waitForTimeout(800);
    }
    const st = JSON.parse(await page.evaluate(STATE));
    console.log('  ' + label.padEnd(28)
      + 'tabs[' + String(st.secondTab).padEnd(5) + '|' + String(st.codeTab).padEnd(5) + ']  '
      + 'inner[T=' + String(st.innerText).padEnd(5) + ' G=' + String(st.innerGuided).padEnd(5) + ']  '
      + 'showing: ' + st.showing + note);
    if (sel === '#codeModeButton' && st.showing === 'Guided rows') {
      console.log('    >> PRESSING CODE LEFT THE GUIDED ROWS ON SCREEN - the Code tab does nothing here');
    }
  }

  await page.screenshot({ path: 'C:/Claude/SIREN/pending/ui/tabs_after.png', clip: { x: 0, y: 0, width: 760, height: 300 } });
  console.log('\n  errors: ' + (errors.length ? errors.slice(0, 3).join(' // ') : 'none'));
  await close();
})();
