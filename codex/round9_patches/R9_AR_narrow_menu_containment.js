#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'DA900FE00BE221AAF4D71CF64949AF71BC3823E37BCF299A31F2407A5A5BC037';
const EXPECTED_OUTPUT_SHA256 = '86F6E9E110363F0156A1F7A04D6EA6A7C568E7040D3A34D8301352375CB4F8D8';
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
`        const height = menu.offsetHeight;
        const below = box.bottom + 4;
        menu.style.left = Math.min(window.innerWidth - menu.offsetWidth - 8, Math.max(8, box.left)) + 'px';
        menu.style.top = (below + height > window.innerHeight - 8 ? Math.max(8, box.top - height - 4) : below) + 'px';`,
`        // A plain menu has a 248px minimum. Below 264px that minimum is wider than
        // the viewport's two 8px insets, so the old right clamp became negative and
        // moved the left edge off-screen. Only constrain a menu that truly cannot fit.
        const availableWidth = Math.max(0, window.innerWidth - 16);
        if (menu.offsetWidth > availableWidth) {
          menu.style.minWidth = '0';
          menu.style.width = availableWidth + 'px';
          menu.style.maxWidth = availableWidth + 'px';
        }
        const height = menu.offsetHeight;
        const below = box.bottom + 4;
        const rightmost = Math.max(8, window.innerWidth - menu.offsetWidth - 8);
        menu.style.left = Math.min(rightmost, Math.max(8, box.left)) + 'px';
        menu.style.top = (below + height > window.innerHeight - 8 ? Math.max(8, box.top - height - 4) : below) + 'px';`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/const availableWidth = Math\.max\(0, window\.innerWidth - 16\)/g) || []).length === 1, 'narrow available width guard missing');
  requireTrue((text.match(/const rightmost = Math\.max\(8, window\.innerWidth - menu\.offsetWidth - 8\)/g) || []).length === 1, 'left-edge clamp missing');
  requireTrue(text.includes("max-height: min(72vh, 560px);"), 'global menu height cap changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r9ar-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R9_AR applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
