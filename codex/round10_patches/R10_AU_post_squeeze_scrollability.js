#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'D7C047E62C159F1C687F7BBD05D2F702D36CDF058C3B62DEC5242611D255D17D';
const EXPECTED_OUTPUT_SHA256 = 'D5F5B7DC6C3D7C067435EB1C3E2469C26A5858900EF8E53D64E5C51200C11A3D';
const target = path.resolve(process.argv[2] || '');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 120)}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(target && fs.existsSync(target), 'pass the HTML file to patch');
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`        document.body.appendChild(menu);
        const scrollable = menu.scrollHeight > menu.clientHeight + 1;
        menu.dataset.scrollable = String(scrollable);
        if (scrollable) menu.setAttribute('aria-description', 'Scrollable menu. Use arrow keys, End, or the mouse wheel to reach every action.');
        // A menu can be anchored at a POINT rather than at a control - that is what a
        // right-click is. Everything else about the menu is unchanged; only the box the
        // placement arithmetic reads differs.
        const point = config && config.point;
        const box = point
          ? { left: point.x, top: point.y, right: point.x, bottom: point.y, width: 0, height: 0 }
          : anchor.getBoundingClientRect();
        // A plain menu has a 248px minimum. Below 264px that minimum is wider than
        // the viewport's two 8px insets, so the old right clamp became negative and
        // moved the left edge off-screen. Only constrain a menu that truly cannot fit.
        const availableWidth = Math.max(0, window.innerWidth - 16);
        if (menu.offsetWidth > availableWidth) {
          menu.style.minWidth = '0';
          menu.style.width = availableWidth + 'px';
          menu.style.maxWidth = availableWidth + 'px';
        }
        const height = menu.offsetHeight;`,
`        document.body.appendChild(menu);
        // A menu can be anchored at a POINT rather than at a control - that is what a
        // right-click is. Everything else about the menu is unchanged; only the box the
        // placement arithmetic reads differs.
        const point = config && config.point;
        const box = point
          ? { left: point.x, top: point.y, right: point.x, bottom: point.y, width: 0, height: 0 }
          : anchor.getBoundingClientRect();
        // A plain menu has a 248px minimum. Below 264px that minimum is wider than
        // the viewport's two 8px insets, so the old right clamp became negative and
        // moved the left edge off-screen. Only constrain a menu that truly cannot fit.
        const availableWidth = Math.max(0, window.innerWidth - 16);
        if (menu.offsetWidth > availableWidth) {
          menu.style.minWidth = '0';
          menu.style.width = availableWidth + 'px';
          menu.style.maxWidth = availableWidth + 'px';
          // Native buttons keep an intrinsic minimum even when their parent narrows.
          // Let plain rows use the width they were given so their text can wrap.
          menu.querySelectorAll('.struct-menu-item').forEach(item => {
            item.style.minWidth = '0';
            item.style.whiteSpace = 'normal';
          });
        }
        // Width squeezing can wrap rows and make the menu taller. Measure overflow
        // only after that reflow, or both the visual cue and its accessible wording lie.
        const scrollable = menu.scrollHeight > menu.clientHeight + 1;
        menu.dataset.scrollable = String(scrollable);
        if (scrollable) menu.setAttribute('aria-description', 'Scrollable menu. Use arrow keys, End, or the mouse wheel to reach every action.');
        const height = menu.offsetHeight;`);

  requireTrue(text !== original, 'patch made no change');
  const squeezeAt = text.indexOf("menu.style.maxWidth = availableWidth + 'px';");
  const scrollAt = text.indexOf('const scrollable = menu.scrollHeight > menu.clientHeight + 1;');
  requireTrue(squeezeAt >= 0 && scrollAt > squeezeAt, 'scrollability is still measured before width squeeze');
  requireTrue((text.match(/const scrollable = menu\.scrollHeight > menu\.clientHeight \+ 1;/g) || []).length === 1, 'scrollability census changed');
  requireTrue((text.match(/item\.style\.minWidth = '0'/g) || []).length === 1, 'squeezed item minimum-width release missing');
  requireTrue((text.match(/item\.style\.whiteSpace = 'normal'/g) || []).length === 1, 'squeezed item wrapping missing');
  requireTrue(text.includes("max-height: min(72vh, 560px);"), 'global menu height cap changed');
  requireTrue(text.includes('const rightmost = Math.max(8, window.innerWidth - menu.offsetWidth - 8);'), 'AR containment clamp changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r10au-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R10_AU applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
