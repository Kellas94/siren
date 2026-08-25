#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '4E4DE34091AB7C1C424250B3062B8E96A3E7CEC1BBE08120A1158365D5791E71';
const EXPECTED_OUTPUT_SHA256 = 'D7C047E62C159F1C687F7BBD05D2F702D36CDF058C3B62DEC5242611D255D17D';
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
`          if (workpaperTurnIntoKey(block)) rows.push([() => openWorkpaperTurnIntoMenu(anchor, doc, index), '⇄  Turn into…']);`,
`          if (workpaperTurnIntoKey(block)) rows.push([() => openWorkpaperTurnIntoMenu(anchor, doc, index, { point }), '⇄  Turn into…']);`);

  text = replaceExact(text,
`          if (doc.type === 'agent-spec') rows.push([() => openWorkpaperRoleMenu(anchor, doc, block), '⚑  Mark as purpose, boundaries, capabilities or test cases…']);`,
`          if (doc.type === 'agent-spec') rows.push([() => openWorkpaperRoleMenu(anchor, doc, block, { point }), '⚑  Mark as purpose, boundaries, capabilities or test cases…']);`);

  text = replaceExact(text,
`      function openWorkpaperTurnIntoMenu(anchor, doc, index) {
        const block = doc && doc.blocks[index];`,
`      function openWorkpaperTurnIntoMenu(anchor, doc, index, config = null) {
        const block = doc && doc.blocks[index];`);

  text = replaceExact(text,
`        ], workpaperTurnIntoKey(block), key => convertWorkpaperBlock(doc, index, key),
          { keyboard: true, label: 'Turn this block into', restoreFocus: true, plain: true });`,
`        ], workpaperTurnIntoKey(block), key => convertWorkpaperBlock(doc, index, key),
          { keyboard: true, label: 'Turn this block into', restoreFocus: true, plain: true,
            point: config && config.point ? config.point : null });`);

  text = replaceExact(text,
`      function openWorkpaperRoleMenu(anchor, doc, block) {
        openStructureMenu(anchor,`,
`      function openWorkpaperRoleMenu(anchor, doc, block, config = null) {
        openStructureMenu(anchor,`);

  text = replaceExact(text,
`            renderWorkpaperBlocks(doc);
          }, { keyboard: true, label: 'Agent block role', restoreFocus: true, plain: true });`,
`            renderWorkpaperBlocks(doc);
          }, { keyboard: true, label: 'Agent block role', restoreFocus: true, plain: true,
            point: config && config.point ? config.point : null });`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/openWorkpaperTurnIntoMenu\(anchor, doc, index, \{ point \}\)/g) || []).length === 1, 'Turn into point propagation missing');
  requireTrue((text.match(/openWorkpaperRoleMenu\(anchor, doc, block, \{ point \}\)/g) || []).length === 1, 'Role point propagation missing');
  requireTrue((text.match(/function openWorkpaperTurnIntoMenu\(anchor, doc, index, config = null\)/g) || []).length === 1, 'Turn into optional config missing');
  requireTrue((text.match(/function openWorkpaperRoleMenu\(anchor, doc, block, config = null\)/g) || []).length === 1, 'Role optional config missing');
  requireTrue((text.match(/point: config && config\.point \? config\.point : null/g) || []).length >= 5, 'shared optional point shape lost');
  requireTrue((text.match(/openWorkpaperTurnIntoMenu\(/g) || []).length === 2, 'Turn into caller/function census changed');
  requireTrue(text.includes('openWorkpaperRoleMenu(event.currentTarget, doc, block)'), 'toolbar Role caller changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r10at-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R10_AT applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
