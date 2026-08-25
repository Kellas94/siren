#!/usr/bin/env node
'use strict';

// R7 AG: synchronize untouched default titles with the detected diagram family.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '87EB3DBEF3160B6871C846B994A934E4C4D03E620A198DEDE654207A851C1667';
const EXPECTED_OUTPUT_SHA256 = '4CC21B297D7F5698B16BC6ED447F492BF0C695E6FF6EFF5E9AC1F303DC9F96B1';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(process.argv.length === 3, 'usage: node R7_AG_type_aware_default_titles.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  const titleMarker = "      function updateTitlePreview() {";
  const titleHelper = `      function defaultDiagramTitleForType(type) {
        return diagramTypeLabel(type || 'flowchart') + ' Preview';
      }

      function synchronizeDefaultDiagramTitle(previousType, source) {
        if (!el.diagramTitle) return;
        const current = String(el.diagramTitle.value || '').trim();
        const previousDefault = defaultDiagramTitleForType(previousType);
        // Existing saved work used this one sentinel for every family. Generated
        // defaults may keep following type changes; anything else belongs to the person.
        if (current !== 'Flowchart Preview' && current !== previousDefault) return;
        const nextTitle = defaultDiagramTitleForType(detectMermaidDiagramType(source));
        if (current === nextTitle) return;
        el.diagramTitle.value = nextTitle;
        state.diagramTitle = nextTitle;
        syncActiveDiagramFromAliases();
        updateTitlePreview();
      }

`;
  text = replaceExact(text, titleMarker, titleHelper + titleMarker);

  text = replaceExact(
    text,
    "      function handleSourceInput() {\n        // Follow the source however it changed - diagram switch, undo, visual builder -",
    "      function handleSourceInput() {\n        const previousType = detectMermaidDiagramType(state.source || '');\n        // Follow the source however it changed - diagram switch, undo, visual builder -"
  );
  text = replaceExact(
    text,
    "        updateDirectionControlFromSource();\n        updateDiagramTypeChip();\n        refreshNodeStyleTargets();\n        refreshVisualBuilder();\n        applyTheme(state.theme, false);",
    "        updateDirectionControlFromSource();\n        updateDiagramTypeChip();\n        synchronizeDefaultDiagramTitle('flowchart', el.source.value);\n        refreshNodeStyleTargets();\n        refreshVisualBuilder();\n        applyTheme(state.theme, false);"
  );
  text = replaceExact(
    text,
    "        state.source = el.source.value;\n        syncActiveDiagramFromAliases();\n        clearEditorError();\n        updateLineNumbers();\n        updateCodeStats();\n        updateDirectionControlFromSource();\n        updateDiagramTypeChip();\n        refreshNodeStyleTargets();",
    "        state.source = el.source.value;\n        syncActiveDiagramFromAliases();\n        clearEditorError();\n        updateLineNumbers();\n        updateCodeStats();\n        updateDirectionControlFromSource();\n        updateDiagramTypeChip();\n        synchronizeDefaultDiagramTitle(previousType, el.source.value);\n        refreshNodeStyleTargets();"
  );
  text = replaceExact(
    text,
    "        el.source.value = source;\n        state.source = source;\n        syncActiveDiagramFromAliases();\n        clearEditorError();\n        updateLineNumbers();\n        updateCodeStats();\n        updateDirectionControlFromSource();\n        updateDiagramTypeChip();\n        refreshNodeStyleTargets();",
    "        el.source.value = source;\n        state.source = source;\n        syncActiveDiagramFromAliases();\n        clearEditorError();\n        updateLineNumbers();\n        updateCodeStats();\n        updateDirectionControlFromSource();\n        updateDiagramTypeChip();\n        synchronizeDefaultDiagramTitle(previousType, el.source.value);\n        refreshNodeStyleTargets();"
  );
  text = replaceExact(
    text,
    "      function applySource(source, { reason = 'Source replaced', recordUndo = true, saveVersion = false } = {}) {\n        el.source.value = source;",
    "      function applySource(source, { reason = 'Source replaced', recordUndo = true, saveVersion = false } = {}) {\n        const previousType = detectMermaidDiagramType(el.source?.value || state.source || '');\n        el.source.value = source;"
  );

  requireTrue(text !== original, 'patch made no change');
  requireTrue(text.split('function defaultDiagramTitleForType(type)').length === 2, 'default-title helper count failed');
  requireTrue(text.split('function synchronizeDefaultDiagramTitle(previousType, source)').length === 2, 'title synchronization helper count failed');
  requireTrue((text.match(/synchronizeDefaultDiagramTitle\(previousType, el\.source\.value\)/g) || []).length === 2,
    'both source ingress paths must synchronize the untouched default');
  requireTrue((text.match(/synchronizeDefaultDiagramTitle\('flowchart', el\.source\.value\)/g) || []).length === 1,
    'boot migration path must synchronize the legacy default');
  requireTrue((text.match(/const previousType = detectMermaidDiagramType/g) || []).length >= 2,
    'previous-type capture post-condition failed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r7ag-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R7_AG applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
