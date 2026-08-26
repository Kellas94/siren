#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '6F309203CFB51A19EECF11AF68531448C3A26082E9DDC7677F6237724A9FE064';
const EXPECTED_OUTPUT_SHA256 = '9E7DB5F87F39BA8C0FA597C81CE0A5FE6981EFDBA62523D7C5FE161F3299E41F';
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
`        if (!tourCard || document.querySelector('dialog[open]')) return;`,
`        if (!tourCard || event.defaultPrevented || document.querySelector('dialog[open]')) return;`);

  text = replaceExact(text,
`        document.removeEventListener('keydown', handleWelcomeTourKeydown, true);`,
`        document.removeEventListener('keydown', handleWelcomeTourKeydown, false);`);

  text = replaceExact(text,
`          document.addEventListener('keydown', handleWelcomeTourKeydown, true);`,
`          document.addEventListener('keydown', handleWelcomeTourKeydown, false);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/!tourCard \|\| event\.defaultPrevented \|\| document\.querySelector\('dialog\[open\]'\)/g) || []).length === 1,
    'tour does not yield a claimed Escape');
  requireTrue((text.match(/addEventListener\('keydown', handleWelcomeTourKeydown, false\)/g) || []).length === 1,
    'tour listener is not on bubble phase');
  requireTrue((text.match(/removeEventListener\('keydown', handleWelcomeTourKeydown, false\)/g) || []).length === 1,
    'tour listener teardown phase does not match installation');
  requireTrue(!text.includes("addEventListener('keydown', handleWelcomeTourKeydown, true)"),
    'capture-phase tour listener remains');
  requireTrue((text.match(/tourCard\.setAttribute\('aria-live', 'polite'\)/g) || []).length === 1,
    'tour live region changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r14-07-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R14_07 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
