#!/usr/bin/env node
/* The wonders theme, both modes: does it exist, apply, animate, and look like anything?
 *
 * A theme is easy to add and hard to add well. The numbers here only establish that it is wired up -
 * the preset applies, the scene runs, the star is on the row. Whether the horizon reads as a horizon
 * is decided by opening the screenshots, which this writes and which must be looked at.
 *
 * Includes the roster check that made this job necessary: KPMG Blue animates and carried no star.
 *
 * Usage: node verify_wonders.js [--app <path>] [--port 9860]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/wonders_build/app.html');
const PORT = Number(arg('port', '9860'));

const SRC = ['flowchart TD', '  A[Purchase request] --> B{Approved}', '  B -->|yes| C[Raise order]',
             '  B -->|no| D[Return to requester]', '  C --> E[Goods received]'].join('\n');

const APPLY = value => `(async () => {
  document.getElementById('themeMenuButton').click();
  await new Promise(r => setTimeout(r, 800));
  const more = document.getElementById('themeMenuMoreButton');
  if (more && more.offsetParent !== null) { more.click(); await new Promise(r => setTimeout(r, 600)); }
  const opt = document.querySelector('.theme-menu-option[data-theme-value=' + JSON.stringify(${JSON.stringify(value)}) + ']');
  if (!opt) return JSON.stringify({ ok: false, why: 'no option' });
  const star = getComputedStyle(opt.querySelector('span:nth-child(2)'), '::before').content;
  opt.click();
  await new Promise(r => setTimeout(r, 2200));
  const body = document.body;
  // data-theme sits on <body>, so the rule that declares color-scheme matches body.
  const cs = getComputedStyle(document.body).colorScheme;
  const canvas = document.getElementById('ambientCanvas');
  return JSON.stringify({
    ok: true,
    starContent: star,
    theme: body.dataset.theme || null,
    ambient: body.dataset.ambient || null,
    colorScheme: cs,
    canvas: canvas ? { w: canvas.width, h: canvas.height, hidden: canvas.hidden } : null,
    nodeFill: getComputedStyle(document.documentElement).getPropertyValue('--node-fill').trim(),
    canvasBg: getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim()
  });
})()`;

/* Is anything actually being painted? Sample the ambient canvas twice, seconds apart. */
const PAINTED = `(async () => {
  const c = document.getElementById('ambientCanvas');
  if (!c) return JSON.stringify({ ok: false });
  const grab = () => { try { return c.getContext('2d').getImageData(0, Math.floor(c.height * 0.88), Math.min(400, c.width), 1).data.join(','); } catch (e) { return 'err:' + e.message; } };
  const a = grab();
  await new Promise(r => setTimeout(r, 2600));
  const b = grab();
  const nonEmpty = a.split(',').some((v, i) => i % 4 === 3 && Number(v) > 0);
  return JSON.stringify({ ok: true, nonEmpty, moved: a !== b, sample: a.slice(0, 40) });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1600, height: 1000 });
  await setSource(page, SRC, 4000);

  for (const [value, label, scheme] of [['wonders', 'night', 'dark'], ['wondersday', 'day', 'light']]) {
    const r = JSON.parse(await page.evaluate(APPLY(value)));
    if (!r.ok) { check(`${label}.applies`, false, 'the theme is in the menu', r.why); continue; }

    check(`${label}.applies`, r.theme === value,
      `choosing it sets data-theme="${value}"`, `theme=${r.theme} scheme=${r.colorScheme}`);
    check(`${label}.colourScheme`, r.colorScheme === scheme,
      `it declares color-scheme: ${scheme}`, String(r.colorScheme));
    // Read the DRAWING, not :root. themePresets drives the Mermaid palette, so the custom
    // properties on :root keep their defaults and a check against them passes on every theme -
    // it reported "the palette reaches the diagram" while the diagram was still wearing Dark.
    const painted = JSON.parse(await page.evaluate(`(() => {
      const n = document.querySelector('#diagram svg g.node rect, #diagram svg g.node polygon');
      return JSON.stringify({ fill: n ? getComputedStyle(n).fill : null });
    })()`));
    const expected = value === 'wonders' ? 'rgb(230, 220, 195)' : 'rgb(251, 246, 234)';
    check(`${label}.paletteReachesTheDrawing`, painted.fill === expected,
      `a block is painted ${expected}`,
      `block fill = ${painted.fill}`);
    check(`${label}.carriesTheStar`, /\u2726/.test(r.starContent || ''),
      'the row carries the star, because it animates', JSON.stringify(r.starContent));
    // syncAmbientScene writes the literal 'on', not the theme key - expecting the key made a
    // correct build look broken.
    check(`${label}.sceneRegistered`, r.ambient === 'on',
      'a scene is running for this theme', `data-ambient=${r.ambient}`);

    const p = JSON.parse(await page.evaluate(PAINTED));
    check(`${label}.scenePaints`, p.ok && p.nonEmpty,
      'the ambient canvas has something on it near the horizon',
      p.ok ? `nonEmpty=${p.nonEmpty} moved=${p.moved}` : 'no canvas');

    await page.screenshot({ path: `C:/Claude/SIREN/pending/wonders/applied_${label}.png` });
    console.log(`  wrote applied_${label}.png`);
  }

  // the roster inconsistency this job also closed
  const kpmg = await page.evaluate(`(() => {
    const o = document.querySelector('.theme-menu-option[data-theme-value="kpmg"]');
    if (!o) return 'missing';
    return getComputedStyle(o.querySelector('span:nth-child(2)'), '::before').content;
  })()`);
  check('kpmg.nowCarriesItsStar', /\u2726/.test(kpmg || ''),
    'KPMG Blue animates, so it is marked like every other theme that does',
    JSON.stringify(kpmg));

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 3).join(' // ') || 'none');
  await close();
  process.exit(report('wonders') ? 1 : 0);
})();
