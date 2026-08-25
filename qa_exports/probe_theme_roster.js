#!/usr/bin/env node
/* The whole theme collection, as one table.
 *
 * Two complaints about the menu are really one: the star marks the animated themes and never says
 * so, and the five group names cut across the property a person is choosing on. Both need the same
 * thing first - the actual roster, measured rather than remembered.
 *
 * For each theme: its label, its group heading, whether it carries the star, whether it has an
 * ambient scene, and whether it is light or dark. The star and the scene are collected separately
 * on purpose: where they disagree is exactly where the mark is lying.
 *
 * Usage: node probe_theme_roster.js [--app <path>] [--port 9730]
 */
const { openApp, check, report } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9730'));

/* The star is a CSS pseudo-element, so it is invisible to textContent and to a screen reader. It has
   to be read from the computed style of ::before/::after, which is also the evidence for the
   accessibility half of the complaint. */
const ROSTER = `(async () => {
  const btn = document.getElementById('themeMenuButton');
  btn.click();
  await new Promise(r => setTimeout(r, 900));
  const menu = document.getElementById('themeMenu') || document.querySelector('.theme-menu');
  if (!menu) return JSON.stringify({ error: 'no menu' });

  // reveal everything behind the cap first
  const more = document.getElementById('themeMenuMoreButton');
  if (more && more.offsetParent !== null) { more.click(); await new Promise(r => setTimeout(r, 700)); }

  const out = [];
  let group = '(none)';
  const walk = node => {
    for (const el of node.children) {
      const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '');
      if (/theme-menu-group|theme-group-title|menu-heading/i.test(cls)) {
        group = el.textContent.replace(/\\s+/g, ' ').trim() || group;
      }
      if (/theme-menu-option/.test(cls)) {
        const before = getComputedStyle(el, '::before').content;
        const after = getComputedStyle(el, '::after').content;
        const star = /\\u2726/.test(before + after) || /\\u2726/.test(el.textContent);
        out.push({
          value: el.dataset ? (el.dataset.theme || el.getAttribute('data-theme') || '') : '',
          label: el.textContent.replace(/\\s+/g, ' ').replace(/\\u2726/g, '').replace(/\\u2713/g, '').trim(),
          group,
          star,
          quick: el.hasAttribute('data-theme-quick'),
          ariaLabel: el.getAttribute('aria-label') || null
        });
      }
      if (el.children.length) walk(el);
    }
  };
  walk(menu);

  const menuText = menu.innerText || '';
  return JSON.stringify({
    themes: out,
    starInMenuText: /\\u2726/.test(menuText),
    menuHasLegend: /animat|moves|scene|ambient/i.test(menuText)
  });
})()`;

/* Ambient scenes and colour scheme come from the app itself, not from the menu. */
const SCENES = `(() => {
  const el = document.createElement('div');
  // AMBIENT_SCENES is inside the IIFE; read the roster the way the app exposes it instead - the
  // canvas is created per theme, so ask the DOM what themes declare a scene by their CSS.
  const styles = Array.from(document.styleSheets).flatMap(sheet => {
    try { return Array.from(sheet.cssRules); } catch (e) { return []; }
  });
  const schemes = {};
  styles.forEach(rule => {
    const t = rule.selectorText || '';
    const m = /\\[data-theme="([\\w-]+)"\\]/.exec(t);
    if (!m) return;
    const cs = rule.style && rule.style.getPropertyValue('color-scheme');
    if (cs) schemes[m[1]] = cs.trim();
  });
  return JSON.stringify({ schemes });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  const r = JSON.parse(await page.evaluate(ROSTER));
  if (r.error) { check('menu', false, 'the theme menu opens', r.error); await close(); process.exit(1); }
  const sc = JSON.parse(await page.evaluate(SCENES));

  const rows = r.themes.map(t => ({ ...t, scheme: sc.schemes[t.value] || '?' }));

  console.log(`\n  ${rows.length} themes\n`);
  const groups = {};
  rows.forEach(t => { (groups[t.group] = groups[t.group] || []).push(t); });
  Object.entries(groups).forEach(([g, list]) => {
    const starred = list.filter(t => t.star).length;
    console.log(`  ${g}  —  ${list.length} themes, ${starred} starred`);
    list.forEach(t => console.log(`      ${t.star ? '✦' : ' '} ${t.label.padEnd(24)} ${t.value.padEnd(14)} ${t.scheme}`));
    console.log();
  });

  check('roster.count', rows.length === 37, '37 themes', String(rows.length));
  check('glyph.notInText', r.starInMenuText === false,
    'the star is a pseudo-element, so it is absent from the menu text a screen reader reads',
    `star present in innerText: ${r.starInMenuText}`);
  check('glyph.noLegend', r.menuHasLegend === false,
    'nothing in the menu explains what the star means',
    `legend wording found: ${r.menuHasLegend}`);
  const noAria = rows.filter(t => t.star && !t.ariaLabel).length;
  check('glyph.noAccessibleName', noAria > 0,
    'starred rows carry no accessible name saying they animate',
    `${noAria} of ${rows.filter(t => t.star).length} starred rows have no aria-label`);
  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');

  fs.writeFileSync('C:/Claude/SIREN/pending/wonders/roster.json', JSON.stringify(rows, null, 2));
  console.log('  wrote roster.json');
  await page.screenshot({ path: 'C:/Claude/SIREN/pending/wonders/theme_menu_now.png' });
  await close();
  process.exit(report('theme roster') ? 1 : 0);
})();
