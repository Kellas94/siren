#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'BB0132C88A39DE3F650C6CB335F25A8377D269DBFDCAAD4C8B33D4A9020FBE32';
const EXPECTED_OUTPUT_SHA256 = '34C65CEE786838BAB864B369CF664079E389889C98FD3478F2BD3F828379BF68';
const target = path.resolve(process.argv[2] || '');
const previewOnly = process.argv.includes('--preview');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText}`);
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
    '          document.body.appendChild(tourCard);',
    '          document.body.insertBefore(tourCard, document.body.firstChild);');

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/document\.body\.insertBefore\(tourCard, document\.body\.firstChild\);/g) || []).length === 1,
    'tour first-child insertion missing or duplicated');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length,
    'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length,
    'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length,
    'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (previewOnly) {
    process.stdout.write(`R15_05 preview: ${beforeHash} -> ${afterHash}\n`);
    return;
  }
  requireTrue(EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED', 'pin the output SHA-256 before applying');
  requireTrue(afterHash === EXPECTED_OUTPUT_SHA256,
    `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r15-05-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try {
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  process.stdout.write(`R15_05 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
