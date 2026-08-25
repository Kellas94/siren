#!/usr/bin/env node
/* Verification for the three dead-UI fixes, run on the patched bytes. */
const fs = require('fs'), path = require('path'), http = require('http');
const { createRequire } = require('module');
const { chromium } = createRequire('file:///C:/Users/tsinc/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/')('playwright');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app'), PORT = Number(arg('port', '9947'));

let fail = 0;
const check = (id, ok, exp, act) => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} | expected=${exp} | actual=${act}`); };

const SETTLE = `(async () => {
  for (let i = 0; i < 80; i++) { if (document.querySelector('#diagram svg')) break; await new Promise(r => setTimeout(r, 300)); }
  // "Next" does not match skip/done/close, so the welcome tour survived the first run of this
  // and held focus on its own button - which would confound any focus assertion below.
  for (let pass = 0; pass < 12; pass++) {
    const b = Array.from(document.querySelectorAll('.tour-card button'))
      .find(x => /skip|done|got it|close|next|finish/i.test(x.textContent));
    if (!b) break;
    b.click(); await new Promise(r => setTimeout(r, 220));
  }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  document.body.click(); await new Promise(r => setTimeout(r, 2500)); return 1;
})()`;

const seeChip = `(() => {
  const c = document.querySelector('#diagramTypeChip');
  if (!c) return JSON.stringify({ present: false });
  const r = c.getBoundingClientRect();
  return JSON.stringify({
    present: true, w: Math.round(r.width), h: Math.round(r.height),
    right: Math.round(r.right), text: (document.querySelector('#diagramTypeText') || {}).textContent,
    title: c.title, state: c.dataset.state,
    hiddenAttr: c.hasAttribute('hidden'), ariaHidden: c.getAttribute('aria-hidden')
  });
})()`;

const seeAlignment = `(() => {
  const a = document.querySelector('#layoutAlignment'), h = document.querySelector('#layoutAlignmentHint');
  return JSON.stringify({
    present: !!a, disabled: a ? a.disabled : null,
    hint: h ? h.textContent : null, hintPresent: !!h
  });
})()`;

(async () => {
  const root = path.dirname(APP), file = path.basename(APP);
  const server = http.createServer((q, s) => fs.readFile(path.join(root, decodeURIComponent(q.url.split('?')[0])),
    (e, d) => e ? (s.writeHead(404), s.end()) : (s.writeHead(200), s.end(d)))).listen(PORT);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(SETTLE);

    check('boot.noExceptions', errs.length === 0, 'no page errors', errs.length ? errs.join(' // ') : 'none');

    // ---- 1. the chip is now visible and carries its per-type sentence ----
    const chip = JSON.parse(await page.evaluate(seeChip));
    check('chip.visible', chip.present && chip.w > 0 && chip.h > 0, 'a chip with real size', `${chip.w}x${chip.h}`);
    check('chip.notHidden', chip.present && !chip.hiddenAttr && chip.ariaHidden !== 'true', 'no hidden / aria-hidden', `hidden=${chip.hiddenAttr} aria-hidden=${chip.ariaHidden}`);
    check('chip.hasText', !!(chip.text || '').trim(), 'the diagram type as text', JSON.stringify(chip.text));
    check('chip.hasTooltip', !!(chip.title || '').trim(), 'the per-type capability sentence', JSON.stringify((chip.title || '').slice(0, 60)));

    // ---- the chip's whole point: does clicking it reach the type picker? ----
    // Sampled over time rather than once: a single late read cannot tell "focus never landed"
    // apart from "focus landed and something stole it", and those are different defects.
    const jump = JSON.parse(await page.evaluate(`(async () => {
      const trail = [];
      document.querySelector('#diagramTypeChip').click();
      for (const wait of [50, 150, 400, 900, 1600]) {
        await new Promise(r => setTimeout(r, wait));
        trail.push(wait + 'ms:' + ((document.activeElement && document.activeElement.id) || document.activeElement.tagName));
      }
      const sel = document.querySelector('#diagramTypeSelect');
      const r = sel ? sel.getBoundingClientRect() : null;
      return JSON.stringify({
        trail,
        everFocused: trail.some(t => t.includes('diagramTypeSelect')),
        selectVisible: !!(r && r.width > 0 && r.height > 0),
        inViewport: !!(r && r.top >= 0 && r.bottom <= window.innerHeight)
      });
    })()`));
    check('chip.reachesTypePicker', jump.selectVisible && jump.inViewport,
      'the type select on screen after the click', `visible=${jump.selectVisible} inViewport=${jump.inViewport}`);
    check('chip.focusesTypePicker', jump.everFocused,
      'focus lands on the type select at some point', jump.trail.join(' -> '));

    // ---- 2. direction still works (the block we deliberately did NOT delete) ----
    const dir = JSON.parse(await page.evaluate(`(async () => {
      const s = document.querySelector('#source');
      s.value = 'flowchart TD\\n  A[One] --> B[Two]';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 3500));
      const svg = document.querySelector('#diagram svg');
      const box = svg.getBoundingClientRect();
      const before = Math.round(box.width) + 'x' + Math.round(box.height);
      const d = document.querySelector('#direction');
      d.value = 'LR'; d.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 3500));
      const after2 = document.querySelector('#diagram svg').getBoundingClientRect();
      return JSON.stringify({ before, after: Math.round(after2.width) + 'x' + Math.round(after2.height) });
    })()`));
    check('direction.stillWorks', dir.before !== dir.after,
      'TD -> LR changes the drawing shape', `${dir.before} -> ${dir.after}`);

    // ---- 3. alignment discloses which renderer it applies to ----
    const al = JSON.parse(await page.evaluate(seeAlignment));
    check('alignment.hintExists', al.hintPresent, 'a hint element beside the control', al.hintPresent);
    check('alignment.disabledUnderMermaid', al.disabled === true,
      'disabled while the Mermaid renderer is active', `disabled=${al.disabled}`);
    check('alignment.saysWhy', /Mermaid/.test(al.hint || ''),
      'a sentence naming the renderer', JSON.stringify(al.hint));

    // ---- the chip must not break the bar on other types or narrow widths ----
    // The sources carry double quotes, so they have to be embedded as encoded JSON, not
    // interpolated into a quoted string - doing that produced a SyntaxError on the first run.
    for (const [name, src] of [['pie', 'pie showData\n "A" : 40\n "B" : 60'], ['mindmap', 'mindmap\n root((R))\n  A']]) {
      await page.evaluate(`(async () => {
        const s = document.querySelector('#source'); s.value = ${JSON.stringify(src)};
        s.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 3500)); return 1;
      })()`);
      const c = JSON.parse(await page.evaluate(seeChip));
      check(`chip.${name}.stillVisible`, c.w > 0 && c.h > 0 && c.right <= 1600,
        'visible and inside the viewport', `${c.w}x${c.h} right=${c.right} text=${JSON.stringify(c.text)}`);
    }
    await ctx.close();

    // ---- narrow width ----
    const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const p2 = await ctx2.newPage();
    await p2.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load', timeout: 60000 });
    await p2.evaluate(SETTLE);
    const c375 = JSON.parse(await p2.evaluate(seeChip));
    check('chip.375.noOverflow', !c375.present || c375.w === 0 || c375.right <= 375,
      'not painting past the right edge at 375px', `w=${c375.w} right=${c375.right}`);
    await ctx2.close();
  } finally {
    await browser.close(); server.close();
  }
  console.log(`\n${fail ? 'FAILED' : 'ALL PASS'} — ${fail} failing assertion(s)`);
  process.exit(fail ? 1 : 0);
})();
