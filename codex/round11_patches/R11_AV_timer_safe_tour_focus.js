#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '2F2DA0BDA18427E3262EB97D06401723183D1938A09083654C64AFE791223030';
const EXPECTED_OUTPUT_SHA256 = 'B9DEBE9491301526540C9672DC9A99C7EAD7C14C51E1C52CAA050936CA8DE511';
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
`      function showTourStep(index) {`,
`      function showTourStep(index, focusNext = false) {`);

  text = replaceExact(text,
`        if (!target || !target.offsetParent) { showTourStep(index + 1); return; }`,
`        if (!target || !target.offsetParent) { showTourStep(index + 1, focusNext); return; }`);

  text = replaceExact(text,
`        next.addEventListener('click', () => showTourStep(index + 1));`,
`        next.addEventListener('click', () => showTourStep(index + 1, true));`);

  text = replaceExact(text,
`        next.focus();`,
`        // A delayed first-run card must not pull a cursor out of somebody's work.
        // Real tour actions pass true so keyboard focus follows the rebuilt card.
        if (focusNext) next.focus();`);

  text = replaceExact(text,
`      function startWelcomeTour() {`,
`      function startWelcomeTour(focusNext = false) {`);

  text = replaceExact(text,
`        showTourStep(0);`,
`        showTourStep(0, focusNext);`);

  text = replaceExact(text,
`          startWelcomeTour();`,
`          startWelcomeTour(true);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/function showTourStep\(index, focusNext = false\)/g) || []).length === 1, 'tour-step focus provenance missing');
  requireTrue((text.match(/showTourStep\(index \+ 1, focusNext\)/g) || []).length === 1, 'hidden-step focus provenance missing');
  requireTrue((text.match(/showTourStep\(index \+ 1, true\)/g) || []).length === 1, 'real Next action does not carry focus');
  requireTrue((text.match(/if \(focusNext\) next\.focus\(\);/g) || []).length === 1, 'timer-safe focus gate missing');
  requireTrue((text.match(/function startWelcomeTour\(focusNext = false\)/g) || []).length === 1, 'tour-entry focus provenance missing');
  requireTrue((text.match(/showTourStep\(0, focusNext\)/g) || []).length === 1, 'tour-entry focus propagation missing');
  requireTrue((text.match(/startWelcomeTour\(true\)/g) || []).length === 1, 'explicit Guide replay does not request focus');
  requireTrue((text.match(/setTimeout\(startWelcomeTour, introPlaying \? 1900 : 1100\)/g) || []).length === 1, 'first-run timer route changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r11av-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R11_AV applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
