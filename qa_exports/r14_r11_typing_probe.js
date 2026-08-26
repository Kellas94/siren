#!/usr/bin/env node
/* Round 11's original win, which everything since has to leave alone: the first-run tour card
 * arms on a timer while somebody is already typing, and it must not take the caret.
 *
 * Fresh context, empty storage, real keys at ~170ms each, straddling the moment the card appears.
 * activeElement is sampled continuously - not once at the end - because a steal that is undone a
 * frame later still eats the keystroke that landed during it.
 *
 * Usage: node r14_r11_typing_probe.js --app <path> --port <n> --out <json>
 */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round14/app.html');
const PORT = Number(arg('port', '9715'));
const OUT = arg('out', 'C:/Claude/SIREN/qa_exports/r14_r11_out.json');
const RUNS = Number(arg('runs', '3'));
const PHRASE = 'Review request';

const ACTIVE = `(() => { const a = document.activeElement; if (!a) return 'null';
  if (a === document.body) return 'BODY';
  if (a.closest && a.closest('.tour-card')) return 'TOURCARD';
  return (a.id ? '#' + a.id : a.tagName.toLowerCase()); })()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  const out = { app: APP, runs: [] };

  for (let run = 0; run < RUNS; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });

    const t0 = Date.now();
    await page.goto('http://127.0.0.1:' + PORT + '/' + file, { waitUntil: 'load', timeout: 90000 });
    const rec = { run, loadMs: Date.now() - t0, errors: null };

    // A continuous sampler inside the page: 25ms resolution, so a steal that lasts one frame is
    // still on the record. Started before the first key and read back after the last one.
    await page.evaluate(`(() => {
      window.__samples = [];
      window.__t0 = performance.now();
      window.__sampler = setInterval(() => {
        const a = document.activeElement;
        const who = !a ? 'null' : a === document.body ? 'BODY'
          : (a.closest && a.closest('.tour-card')) ? 'TOURCARD'
          : (a.id ? '#' + a.id : a.tagName.toLowerCase());
        const card = !!document.querySelector('.tour-card');
        const ov = document.getElementById('sirenIntroOverlay');
        const intro = !!(ov && !ov.hidden);
        const last = window.__samples[window.__samples.length - 1];
        if (!last || last.who !== who || last.card !== card || last.intro !== intro) {
          window.__samples.push({ t: Math.round(performance.now() - window.__t0), who, card, intro });
        }
      }, 25);
    })()`);

    // Wait only until the app is actually operable: the brand intro covers everything, and a real
    // mouse click before it lifts lands on the overlay. This has to be an IN-PAGE poll: a loop of
    // page.evaluate round trips costs ~400ms, which was enough to miss the window entirely - the
    // tour card had already armed before the first key, so the earlier run measured nothing.
    // The app's CSP forbids unsafe-eval, so waitForFunction with a string predicate is not
    // available here. Wait on the clock instead: the brand intro runs 1.7s and the tour arms at
    // 1.9s, so a click at ~1.75s lands on a live app with the card still to come. Whether the
    // overlay had really lifted is not assumed - the in-page sampler records it.
    // The brand plate runs 1.75s and is still hit-testable at 1.7s - a click aimed at the field
    // through it lands on the overlay and focuses nothing, which is how an earlier version of this
    // probe measured an empty field on BOTH builds and proved nothing. The app's own escape hatch
    // is a click: playSirenIntro binds skipSirenIntro to the overlay's pointerdown. So end it the
    // way a person does, then type - the tour's own timer is unaffected by skipping, so the card
    // still arrives mid-phrase.
    const target = Number(arg('startMs', '900'));
    const remaining = target - (Date.now() - t0);
    if (remaining > 0) await page.waitForTimeout(remaining);
    await page.mouse.click(700, 300);
    rec.introSkippedAtMs = Date.now() - t0;
    rec.operableAtMs = Date.now() - t0;
    // One evaluate, cached, so the click is not delayed by a round trip per reading.
    const pre = await page.evaluate(`(() => {
      const f = document.getElementById('visualNodeLabel');
      const r = f.getBoundingClientRect();
      const p = document.getElementById('visualModePanel');
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        hit: hit ? (hit.tagName + '#' + (hit.id || '')) : 'none',
        card: !!document.querySelector('.tour-card'), panel: !!p && !p.hidden }; })()`);
    rec.tourUpAtStart = pre.card;
    rec.visualPanelOpen = pre.panel;
    rec.fieldRect = pre.rect;
    rec.whatIsAtThePoint = pre.hit;
    await page.mouse.click(pre.x, pre.y);
    rec.clickAtMs = Date.now() - t0;

    // ~170ms per key, real key presses. Nothing is read back between keys: an evaluate round trip
    // costs 30-60ms each and would stretch a 2.4s window into 3.3s. The in-page sampler is the
    // instrument; it is running at 25ms the whole time.
    for (const ch of PHRASE) {
      await page.keyboard.press(ch === ' ' ? 'Space' : ch);
      await page.waitForTimeout(170);
    }
    rec.typingEndedAtMs = Date.now() - t0;
    rec.finalValue = await page.evaluate("document.getElementById('visualNodeLabel').value");
    rec.allFourteen = rec.finalValue === PHRASE;
    rec.charsKept = rec.finalValue.length;
    rec.focusAtEnd = await page.evaluate(ACTIVE);

    await page.evaluate("clearInterval(window.__sampler)");
    rec.samples = await page.evaluate("window.__samples");
    rec.tourAppearedAtMs = (rec.samples.find(s => s.card) || {}).t;
    rec.sampledStealsOfFocus = rec.samples.filter(s => s.who === 'TOURCARD').length;
    rec.focusEverLeft = rec.samples.some(s => s.who !== '#visualNodeLabel' && s.t > rec.clickAtMs - rec.loadMs);
    rec.straddled = rec.tourAppearedAtMs !== undefined
      && rec.tourAppearedAtMs > rec.clickAtMs && rec.tourAppearedAtMs < rec.typingEndedAtMs;
    rec.tourAtEnd = await page.evaluate("(() => { const c = document.querySelector('.tour-card'); return c ? (c.querySelector('strong')||{}).textContent : null; })()");
    rec.errors = errors.slice(0, 6);
    out.runs.push(rec);
    console.log('  run ' + run + ' -> value="' + rec.finalValue + '" kept=' + rec.charsKept + '/14'
      + ' focusEverLeft=' + rec.focusEverLeft + ' straddled=' + rec.straddled + ' tourAt=' + rec.tourAppearedAtMs
      + ' typedFrom=' + rec.clickAtMs + 'ms to ' + rec.typingEndedAtMs + 'ms'
      + ' samples=' + JSON.stringify(rec.samples));
    await ctx.close();
  }

  await browser.close(); server.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('WROTE ' + OUT);
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(1); });
