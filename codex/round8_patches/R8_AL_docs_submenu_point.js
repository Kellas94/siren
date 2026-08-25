#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EXPECTED_INPUT_SHA256 = '03CD3978B819D993BA9DC0B2E749D134BD40DE35D1BB54D57A2D97C88267167F';
const EXPECTED_OUTPUT_SHA256 = '5F0CD90E49AD707D52071B571865A6A3944E07BB860F1F5D785156407E87246A';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}
function main() {
  requireTrue(process.argv.length === 3, 'usage: node R8_AL_docs_submenu_point.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target), beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8'); let text = original;

  text = replaceExact(text,
`        const built = buildContextMenu(target);
        if (!built || !contextMenuHasActions(built.rows)) return;
        event.preventDefault();
        openContextMenu(built.anchor || target, built.rows,
          event.button === 2 ? { x: event.clientX, y: event.clientY } : null, built.label, built.menuConfig);`,
`        const point = event.button === 2 ? { x: event.clientX, y: event.clientY } : null;
        const built = buildContextMenu(target, point);
        if (!built || !contextMenuHasActions(built.rows)) return;
        event.preventDefault();
        openContextMenu(built.anchor || target, built.rows, point, built.label, built.menuConfig);`);

  text = replaceExact(text,
`      function buildContextMenu(target) {
        const diagramTab = target.closest('#diagramTabs .diagram-tab');`,
`      function buildContextMenu(target, point = null) {
        const diagramTab = target.closest('#diagramTabs .diagram-tab');`);

  text = replaceExact(text,
`        if (el.wpWorkspace && !el.wpWorkspace.hidden) return buildDocsContextMenu(target);`,
`        if (el.wpWorkspace && !el.wpWorkspace.hidden) return buildDocsContextMenu(target, point);`);

  text = replaceExact(text,
`      function buildDocsContextMenu(target) {
        const row = target.closest('#wpList .wp-list-item[data-workpaper-id]');`,
`      function buildDocsContextMenu(target, point = null) {
        const row = target.closest('#wpList .wp-list-item[data-workpaper-id]');`);

  text = replaceExact(text,
`        if (target.closest('#wpDocInner')) return buildDocsPageContextMenu(target);`,
`        if (target.closest('#wpDocInner')) return buildDocsPageContextMenu(target, point);`);

  text = replaceExact(text,
`      function buildDocsPageContextMenu(target) {
        const doc = activeWorkpaper();
        if (!doc) return null;
        const rows = [[null, doc.title || doc.ref || 'Document', 'heading']];
        if (!readOnlyMode) rows.push([() => openWorkpaperAddMenu(target, null), '＋  Add a block at the end…']);
        rows.push([() => openWorkpaperFind(), '⌕  Find in this document (Ctrl + F)']);
        if (workpaperHeadingEntries(doc).length) rows.push([() => openWorkpaperContentsMenu(target), '☰  Contents…']);
        rows.push([null, 'Document', 'heading']);
        if (!readOnlyMode) rows.push([() => openWorkpaperTypeMenu(target), '◫  Document type · ' + workpaperTypeLabel(doc.type) + '…']);`,
`      function buildDocsPageContextMenu(target, point = null) {
        const doc = activeWorkpaper();
        if (!doc) return null;
        const rows = [[null, doc.title || doc.ref || 'Document', 'heading']];
        if (!readOnlyMode) rows.push([() => openWorkpaperAddMenu(target, null, null, { point }), '＋  Add a block at the end…']);
        rows.push([() => openWorkpaperFind(), '⌕  Find in this document (Ctrl + F)']);
        if (workpaperHeadingEntries(doc).length) rows.push([() => openWorkpaperContentsMenu(target, { point }), '☰  Contents…']);
        rows.push([null, 'Document', 'heading']);
        if (!readOnlyMode) rows.push([() => openWorkpaperTypeMenu(target, { point }), '◫  Document type · ' + workpaperTypeLabel(doc.type) + '…']);`);

  text = replaceExact(text,
`      function openWorkpaperContentsMenu(anchor) {
        const doc = activeWorkpaper();`,
`      function openWorkpaperContentsMenu(anchor, config = null) {
        const doc = activeWorkpaper();`);
  text = replaceExact(text,
`        openStructureMenu(anchor, options, '', jumpToWorkpaperBlock,
          { keyboard: true, role: 'menu', label: 'Document contents', restoreFocus: true, plain: true });`,
`        openStructureMenu(anchor, options, '', jumpToWorkpaperBlock,
          { keyboard: true, role: 'menu', label: 'Document contents', restoreFocus: true, plain: true,
            point: config && config.point ? config.point : null });`);

  text = replaceExact(text,
`      function openWorkpaperTypeMenu(anchor) {
        const doc = activeWorkpaper();`,
`      function openWorkpaperTypeMenu(anchor, config = null) {
        const doc = activeWorkpaper();`);
  text = replaceExact(text,
`          }, { keyboard: true, label: 'Document type', restoreFocus: true, plain: true });`,
`          }, { keyboard: true, label: 'Document type', restoreFocus: true, plain: true,
            point: config && config.point ? config.point : null });`);

  text = replaceExact(text,
`        }, { keyboard: true, role: 'menu', label: 'Add block', restoreFocus: true, plain: true });
        // Keep Space/Enter/arrow selection for the bare-slash feature.`,
`        }, { keyboard: true, role: 'menu', label: 'Add block', restoreFocus: true, plain: true,
          point: config && config.point ? config.point : null });
        // Keep Space/Enter/arrow selection for the bare-slash feature.`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/buildContextMenu\(target, point\)/g) || []).length === 1, 'point was not supplied to dispatcher exactly once');
  requireTrue((text.match(/point: config && config\.point \? config\.point : null/g) || []).length === 3, 'three Docs second-level menus are not point-aware');
  requireTrue((text.match(/\{ point \}/g) || []).length === 3, 'three page menu rows do not preserve the click point');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8'), afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r8al-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R8_AL applied: ${beforeHash} -> ${afterHash}\n`);
}
main();
