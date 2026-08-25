#!/usr/bin/env node
/* JOB BC - SKEPTIC PROBE 1
 * Measures the confirm dialog's two presentations as PIXELS and as FOCUS, not as class names.
 * Same script, same fixture, run on BASE and on MERGED.
 *
 * Q1  What does a person actually see: is the destructive button louder or quieter than the safe one?
 * Q2  Does the destructive button read as disabled (the app's own .btn:disabled is opacity .45)?
 * Q3  After a NOTICE (which calls .focus() on the action button), where does focus land on the
 *     NEXT confirmation - and what does Enter do there?
 *
 * Usage: node bcx_probe1.js --app <path> --port <n> --tag <base|merged>
 */
const fs = require('fs');
const path = require('path');
const { openApp, setSource } = require('./r7_lib');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round12/app.html');
const PORT = Number(arg('port', '9822'));
const TAG = arg('tag', 'x');
const OUT = 'C:/Claude/SIREN/qa_exports/bcx';
const NL = String.fromCharCode(10);

const FIXTURE = [
  'flowchart TD',
  '    A[Alpha] -->|yes| B[Bravo]',
  '    B -->|no| C[Charlie]',
  '    C --> D[Delta]'
].join(NL);

async function killTour(page) {
  for (let i = 0; i < 30; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent))
        || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 8) return;
    await page.waitForTimeout(200);
  }
}

const READ_DIALOG = `(() => {
  const d = document.getElementById('confirmDialog');
  if (!d || !d.open) return JSON.stringify({ open: false });
  const ok = document.getElementById('confirmActionButton');
  const cancel = document.getElementById('cancelConfirmButton');
  const cs = getComputedStyle(ok), cc = getComputedStyle(cancel);
  const r = ok.getBoundingClientRect(), rc = cancel.getBoundingClientRect();
  return JSON.stringify({
    open: true,
    title: (document.getElementById('confirmDialogTitle').textContent || '').trim(),
    message: (document.getElementById('confirmDialogMessage').textContent || '').trim().slice(0, 150),
    okText: (ok.textContent || '').trim(),
    okClass: ok.className,
    okDanger: ok.classList.contains('danger'),
    okBg: cs.backgroundColor,
    okColor: cs.color,
    okBorder: cs.borderColor,
    okOpacity: cs.opacity,
    okBox: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    cancelHidden: cancel.hidden,
    cancelBg: cc.backgroundColor,
    cancelColor: cc.color,
    cancelBox: [Math.round(rc.left), Math.round(rc.top), Math.round(rc.width), Math.round(rc.height)],
    dialogBg: getComputedStyle(d).backgroundColor,
    whiteSpace: getComputedStyle(document.getElementById('confirmDialogMessage')).whiteSpace,
    activeElement: (document.activeElement && document.activeElement.id) || (document.activeElement && document.activeElement.tagName) || null
  });
})()`;

const CONTRAST = `(() => {
  function parse(c) {
    const m = document.createElement('span');
    m.style.color = c; document.body.appendChild(m);
    const v = getComputedStyle(m).color; m.remove();
    const n = v.match(/[-\\d.]+/g).map(Number);
    if (v.indexOf('color(') === 0) return { r: n[0] * 255, g: n[1] * 255, b: n[2] * 255, a: n.length > 3 ? n[3] : 1 };
    return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
  }
  function over(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function lum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
  const d = document.getElementById('confirmDialog');
  const ok = document.getElementById('confirmActionButton');
  const cancel = document.getElementById('cancelConfirmButton');
  const cs = getComputedStyle(ok), cc = getComputedStyle(cancel);
  const page = parse(getComputedStyle(d).backgroundColor);
  const okBgFlat = over(parse(cs.backgroundColor), page);
  const cancelBgFlat = over(parse(cc.backgroundColor), page);
  return JSON.stringify({
    okTextOnOkBg: Number(ratio(over(parse(cs.color), okBgFlat), okBgFlat).toFixed(2)),
    okBgVsDialogBg: Number(ratio(okBgFlat, page).toFixed(2)),
    cancelTextOnCancelBg: Number(ratio(over(parse(cc.color), cancelBgFlat), cancelBgFlat).toFixed(2)),
    cancelBgVsDialogBg: Number(ratio(cancelBgFlat, page).toFixed(2)),
    okBgFlat: [Math.round(okBgFlat.r), Math.round(okBgFlat.g), Math.round(okBgFlat.b)],
    cancelBgFlat: [Math.round(cancelBgFlat.r), Math.round(cancelBgFlat.g), Math.round(cancelBgFlat.b)],
    dialogBg: [Math.round(page.r), Math.round(page.g), Math.round(page.b)]
  });
})()`;

async function clickBySelector(page, sel) {
  const box = JSON.parse(await page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return JSON.stringify(null);
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return JSON.stringify({ tiny: true, w: r.width, h: r.height });
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return JSON.stringify({ x, y, hit: top ? (top.id || top.tagName) : null, owns: !!(top && (top === e || e.contains(top) || top.contains(e))) });
  })()`));
  if (!box || box.tiny || !box.owns) return { ok: false, box, sel };
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(550);
  return { ok: true, box, sel };
}

/* Click a row in the app's own popup menu BY ITS LABEL, with a real mouse press. */
async function clickMenuItem(page, rx) {
  const box = JSON.parse(await page.evaluate(`(() => {
    const items = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item'));
    const hit = items.find(b => ${rx}.test((b.textContent || '').trim()) && !b.disabled);
    if (!hit) return JSON.stringify({ miss: items.map(b => (b.textContent||'').trim()) });
    const r = hit.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return JSON.stringify({ x, y, label: (hit.textContent||'').trim(), owns: !!(top && (top === hit || hit.contains(top))) });
  })()`));
  if (!box || box.miss || !box.owns) return { ok: false, box };
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(600);
  return { ok: true, box };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  const out = { tag: TAG, app: APP, steps: {} };
  try {
    await killTour(page);
    await setSource(page, FIXTURE, 2600);
    out.steps.fixture = await page.evaluate(`document.getElementById('source').value`);

    // ---------- 1. NEUTRAL dialog: #resetButton -> "Reset the diagram?" (destructive:false) ----------
    await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
    await page.waitForTimeout(900);
    // The Reset button lives inside a collapsed <details>. Open it with a real click on the summary.
    out.steps.summaryClick = await clickBySelector(page, 'details.advanced-tools-card > summary');
    await page.waitForTimeout(600);
    out.steps.resetClick = await clickBySelector(page, '#resetButton');
    out.steps.neutral = JSON.parse(await page.evaluate(READ_DIALOG));
    if (out.steps.neutral.open) {
      out.steps.neutralContrast = JSON.parse(await page.evaluate(CONTRAST));
      await page.locator('#confirmDialog').screenshot({ path: path.join(OUT, TAG + '_neutral.png') });
    }
    await clickBySelector(page, '#cancelConfirmButton');
    out.steps.sourceAfterCancel = await page.evaluate(`document.getElementById('source').value.length`);

    // ---------- 2. DESTRUCTIVE dialog: add a diagram, then More -> Remove diagram ----------
    out.steps.addClick = await clickBySelector(page, '#addDiagramButton');
    out.steps.diagramCount = await page.evaluate(`document.querySelectorAll('.diagram-tab').length`);
    out.steps.moreClick = await clickBySelector(page, '#diagramMoreButton');
    out.steps.removePick = await clickMenuItem(page, '/remove diagram/i');
    out.steps.destructive = JSON.parse(await page.evaluate(READ_DIALOG));
    if (out.steps.destructive.open) {
      out.steps.destructiveContrast = JSON.parse(await page.evaluate(CONTRAST));
      await page.locator('#confirmDialog').screenshot({ path: path.join(OUT, TAG + '_destructive.png') });
      // Both buttons, cropped tight, so the two treatments can be compared side by side.
      await page.locator('#confirmDialog .dialog-actions, #confirmDialog footer, #confirmDialog').first()
        .screenshot({ path: path.join(OUT, TAG + '_destructive_full.png') }).catch(() => {});
    }

    // ---------- 3. How does the app paint a DISABLED primary button, for scale? ----------
    out.steps.disabledRef = JSON.parse(await page.evaluate(`(() => {
      const host = document.getElementById('confirmDialog');
      const b = document.createElement('button');
      b.className = 'btn'; b.disabled = true; b.textContent = 'x';
      host.appendChild(b);
      const cs = getComputedStyle(b);
      const r = { opacity: cs.opacity, bg: cs.backgroundColor, color: cs.color };
      b.remove();
      return JSON.stringify(r);
    })()`));

    await clickBySelector(page, '#cancelConfirmButton');
    await page.waitForTimeout(400);

    // ---------- 4. THE NOTICE ----------
    await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
    await page.waitForTimeout(500);
    await setSource(page, FIXTURE, 2400);
    await clickBySelector(page, '#visualModeButton');
    await page.waitForTimeout(1400);
    const bravo = JSON.parse(await page.evaluate(`(() => {
      const cands = Array.from(document.querySelectorAll('[data-canvas-node], .canvas-node, .visual-node, #diagram svg .node'));
      const hit = cands.find(e => /Bravo/.test(e.textContent || ''));
      if (!hit) return JSON.stringify(null);
      const r = hit.getBoundingClientRect();
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    })()`));
    out.steps.bravo = bravo;
    if (bravo) {
      await page.mouse.click(bravo.x, bravo.y);
      await page.waitForTimeout(600);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(800);
    }
    out.steps.notice = JSON.parse(await page.evaluate(READ_DIALOG));

    let escapes = 0;
    for (let i = 0; i < 4; i++) {
      const open = await page.evaluate(`(() => { const d = document.getElementById('confirmDialog'); return !!(d && d.open); })()`);
      if (!open) break;
      await page.keyboard.press('Escape');
      escapes++;
      await page.waitForTimeout(450);
    }
    out.steps.escapesToDismissNotice = escapes;

    // ---------- 5. The NEXT dialog after the notice: presentation AND focus ----------
    await page.evaluate(`(() => { document.getElementById('codeModeButton')?.click(); })()`);
    await page.waitForTimeout(700);
    out.steps.moreClick2 = await clickBySelector(page, '#diagramMoreButton');
    out.steps.removePick2 = await clickMenuItem(page, '/remove diagram/i');
    out.steps.afterNoticeDestructive = JSON.parse(await page.evaluate(READ_DIALOG));
    if (out.steps.afterNoticeDestructive.open) {
      await page.locator('#confirmDialog').screenshot({ path: path.join(OUT, TAG + '_afterNotice.png') });
    }

    // ---------- 6. What does ENTER do here? ----------
    const tabsBefore = await page.evaluate(`document.querySelectorAll('.diagram-tab').length`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    out.steps.afterEnter = {
      tabsBefore,
      tabsAfter: await page.evaluate(`document.querySelectorAll('.diagram-tab').length`),
      dialogOpen: await page.evaluate(`(() => { const d = document.getElementById('confirmDialog'); return !!(d && d.open); })()`),
      active: await page.evaluate(`(document.activeElement && document.activeElement.id) || null`)
    };
  } catch (e) {
    out.error = String(e && e.stack || e).slice(0, 900);
  }
  out.errors = errors;
  fs.writeFileSync(path.join(OUT, TAG + '_probe1.json'), JSON.stringify(out, null, 2));
  console.log('RESULT=' + JSON.stringify(out));
  await close();
})();
