#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '0C17FB6673FD1FC5DE24CC5C474B49EAE85505589E373E7ABA870BE345338F97';
const EXPECTED_OUTPUT_SHA256 = '40D04E31375EFE01034393928102EEDC92E3F5F1622F25ADD043E40A82836060';
const target = path.resolve(process.argv[2] || '');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 140)}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(target && fs.existsSync(target), 'pass the HTML file to patch');
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256,
    `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`          if (linkedDocs.length === 1) {
            openNodeWorkpaper(linkedDocs[0]);
            return;
          }`,
`          if (linkedDocs.length === 1) {
            // Docs covers the marker before the second half of a physical double-click.
            // Consume only that repeated click on the new surface; the first click still
            // opens synchronously and ordinary detail=1 Docs actions remain immediate.
            const consumeMarkerRepeat = repeatEvent => {
              if (Number(repeatEvent.detail) < 2) return;
              repeatEvent.preventDefault();
              repeatEvent.stopImmediatePropagation();
            };
            const markerRepeatEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick'];
            markerRepeatEvents.forEach(type => el.wpWorkspace.addEventListener(type, consumeMarkerRepeat, true));
            setTimeout(() => markerRepeatEvents.forEach(type =>
              el.wpWorkspace.removeEventListener(type, consumeMarkerRepeat, true)), 400);
            openNodeWorkpaper(linkedDocs[0]);
            return;
          }`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/const consumeMarkerRepeat = repeatEvent =>/g) || []).length === 1,
    'transient Docs repeat consumer missing or duplicated');
  requireTrue((text.match(/openNodeWorkpaper\(linkedDocs\[0\]\);/g) || []).length === 1,
    'single-document marker route changed unexpectedly');
  requireTrue((text.match(/markerRepeatEvents\.forEach\(type => el\.wpWorkspace\.addEventListener\(type, consumeMarkerRepeat, true\)\);/g) || []).length === 1,
    'capture listener registration missing');
  requireTrue((text.match(/removeEventListener\(type, consumeMarkerRepeat, true\)/g) || []).length === 1,
    'capture listener teardown missing');
  requireTrue((text.match(/\), 400\);/g) || []).length >= 1,
    '400ms listener teardown interval missing');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length,
    'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length,
    'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length,
    'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') {
    requireTrue(afterHash === EXPECTED_OUTPUT_SHA256,
      `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  }
  const temporary = path.join(path.dirname(target), `.r15-01-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try {
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  process.stdout.write(`R15_01 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
