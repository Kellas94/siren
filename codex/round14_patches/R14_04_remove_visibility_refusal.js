#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'DD662E4A2C68759DC669D92CE39C30D23191A4A8F28FBB97E33E32E6073C275C';
const EXPECTED_OUTPUT_SHA256 = '9BE2CDC19A183A777A9C7DEF70CCDEEC6BF57338D811B4BA18E24527C7A3314A';
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
`      // A reference arrival is complete only when the named block is on screen.
      // Keep the Build selection, canvas ring, Style target and inspector on the
      // same id, then verify the real post-scroll rectangle before opening a panel.`,
`      // Centre the named block before opening its inspector. A hidden mobile
      // preview has a 0x0 rect, so that rect cannot decide whether the target exists.`);

  text = replaceExact(text,
`          const view = el.zoomViewport.getBoundingClientRect();
          const rect = landed.getBoundingClientRect();
          const padding = 8;
          const fullyVisible = rect.left >= view.left + padding
            && rect.right <= view.right - padding
            && rect.top >= view.top + padding
            && rect.bottom <= view.bottom - padding;
          if (!fullyVisible) {
            showToast('The diagram opened, but its referenced block could not be brought into view.', 'error');
            return;
          }
          openNodeInspector(nodeId, landed);`,
`          openNodeInspector(nodeId, landed);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue(!text.includes('const fullyVisible ='), 'post-scroll visibility refusal remains');
  requireTrue(!text.includes('referenced block could not be brought into view'), 'visibility refusal toast remains');
  requireTrue((text.match(/left: el\.zoomViewport\.scrollLeft \+ box\.left \+ box\.width \/ 2/g) || []).length === 1,
    'reference centring was removed');
  requireTrue(text.split(`        requestAnimationFrame(() => requestAnimationFrame(() => {
          const landed = findSvgNodeGroups(el.diagram, nodeId)[0] || null;`).length - 1 === 1,
    'reference post-scroll settling frames changed');
  requireTrue((text.match(/openNodeInspector\(nodeId, landed\);/g) || []).length === 1,
    'settled reference does not open its inspector');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r14-04-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R14_04 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
