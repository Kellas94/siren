#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '6560C3DCC0B0E7A4CFC2500295271D3496CBE31AE26BB0A85A14028B1A2E7CA4';
const EXPECTED_OUTPUT_SHA256 = '60585A8B7764AE989F96BE07447878F6CDBFF9796A36484BDC7AE52A6479E77A';
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
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256,
    `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`        document.addEventListener('keydown', handleCanvasCreationKeys);

        // --- v18 wiring ---`,
`        // --- v18 wiring ---`);

  const deadStart = '      /* ---------------- keyboard block creation ---------------- */';
  const retainedStart = '      /* ---------------- inspector: link + icon population ---------------- */';
  requireTrue(text.split(deadStart).length - 1 === 1, 'dead keyboard-creation section anchor is not unique');
  requireTrue(text.split(retainedStart).length - 1 === 1, 'following inspector section anchor is not unique');
  const start = text.indexOf(deadStart);
  const end = text.indexOf(retainedStart);
  requireTrue(start >= 0 && end > start, 'keyboard-creation section bounds are invalid');
  text = text.slice(0, start) + text.slice(end);

  requireTrue(text !== original, 'patch made no change');
  requireTrue(!text.includes('handleCanvasCreationKeys'), 'legacy mutation key handler remains');
  requireTrue(!text.includes('addBlockRelativeToSelection'), 'dead relative-add helper remains');
  requireTrue((text.match(/function handleCanvasBuilderKeydown\(event\)/g) || []).length === 1,
    'documented canvas keyboard handler changed');
  requireTrue((text.match(/document\.addEventListener\('keydown', handleCanvasBuilderKeydown, true\)/g) || []).length === 1,
    'documented canvas keyboard binding changed');
  requireTrue((text.match(/if \(event\.key === 'Enter' && mod && !event\.altKey\)/g) || []).length === 1,
    'documented Ctrl/Cmd+Enter creation route is missing');
  requireTrue(text.includes('Ctrl+Enter adds the next step'),
    'keyboard guide no longer documents the retained creation route');
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
  const temporary = path.join(path.dirname(target), `.r13bj-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R13_BJ applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
