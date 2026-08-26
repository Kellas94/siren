#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '34C65CEE786838BAB864B369CF664079E389889C98FD3478F2BD3F828379BF68';
const EXPECTED_OUTPUT_SHA256 = '1D263A698E07016A8BC2EA7A7142952213E02454C8758B4F078FA3EAB4B162DD';
const target = path.resolve(process.argv[2] || '');
const previewOnly = process.argv.includes('--preview');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 160)}`);
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
`        // The workpaper marker is painted in the adornment layer, outside g.node,
        // but every non-plain gesture still belongs to the block underneath it.`,
`        // The workpaper marker is a single-purpose document control outside g.node:
        // a plain click opens Docs. Modifier and right-click actions can still resolve its block;
        // drag and double-click rename belong to the block body, not this corner.`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/single-purpose document control outside g\.node/g) || []).length === 1,
    'truthful marker contract comment missing or duplicated');
  requireTrue(text.includes('F2 or a double-click renames in place'),
    'protected v1.59.1 release note changed unexpectedly');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length,
    'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length,
    'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length,
    'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (previewOnly) {
    process.stdout.write(`R15_06 preview: ${beforeHash} -> ${afterHash}\n`);
    return;
  }
  requireTrue(EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED', 'pin the output SHA-256 before applying');
  requireTrue(afterHash === EXPECTED_OUTPUT_SHA256,
    `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r15-06-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try {
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  process.stdout.write(`R15_06 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
