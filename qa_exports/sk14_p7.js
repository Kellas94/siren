/* Probe 7 - the protection half of deletion 7: does Escape still end the tour,
 * does the dismissal still persist, does an open dialog still win, and does any
 * of it change on a different diagram type.
 */
const L = require('C:/Claude/SIREN/qa_exports/sk14_lib.js');
const BUILD = process.argv[2], PORT = Number(process.argv[3]), FILE = process.argv[4], TAG = process.argv[5] || 'x';

const FOCUS = `(() => { const a = document.activeElement; const c = document.querySelector('.tour-card');
  return JSON.stringify({ tag: a ? a.tagName : 'none', id: a ? (a.id||'') : '',
    text: a ? (a.textContent||a.value||'').replace(/[ ]+/g,' ').trim().slice(0,24) : '',
    inCard: !!(c && a && c.contains(a)) }); })()`;

async function clickById(page, id) {
  const box = JSON.parse(await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)});
    if (!e) return JSON.stringify(null); e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return JSON.stringify(null);
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2 }); })()`));
  if (!box) return false;
  await page.mouse.click(box.x, box.y); await page.waitForTimeout(250); return true;
}

const out = { build: BUILD, s: {} };
async function step(name, browser, fn) {
  const { page, ctx, errors } = await L.freshPage(browser, PORT, FILE);
  try { await L.waitTour(page); out.s[name] = await fn(page); out.s[name].errors = errors.slice(); }
  catch (e) { out.s[name] = { crashed: String(e.message).slice(0, 220), errors: errors.slice() }; }
  await ctx.close();
}

(async () => {
  const server = L.serve(BUILD, PORT);
  const browser = await L.launch();

  // W1: Escape dismisses, and the dismissal survives a reload. With a no-Escape control.
  await step('W1_dismissPersists', browser, async (page) => {
    await page.mouse.click(700, 60);   // neutral chrome click, focus on nobody's field
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const goneNow = !(await L.tourUp(page));
    await page.reload({ waitUntil: 'load' });
    await L.waitNoIntro(page);
    await page.waitForTimeout(3500);
    return { dismissedByEscape: goneNow, cardBackAfterReload: await L.tourUp(page) };
  });
  await step('W1control_noEscape', browser, async (page) => {
    const upBefore = await L.tourUp(page);
    await page.reload({ waitUntil: 'load' });
    await L.waitNoIntro(page);
    await page.waitForTimeout(3500);
    return { upBeforeReload: upBefore, cardBackAfterReload: await L.tourUp(page) };
  });

  // W2: a real modal dialog opened over the card still owns Escape first.
  await step('W2_dialogWins', browser, async (page) => {
    await clickById(page, 'exportButton');
    await page.waitForTimeout(800);
    const open1 = await page.evaluate(`(() => { const d = document.querySelector('dialog[open]'); return d ? d.id : null; })()`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const open2 = await page.evaluate(`(() => { const d = document.querySelector('dialog[open]'); return d ? d.id : null; })()`);
    const tourAfter1 = await L.tourUp(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    return { dialogOpened: open1, dialogAfterEscape: open2, tourAfterFirstEscape: tourAfter1,
      tourAfterSecondEscape: await L.tourUp(page) };
  });

  // W3: Escape in the code editor - where does focus land and does the tour survive?
  await step('W3_editorEscape', browser, async (page) => {
    await clickById(page, 'codeModeButton'); await page.waitForTimeout(400);
    await clickById(page, 'textModeButton'); await page.waitForTimeout(400);
    await clickById(page, 'source');
    const focusBefore = JSON.parse(await page.evaluate(FOCUS));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const focusAfter = JSON.parse(await page.evaluate(FOCUS));
    const tour1 = await L.tourUp(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    // now type something so undo is live, and repeat - the report says the landing changes
    return { focusBefore, focusAfter, tourAfterFirst: tour1, tourAfterSecond: await L.tourUp(page) };
  });

  // W4: one step sideways - a stateDiagram-v2 fixture, ASSERTED from #source.
  await step('W4_stateDiagram', browser, async (page) => {
    await clickById(page, 'codeModeButton'); await page.waitForTimeout(400);
    await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect');
      const d = s && s.closest('details'); if (d) d.open = true;
      if (s) { s.value = 'state'; s.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
    await page.waitForTimeout(500);
    // the starter control found BY LABEL, not by id
    const pressed = await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('button'))
      .find(x => x.offsetParent !== null && /new starter/i.test(x.textContent||''));
      if (!b) return 'not found'; const r = b.getBoundingClientRect(); b.click(); return 'clicked@' + Math.round(r.left); })()`);
    await page.waitForTimeout(600);
    const dlg = await page.evaluate(`(() => { const d = document.querySelector('dialog[open]'); return d ? d.id : null; })()`);
    const confirmed = await page.evaluate(`(() => { const d = document.querySelector('dialog[open]'); if (!d) return 'none';
      const b = Array.from(d.querySelectorAll('button')).find(x => /replace|confirm|yes|continue|ok|start|create/i.test(x.textContent) && !/cancel|keep|no/i.test(x.textContent));
      if (!b) return 'no confirm'; b.click(); return b.textContent.trim(); })()`);
    await page.waitForTimeout(1800);
    const src = await L.readSource(page);
    const isState = src.value ? src.value.includes('stateDiagram-v2') : false;
    // FIXTURE ASSERTED. Now the two keys, with the tour still up.
    const tourUp = await L.tourUp(page);
    await clickById(page, 'textModeButton'); await page.waitForTimeout(400);
    await clickById(page, 'source');
    const lenBefore = (await L.readSource(page)).len;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    const lenAfterTab = (await L.readSource(page)).len;
    const focusAfterTab = JSON.parse(await page.evaluate(FOCUS));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const tourAfterEsc1 = await L.tourUp(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `C:/Claude/SIREN/qa_exports/sk14_state_${TAG}.png` });
    return { starterPressed: pressed, dialogId: dlg, confirmed, srcLen: src.len,
      fixtureAsserted: isState, head: src.value ? src.value.slice(0, 40) : null,
      tourUpAtPress: tourUp, lenBefore, lenAfterTab, focusAfterTab,
      tourAfterEsc1, tourAfterEsc2: await L.tourUp(page) };
  });

  console.log('SK14_P7 ' + JSON.stringify(out));
  await browser.close(); server.close();
})().catch(e => { console.error('FATAL', e); console.log('SK14_P7 ' + JSON.stringify(out)); process.exit(0); });
