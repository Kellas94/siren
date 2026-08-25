#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '740304BA544D0FB0A081F5234F85914F53E7B2112FC228B2E5C1A07F1587057D';
const EXPECTED_OUTPUT_SHA256 = 'CEE2AED63B1D71AC045326CB1C874BDB67F46DB9850E0BBA0A0BF5CA5E4E65B8';
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
`      function handleSourceInput() {
        // Commit the title while the old source is still current. Otherwise the next
        // source snapshot groups both edits and one Undo erases the person's title.
        if (diagramTitleUndoPending) commitUndoSnapshot();
        const previousType = detectMermaidDiagramType(state.source || '');`,
`      function handleSourceInput() {
        // The input event fires after the textarea already contains the replacement.
        // state.source is still the previous buffer, so use it for the title-only
        // boundary instead of silently grouping the new source with the title.
        if (diagramTitleUndoPending) commitUndoSnapshot(state.source);
        const previousType = detectMermaidDiagramType(state.source || '');`);

  text = replaceExact(text,
`      function captureUndoEntry() {
        return { source: el.source.value, diagram: captureDiagramSnapshot() };
      }`,
`      function captureUndoEntry(source = el.source.value) {
        return { source, diagram: captureDiagramSnapshot() };
      }`);

  text = replaceExact(text,
`      function commitUndoSnapshot() {
        diagramTitleUndoPending = false;
        clearTimeout(undoTimer);
        if (restoringUndo) return;
        const entry = captureUndoEntry();`,
`      function commitUndoSnapshot(source = el.source.value) {
        diagramTitleUndoPending = false;
        clearTimeout(undoTimer);
        if (restoringUndo) return;
        const entry = captureUndoEntry(source);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/commitUndoSnapshot\(state\.source\)/g) || []).length === 1, 'old-source title boundary missing');
  requireTrue((text.match(/function captureUndoEntry\(source = el\.source\.value\)/g) || []).length === 1, 'undo capture override missing');
  requireTrue((text.match(/function commitUndoSnapshot\(source = el\.source\.value\)/g) || []).length === 1, 'undo commit override missing');
  requireTrue(text.includes('undoTimer = setTimeout(commitUndoSnapshot, 560);'), 'undo debounce changed');
  requireTrue(text.includes("restoreUndoEntry(undoStack[undoIndex], 'Undo');"), 'Undo action changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r9ao-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R9_AO applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
