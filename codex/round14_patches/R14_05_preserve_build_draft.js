#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '9BE2CDC19A183A777A9C7DEF70CCDEEC6BF57338D811B4BA18E24527C7A3314A';
const EXPECTED_OUTPUT_SHA256 = '7A87A3F1E956FE7E6BF5A46FE5365B0F38805A6A0400599106AEA1691679F1AA';
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
`      // Centre the named block before opening its inspector. A hidden mobile
      // preview has a 0x0 rect, so that rect cannot decide whether the target exists.`,
`      // Preserve any unsaved Build fields while centring the rendered target;
      // the inspector synchronizes its own controls after the arrival settles.`);

  text = replaceExact(text,
`        selectVisualNode(nodeId);
        canvasFocusBlock(nodeId);
        const viewport = el.zoomViewport.getBoundingClientRect();`,
`        const viewport = el.zoomViewport.getBoundingClientRect();`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/selectVisualNode\(nodeId\);/g) || []).length === 0,
    'reference arrival still overwrites the Build selection');
  requireTrue((text.match(/canvasFocusBlock\(nodeId\);/g) || []).length === 0,
    'reference arrival still arms the canvas selection');
  requireTrue((text.match(/left: el\.zoomViewport\.scrollLeft \+ box\.left \+ box\.width \/ 2/g) || []).length === 1,
    'reference centring changed');
  requireTrue((text.match(/openNodeInspector\(nodeId, landed\);/g) || []).length === 1,
    'reference inspector route changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r14-05-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R14_05 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
