#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '178F8BB844AD532FC6C0CAA9E6D61244FB5B82F78790B5722B925215B349E3F1';
const EXPECTED_OUTPUT_SHA256 = '7E1A4A4FF0B30B853227C00F6FF770A1BB315574D08D539368E9F913C7C6AD9B';
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
`      function deckShapeTextBody(shape, wrap) {
        // 1pt floor, not 6: on a forty-block diagram the drawing scales to under 2pt, and`,
`      function deckShapeTextBody(shape, wrap) {
        // A single collector line is still one flat run, not a deliberate line
        // break. Let PowerPoint wrap it; keep nowrap only when the collector has
        // already split the label into two or more paragraphs.
        const resolvedWrap = Boolean(wrap)
          || !Array.isArray(shape.lines)
          || shape.lines.length <= 1;
        // 1pt floor, not 6: on a forty-block diagram the drawing scales to under 2pt, and`);

  text = replaceExact(text,
`        return \`<p:txBody><a:bodyPr vertOverflow="overflow" horzOverflow="overflow" wrap="\${wrap ? 'square' : 'none'}" lIns="18288" tIns="9144" rIns="18288" bIns="9144" anchor="\${shape.anchor === 't' ? 't' : 'ctr'}"/><a:lstStyle/>\${paragraphs}</p:txBody>\`;`,
`        return \`<p:txBody><a:bodyPr vertOverflow="overflow" horzOverflow="overflow" wrap="\${resolvedWrap ? 'square' : 'none'}" lIns="18288" tIns="9144" rIns="18288" bIns="9144" anchor="\${shape.anchor === 't' ? 't' : 'ctr'}"/><a:lstStyle/>\${paragraphs}</p:txBody>\`;`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/const resolvedWrap = Boolean\(wrap\)/g) || []).length === 1,
    'PowerPoint effective wrap guard missing');
  requireTrue((text.match(/shape\.lines\.length <= 1/g) || []).length === 1,
    'flat collector-line guard missing');
  requireTrue((text.match(/wrap="\$\{resolvedWrap \? 'square' : 'none'\}"/g) || []).length === 1,
    'PowerPoint text body does not use effective wrap');
  requireTrue((text.match(/wrap="\$\{wrap \? 'square' : 'none'\}"/g) || []).length === 0,
    'stale direct wrap expression remains');
  requireTrue((text.match(/function deckShapeTextBody\(shape, wrap\)/g) || []).length === 1,
    'shared PowerPoint text writer census changed');
  requireTrue((text.match(/return deckShapeTextBody\(shape, wrap\);/g) || []).length === 1,
    'direct diagram writer no longer uses shared text body');
  requireTrue((text.match(/deckShapeTextBody\(scaled,/g) || []).length === 2,
    'presentation deck caller census changed');
  requireTrue((text.match(/function ooxmlTextBody\(/g) || []).length === 1,
    'Excel text writer census changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r13bf-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R13_BF applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
