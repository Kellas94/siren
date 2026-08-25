#!/usr/bin/env node
/* How many controls of chrome does the app show at rest?
 *
 * The outside review's threshold is seven permanent actions in the active toolbar. The original
 * census (on 1.66.0) counted 43 controls of chrome, of which the preview toolbar held 12 - the one
 * region measurably over budget. This re-counts the same regions on the shipped build so the
 * worklist item states today's number rather than last week's.
 *
 * Counts only controls a person can see and press: laid out, non-zero, not hidden.
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9884'));

const CENSUS = `(() => {
  const usable = e => {
    if (e.disabled) return true;              // a visible disabled control still occupies attention
    const r = e.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const count = sel => {
    const root = document.querySelector(sel);
    if (!root) return 'absent';
    const rr = root.getBoundingClientRect();
    if (rr.width < 3 || rr.height < 3) return 0;
    return Array.from(root.querySelectorAll('button, select, input, [role="tab"], [role="button"]'))
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }).length;
  };
  return JSON.stringify({
    header:        count('header') ,
    workspaceBar:  count('.workspace-bar') ,
    editorPane:    count('#editorPane'),
    previewToolbar:count('.preview-toolbar'),
    previewPane:   count('#previewPane')
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  for (let i = 0; i < 22; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 5) break;
    await page.waitForTimeout(180);
  }
  const bar = JSON.parse(await page.evaluate(`(() => {
    const root = document.querySelector('.preview-toolbar');
    if (!root) return JSON.stringify({ absent: true });
    return JSON.stringify(Array.from(root.querySelectorAll('button, select, input, [role="tab"], [role="button"]'))
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; })
      .map(e => (e.textContent || '').trim().slice(0, 22) || e.id || e.tagName));
  })()`));
  console.log('  the preview toolbar, control by control: ' + JSON.stringify(bar));
  const c = JSON.parse(await page.evaluate(CENSUS));
  console.log('\n  chrome at rest, 1440x900, nothing open:');
  Object.entries(c).forEach(([k, v]) => console.log('    ' + k.padEnd(16) + v));
  const nums = Object.entries(c).filter(([k]) => k !== 'previewPane').map(([, v]) => (typeof v === 'number' ? v : 0));
  console.log('    ' + 'TOTAL'.padEnd(16) + nums.reduce((a, b) => a + b, 0) + '   (previewPane excluded - it contains the toolbar)');
  console.log('\n  errors: ' + (errors.length ? errors.slice(0, 2).join(' // ') : 'none'));
  await close();
})();
