#!/usr/bin/env node
/* The round 12 headline: the offline switch does nothing whenever the URL carries a fragment,
 * and writes the OPPOSITE preference while doing nothing.
 *
 * The claimed trigger is not exotic - the app's own "Skip to..." link is the first Tab stop, and
 * pressing Enter on it puts a fragment in the address bar for the rest of the session. So this
 * walks it exactly as a person would: Tab, Enter, then turn the mode on and read what the app says.
 *
 * The dangerous direction is OFF: if a person in strict mode presses the switch to leave it, and the
 * app does nothing while telling them they are still protected, the protection drops by itself at
 * the next ordinary reload.
 *
 * Usage: node verify_bb_fragment.js [--app <path>] [--port 9850]
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round12/app.html');
const PORT = Number(arg('port', '9850'));

const STATE = `(() => {
  const metas = Array.from(document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]'));
  const strict = metas.filter(m => !/jsdelivr/i.test(m.content || ''));
  const chip = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0
    && /external requests|local renderer/i.test(e.textContent || ''));
  let stored = null; try { stored = Object.entries(localStorage).filter(([k]) => /internet|offline|network/i.test(k)); } catch (e) {}
  const box = Array.from(document.querySelectorAll('input[type="checkbox"]')).find(b => {
    const l = (b.closest('label') || {}).textContent || document.querySelector('label[for="' + b.id + '"]')?.textContent || '';
    return /external request|internet|offline/i.test(l);
  });
  return JSON.stringify({
    url: location.href.replace(/^https?:\\/\\/[^/]+/, ''),
    cspCount: metas.length,
    strictInstalled: strict.length,
    chip: chip ? (chip.textContent || '').trim().slice(0, 52) : null,
    checkbox: box ? box.checked : 'not found',
    stored
  });
})()`;

async function settle(page) {
  for (let i = 0; i < 70; i++) {
    const ok = await page.evaluate(`!!document.querySelector('#diagram svg')`);
    if (ok) break;
    await page.waitForTimeout(250);
  }
  for (let i = 0; i < 22; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 5) break;
    await page.waitForTimeout(170);
  }
}

/* Turn the switch by pressing its real checkbox.
 *
 * The click may navigate - that is the whole point of the feature, and it is what SHOULD happen.
 * So the press and the wait are separated: awaiting inside the page throws "execution context was
 * destroyed" on exactly the path that works, and the probe would then only survive the broken one. */
async function flip(page) {
  const found = await page.evaluate(`(() => {
    const box = Array.from(document.querySelectorAll('input[type="checkbox"]')).find(b => {
      const l = (b.closest('label') || {}).textContent || document.querySelector('label[for="' + b.id + '"]')?.textContent || '';
      return /external request|internet|offline/i.test(l);
    });
    if (!box) return 'no switch found';
    let p = box.parentElement;
    for (let i = 0; i < 8 && p; i++, p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
    box.click();
    return 'clicked ' + (box.id || '(unnamed)');
  })()`).catch(e => 'press threw: ' + String(e.message).slice(0, 40));
  let navigated = false;
  try {
    await page.waitForNavigation({ timeout: 2500 });
    navigated = true;
  } catch (e) { /* no navigation - which is itself the finding */ }
  await page.waitForTimeout(900);
  return found + (navigated ? '  [the page reloaded]' : '  [NO RELOAD HAPPENED]');
}

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const base = `http://127.0.0.1:${PORT}/${file}`;
  console.log('\nMeasured on ' + APP + '\n');

  // ---- A: plain URL, the path the patch was written for ----
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load', timeout: 90000 });
    await settle(page);
    console.log('  A. plain URL');
    console.log('     before: ' + await page.evaluate(STATE));
    console.log('     ' + await flip(page));
    await page.waitForTimeout(1200);
    console.log('     after : ' + await page.evaluate(STATE));
    await ctx.close();
  }

  // ---- B: reached the way a keyboard user reaches it - Tab, Enter on the skip link ----
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load', timeout: 90000 });
    await settle(page);
    const first = await page.evaluate(`(() => { document.body.focus(); return true; })()`);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(`(() => {
      const a = document.activeElement;
      return JSON.stringify({ tag: a.tagName, text: (a.textContent || '').trim().slice(0, 40), href: a.getAttribute && a.getAttribute('href') });
    })()`);
    console.log('\n  B. one Tab from a fresh load lands on: ' + focused);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    console.log('     URL is now: ' + await page.evaluate(`location.hash || '(no fragment)'`));
    console.log('     before: ' + await page.evaluate(STATE));
    console.log('     ' + await flip(page));
    await page.waitForTimeout(1200);
    const after = JSON.parse(await page.evaluate(STATE));
    console.log('     after : ' + JSON.stringify(after));
    console.log('     >> ' + (after.strictInstalled === 0
      ? 'NOTHING WAS INSTALLED. And localStorage says ' + JSON.stringify(after.stored)
      : 'strict policy installed, ' + after.strictInstalled));
    await ctx.close();
  }

  // ---- C: the dangerous direction - already strict, try to leave ----
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load', timeout: 90000 });
    await settle(page);
    await flip(page);                       // on, via a plain URL, so it really takes
    await page.waitForTimeout(1500);
    await settle(page);
    const on = JSON.parse(await page.evaluate(STATE));
    console.log('\n  C. the OFF direction, which is the one that endangers somebody');
    console.log('     strict is really on: strictInstalled=' + on.strictInstalled + '  chip=' + JSON.stringify(on.chip));
    await page.evaluate(`(() => { const a = document.querySelector('a[href^="#"]'); if (a) location.hash = a.getAttribute('href').slice(1); })()`);
    await page.waitForTimeout(500);
    console.log('     a fragment now in the URL: ' + await page.evaluate(`location.hash`));
    console.log('     ' + await flip(page));
    await page.waitForTimeout(1300);
    const off = JSON.parse(await page.evaluate(STATE));
    console.log('     after pressing it: ' + JSON.stringify(off));
    // now an ordinary reload, no fragment
    await page.goto(base, { waitUntil: 'load', timeout: 90000 });
    await settle(page);
    const later = JSON.parse(await page.evaluate(STATE));
    console.log('     after the next ordinary reload: strictInstalled=' + later.strictInstalled + '  chip=' + JSON.stringify(later.chip));
    console.log('     >> ' + (off.strictInstalled > 0 && later.strictInstalled === 0
      ? 'THE SCREEN SAID PROTECTED, AND THE PROTECTION DROPPED BY ITSELF AT THE NEXT RELOAD'
      : 'the two states agree'));
    await ctx.close();
  }

  await browser.close(); server.close();
})();
