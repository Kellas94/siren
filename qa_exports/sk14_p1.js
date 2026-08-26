/* Probe 1 - reconnaissance + the reopened-hole measurement.
 * Same script, both builds. Nothing is asserted here; it prints what it saw.
 */
const L = require('C:/Claude/SIREN/qa_exports/sk14_lib.js');

const BUILD = process.argv[2];
const PORT = Number(process.argv[3]);
const FILE = process.argv[4];

const WALK = (n) => `(async () => {
  const out = [];
  return JSON.stringify(out);
})()`;

async function tabWalk(page, presses) {
  const seen = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const f = await L.describeFocus(page);
    seen.push(f);
    if (f.inCard) break;
  }
  return seen;
}

async function shiftTabWalk(page, presses) {
  const seen = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Shift+Tab');
    const f = await L.describeFocus(page);
    seen.push(f);
    if (f.inCard) break;
  }
  return seen;
}

(async () => {
  const server = L.serve(BUILD, PORT);
  const browser = await L.launch();
  const out = { build: BUILD, scenarios: {} };

  // --- A. what the first run actually looks like ---
  {
    const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
    const arrived = await L.waitTour(page);
    const recon = JSON.parse(await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      const src = document.getElementById('source');
      const modeButtons = ['visualModeButton','codeModeButton','structureModeButton','textModeButton']
        .map(id => { const b = document.getElementById(id); return b ? id + '=' + (b.getAttribute('aria-pressed') || b.className.includes('active') ? 'on' : 'off') : id + '=missing'; });
      return JSON.stringify({
        cardText: card ? card.textContent.replace(/[ ]+/g,' ').slice(0,120) : null,
        cardIsLastChild: card ? (document.body.lastElementChild === card) : null,
        cardIndexFromEnd: card ? (Array.from(document.body.children).length - Array.from(document.body.children).indexOf(card)) : null,
        cardTabindex: card ? card.getAttribute('tabindex') : null,
        cardRole: card ? card.getAttribute('role') : null,
        cardButtons: card ? Array.from(card.querySelectorAll('button')).map(b=>b.textContent.trim()) : null,
        srcLen: src ? src.value.length : -1,
        src: src ? src.value : null,
        srcVisible: src ? !!src.offsetParent : null,
        modeButtons,
        activeElement: document.activeElement ? (document.activeElement.tagName + '#' + document.activeElement.id) : 'none',
        focusableCount: document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])').length
      });
    })()`));
    out.scenarios.recon = { arrived, ...recon, errors: errors.slice() };
    await ctx.close();
  }

  // --- B. tabs to reach a control inside the tour card, from a neutral body click ---
  {
    const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
    await L.waitTour(page);
    // neutral click: the app shell background, away from every control
    await page.mouse.click(6, 460);
    const before = await L.describeFocus(page);
    const walk = await tabWalk(page, 200);
    out.scenarios.tabsToCardFromNeutralClick = {
      startFocus: before,
      presses: walk.length,
      reached: walk.length ? walk[walk.length - 1].inCard : false,
      last: walk.length ? walk[walk.length - 1] : null,
      first8: walk.slice(0, 8),
      tourStillUp: await L.tourUp(page),
      errors: errors.slice()
    };
    await ctx.close();
  }

  // --- C. shift-tab (backwards) to reach the card, from a neutral body click ---
  {
    const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
    await L.waitTour(page);
    await page.mouse.click(6, 460);
    const walk = await shiftTabWalk(page, 60);
    out.scenarios.shiftTabsToCard = {
      presses: walk.length,
      reached: walk.length ? walk[walk.length - 1].inCard : false,
      trail: walk.slice(0, 12),
      errors: errors.slice()
    };
    await ctx.close();
  }

  // --- D. does the tour itself still work? six steps, real mouse clicks on Next ---
  {
    const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
    await L.waitTour(page);
    const steps = [];
    for (let i = 0; i < 8; i++) {
      const st = JSON.parse(await page.evaluate(`(() => {
        const card = document.querySelector('.tour-card');
        if (!card) return JSON.stringify(null);
        const h = card.querySelector('strong');
        const next = Array.from(card.querySelectorAll('button')).find(b => /next|done/i.test(b.textContent));
        const r = next ? next.getBoundingClientRect() : null;
        return JSON.stringify({
          heading: h ? h.textContent : '',
          nextLabel: next ? next.textContent.trim() : null,
          box: r ? { x: r.left + r.width/2, y: r.top + r.height/2 } : null,
          highlights: Array.from(document.querySelectorAll('.tour-highlight')).map(n => n.id || n.className).slice(0,3)
        });
      })()`));
      if (!st) { steps.push({ gone: true }); break; }
      steps.push({ heading: st.heading, next: st.nextLabel, highlights: st.highlights });
      if (!st.box) break;
      await page.mouse.click(st.box.x, st.box.y);
      await page.waitForTimeout(220);
      if (i === 0) steps[0].focusAfterFirstNext = await L.describeFocus(page);
    }
    out.scenarios.tourWalkthrough = {
      steps,
      cardGone: !(await L.tourUp(page)),
      tourDone: await page.evaluate(`(() => { try { return JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/siren/i.test(k))||'')||'{}').tourDone; } catch(e) { return 'unreadable'; } })()`),
      errors: errors.slice()
    };
    await ctx.close();
  }

  console.log('SK14_P1 ' + JSON.stringify(out));
  await browser.close();
  server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
