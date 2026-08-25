#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'CEE2AED63B1D71AC045326CB1C874BDB67F46DB9850E0BBA0A0BF5CA5E4E65B8';
const EXPECTED_OUTPUT_SHA256 = '7FA49EAEFD03155BB87F3505B069F5821B8286B96FD3C4E648671CFBAE072402';
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
`        const blockEl = target.closest('#wpBlocks .wp-block[data-block-id]');
        if (blockEl) return buildDocsBlockContextMenu(blockEl, target);
        const gap = target.closest('#wpBlocks .wp-inserter');
        if (gap) return buildDocsInserterContextMenu(gap);`,
`        const blockEl = target.closest('#wpBlocks .wp-block[data-block-id]');
        if (blockEl) return buildDocsBlockContextMenu(blockEl, target, point);
        const gap = target.closest('#wpBlocks .wp-inserter');
        if (gap) return buildDocsInserterContextMenu(gap, point);`);

  text = replaceExact(text,
`      function buildDocsInserterContextMenu(gap) {
        if (readOnlyMode || !activeWorkpaper()) return null;
        const at = Array.from(el.wpBlocks.querySelectorAll('.wp-inserter')).indexOf(gap);
        return {
          rows: [[() => openWorkpaperAddMenu(gap, at < 0 ? null : at), '＋  Insert a block here…']],`,
`      function buildDocsInserterContextMenu(gap, point = null) {
        if (readOnlyMode || !activeWorkpaper()) return null;
        const at = Array.from(el.wpBlocks.querySelectorAll('.wp-inserter')).indexOf(gap);
        return {
          rows: [[() => openWorkpaperAddMenu(gap, at < 0 ? null : at, null, { point }), '＋  Insert a block here…']],`);

  text = replaceExact(text,
`      function buildDocsBlockContextMenu(blockEl, target) {
        const doc = activeWorkpaper();`,
`      function buildDocsBlockContextMenu(blockEl, target, point = null) {
        const doc = activeWorkpaper();`);

  text = replaceExact(text,
`          rows.push([null, 'Insert', 'heading']);
          rows.push([() => openWorkpaperAddMenu(anchor, index), '＋  A block above…']);
          rows.push([() => openWorkpaperAddMenu(anchor, index + 1), '＋  A block below…']);`,
`          rows.push([null, 'Insert', 'heading']);
          rows.push([() => openWorkpaperAddMenu(anchor, index, null, { point }), '＋  A block above…']);
          rows.push([() => openWorkpaperAddMenu(anchor, index + 1, null, { point }), '＋  A block below…']);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/buildDocsBlockContextMenu\(blockEl, target, point\)/g) || []).length === 1, 'paragraph point dispatch missing');
  requireTrue((text.match(/buildDocsInserterContextMenu\(gap, point\)/g) || []).length === 1, 'gap point dispatch missing');
  requireTrue((text.match(/openWorkpaperAddMenu\(anchor, index(?: \+ 1)?, null, \{ point \}\)/g) || []).length === 2, 'block above/below point propagation missing');
  requireTrue((text.match(/openWorkpaperAddMenu\(gap, at < 0 \? null : at, null, \{ point \}\)/g) || []).length === 1, 'gap point propagation missing');
  requireTrue(text.includes("buildContextMenu(target);"), 'keyboard dispatcher no longer uses an element anchor');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r9ap-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R9_AP applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
