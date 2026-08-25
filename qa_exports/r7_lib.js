/* Shared harness for Round 7 verification.
 *
 * Every probe needs the same four things and every one of them has bitten us before, so they live
 * here once rather than being rediscovered per script:
 *
 *   1. Playwright resolves from the global npm root, not from this folder.
 *   2. The app must be SERVED - opening it as file:// changes what the CSP allows.
 *   3. The 1.7s brand intro (#sirenIntroOverlay) covers the whole app. The DOM underneath is
 *      already laid out and answers getBoundingClientRect() and .click() perfectly, so a probe that
 *      only waits for #diagram svg can produce a full page of correct numbers over a photograph of
 *      the splash. Four blank screenshots on 2026-08-25 were exactly this.
 *   4. The tour cards and any open dialog have to be dismissed or they eat the first click.
 *
 * There is also a rule encoded in `assertMeaningful` below, learned the same day: a check that
 * returns "nothing found" on BOTH the base and the patched build has not passed, it has measured
 * nothing. Probes must say so out loud instead of printing PASS.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');

const SETTLE = `(async () => {
  for (let i = 0; i < 90; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  for (let p = 0; p < 12; p++) {
    const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) break; b.click(); await new Promise(r => setTimeout(r, 220));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  const intro = document.getElementById('sirenIntroOverlay');
  for (let i = 0; i < 60 && intro && !intro.hidden; i++) await new Promise(r => setTimeout(r, 100));
  document.body.click(); await new Promise(r => setTimeout(r, 800));
  return 1;
})()`;

/* Serve the app's own directory and open one page on it, settled and ready to drive. */
async function openApp(appPath, port, viewport = { width: 1440, height: 900 }) {
  const root = path.dirname(appPath), file = path.basename(appPath);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(port);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  await page.goto(`http://127.0.0.1:${port}/${file}`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(SETTLE);
  return { page, errors, close: async () => { await browser.close(); server.close(); } };
}

/* Type source into the editor the way a person would, and wait for the render to catch up. */
async function setSource(page, text, settleMs = 3000) {
  await page.evaluate(`(() => {
    const s = document.getElementById('source');
    s.value = ${JSON.stringify(text)};
    s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(settleMs);
}

/* Guided is a view INSIDE Code mode, not a peer of it. A probe that reads #structureRows without
   going through Code mode first finds zero rows on every diagram type and concludes, wrongly, that
   the Guided editor is empty. */
async function openGuided(page, waitMs = 1200) {
  await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
  await page.waitForTimeout(500);
  await page.evaluate(`(() => { document.getElementById('structureModeButton')?.click(); })()`);
  await page.waitForTimeout(waitMs);
  return page.evaluate(`document.querySelectorAll('#structureRows .struct-code').length`);
}

/* Press the app's own confirmation dialog if one is up. Several flows - starter replacement above
   all - do nothing at all until this is answered, and a probe that skips it measures the state
   BEFORE the action it thinks it triggered. */
async function confirmDialog(page, waitMs = 700) {
  await page.waitForTimeout(300);
  const pressed = await page.evaluate(`(() => {
    const dlg = document.querySelector('dialog[open]');
    if (!dlg) return null;
    const btn = Array.from(dlg.querySelectorAll('button')).find(b =>
      /replace|confirm|yes|continue|ok|start|create/i.test(b.textContent) && !/cancel|keep|no/i.test(b.textContent));
    if (!btn) return 'dialog open but no confirm button: ' + Array.from(dlg.querySelectorAll('button')).map(b => b.textContent.trim()).join(' | ');
    btn.click();
    // Inside a template literal a single-backslash escape collapses: /\s+/ became /s+/ and
    // this line replaced every letter 's' in the button text with a space, so the harness
    // reported mangled button names back to whoever was reading its output.
    return 'pressed: ' + btn.textContent.replace(/\\s+/g, ' ').trim();
  })()`);
  if (pressed) await page.waitForTimeout(waitMs);
  return pressed;
}

const results = [];
function check(id, ok, expected, actual, note) {
  results.push({ id, ok: !!ok, expected, actual, note });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} | expected=${expected} | actual=${actual}${note ? ' | ' + note : ''}`);
  return ok;
}

/* A comparison where BOTH sides are empty proves nothing. Call this instead of check() whenever the
   claim is "X is now present/correct" and the honest answer might be that X was never findable. */
function assertMeaningful(id, baseValue, newValue, ok, expected) {
  const vacuous = (baseValue === newValue) && (!baseValue || baseValue === 0 || baseValue === '' ||
                  (Array.isArray(baseValue) && !baseValue.length));
  if (vacuous) {
    results.push({ id, ok: null, expected, actual: `VACUOUS - base and new both ${JSON.stringify(baseValue)}`, note: 'measured nothing' });
    console.log(`[ -- ] ${id} | VACUOUS: base and new are both ${JSON.stringify(baseValue)} - this check measured nothing`);
    return null;
  }
  return check(id, ok, expected, `base=${JSON.stringify(baseValue)} new=${JSON.stringify(newValue)}`);
}

function report(label) {
  const fail = results.filter(r => r.ok === false).length;
  const vac = results.filter(r => r.ok === null).length;
  const pass = results.filter(r => r.ok === true).length;
  console.log(`\n${label}: ${pass} pass, ${fail} fail, ${vac} vacuous`);
  console.log('JSON_RESULT ' + JSON.stringify({ label, pass, fail, vacuous: vac, results }));
  return fail;
}

module.exports = { openApp, setSource, openGuided, confirmDialog, check, assertMeaningful, report, results, SETTLE };
