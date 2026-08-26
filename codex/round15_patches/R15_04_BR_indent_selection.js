#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '794B20044992CF791295182A1F42248281CF0E9B07C7CD35B2A00255F0B6EAAB';
const EXPECTED_OUTPUT_SHA256 = 'BB0132C88A39DE3F650C6CB335F25A8377D269DBFDCAAD4C8B33D4A9020FBE32';
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
`        if (event.shiftKey) {
          outdentEditorSelection(start, end);
        } else {
          el.source.setRangeText('    ', start, end, 'end');
        }
        el.source.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function outdentEditorSelection(start, end) {`,
`        if (event.shiftKey) {
          outdentEditorSelection(start, end);
        } else if (start !== end) {
          indentEditorSelection(start, end);
        } else {
          el.source.setRangeText('    ', start, end, 'end');
        }
        el.source.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function indentEditorSelection(start, end) {
        const value = el.source.value;
        const lineStart = value.lastIndexOf('\\n', start - 1) + 1;
        const effectiveEnd = end > start && value[end - 1] === '\\n' ? end - 1 : end;
        const newlineAfter = value.indexOf('\\n', effectiveEnd);
        const lineEnd = newlineAfter === -1 ? value.length : newlineAfter;
        const segment = value.slice(lineStart, lineEnd);
        el.source.setRangeText(segment.replace(/^/gm, '    '), lineStart, lineEnd, 'preserve');
      }

      function outdentEditorSelection(start, end) {`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/function indentEditorSelection\(start, end\)/g) || []).length === 1,
    'indent selection helper missing or duplicated');
  requireTrue((text.match(/else if \(start !== end\) \{\n          indentEditorSelection\(start, end\);/g) || []).length === 1,
    'selected-text Tab route missing or duplicated');
  requireTrue((text.match(/function outdentEditorSelection\(start, end\)/g) || []).length === 1,
    'existing outdent helper changed unexpectedly');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length,
    'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length,
    'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length,
    'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (previewOnly) {
    process.stdout.write(`R15_04 preview: ${beforeHash} -> ${afterHash}\n`);
    return;
  }
  requireTrue(EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED', 'pin the output SHA-256 before applying');
  requireTrue(afterHash === EXPECTED_OUTPUT_SHA256,
    `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r15-04-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try {
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  process.stdout.write(`R15_04 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
