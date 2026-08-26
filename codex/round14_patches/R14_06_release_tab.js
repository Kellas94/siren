#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '7A87A3F1E956FE7E6BF5A46FE5365B0F38805A6A0400599106AEA1691679F1AA';
const EXPECTED_OUTPUT_SHA256 = '6F309203CFB51A19EECF11AF68531448C3A26082E9DDC7677F6237724A9FE064';
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
  requireTrue(EXPECTED_INPUT_SHA256 !== 'TO_BE_PINNED', 'input SHA-256 is not pinned');
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`        if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey
            || tourCard.contains(document.activeElement)) return;
        const actions = Array.from(tourCard.querySelectorAll('button:not([disabled])'));
        const destination = event.shiftKey ? actions[actions.length - 1] : actions[0];
        if (!destination) return;
        // Capture before the source editor or the legacy canvas route can consume Tab.
        event.preventDefault();
        event.stopPropagation();
        destination.focus();
`,
``);

  requireTrue(text !== original, 'patch made no change');
  requireTrue(!text.includes('tourCard.contains(document.activeElement)'), 'global tour Tab interception remains');
  requireTrue(!text.includes("const destination = event.shiftKey ? actions[actions.length - 1] : actions[0]"),
    'tour still diverts external Tab');
  requireTrue((text.match(/if \(event\.key === 'Escape'\)/g) || []).length >= 1,
    'tour Escape route was removed');
  requireTrue((text.match(/tourCard\.setAttribute\('tabindex', '-1'\)/g) || []).length === 1,
    'tour programmatic focus target changed');
  requireTrue((text.match(/tourCard\.setAttribute\('aria-live', 'polite'\)/g) || []).length === 1,
    'tour live-region contract changed');
  requireTrue((text.match(/if \(focusNext\) next\.focus\(\);/g) || []).length === 1,
    'explicit tour replay focus changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r14-06-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R14_06 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
