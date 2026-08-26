#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '60585A8B7764AE989F96BE07447878F6CDBFF9796A36484BDC7AE52A6479E77A';
const EXPECTED_OUTPUT_SHA256 = 'TO_BE_PINNED';
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
`      let workpaperMarkerClickTimer = 0;

      function handlePreviewNodeClick(event) {`,
`      function handlePreviewNodeClick(event) {`);

  text = replaceExact(text,
`        if (workpaperMarker && event.detail > 1) {
          clearTimeout(workpaperMarkerClickTimer);
          workpaperMarkerClickTimer = 0;
        }
        const plainMarkerClick = Boolean(workpaperMarker)`,
`        const plainMarkerClick = Boolean(workpaperMarker)`);

  text = replaceExact(text,
`          const nodeId = workpaperMarker.getAttribute('data-t-workpaper-node') || '';
          const diagramId = state.activeDiagramId;
          event.preventDefault();
          event.stopImmediatePropagation();
          // A single marker click and a block double-click share their first click.
          // Wait through the native double-click interval; the second click cancels
          // this route, so rename can stay a real block gesture at the same pixel.
          clearTimeout(workpaperMarkerClickTimer);
          workpaperMarkerClickTimer = setTimeout(() => {
            workpaperMarkerClickTimer = 0;
            if (state.activeDiagramId !== diagramId) return;
            const linkedDocs = workpaperDocsByNode(diagramId).get(nodeId) || [];
            // One named destination can open directly. With several, choosing the first
            // would be arbitrary, so reveal the inspector's complete document list.
            if (linkedDocs.length === 1) {
              openNodeWorkpaper(linkedDocs[0]);
              return;
            }
            const anchor = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
            if (anchor) {
              openNodeInspector(nodeId, anchor);
              const documentation = el.nodeDocList && el.nodeDocList.closest('details');
              if (documentation) {
                documentation.open = true;
                requestAnimationFrame(() => documentation.scrollIntoView({ block: 'nearest' }));
              }
            }
          }, 520);`,
`          const nodeId = workpaperMarker.getAttribute('data-t-workpaper-node') || '';
          event.preventDefault();
          event.stopImmediatePropagation();
          const linkedDocs = workpaperDocsByNode(state.activeDiagramId).get(nodeId) || [];
          // One named destination can open directly. With several, choosing the first
          // would be arbitrary, so reveal the inspector's complete document list.
          if (linkedDocs.length === 1) {
            openNodeWorkpaper(linkedDocs[0]);
            return;
          }
          const anchor = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
          if (anchor) {
            openNodeInspector(nodeId, anchor);
            const documentation = el.nodeDocList && el.nodeDocList.closest('details');
            if (documentation) {
              documentation.open = true;
              requestAnimationFrame(() => documentation.scrollIntoView({ block: 'nearest' }));
            }
          }`);

  text = replaceExact(text,
`      function handlePreviewNodeDoubleClick(event) {
        clearTimeout(workpaperMarkerClickTimer);
        workpaperMarkerClickTimer = 0;
        const id = resolveNodeIdFromElement(event.target);`,
`      function handlePreviewNodeDoubleClick(event) {
        const id = resolveNodeIdFromElement(event.target);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue(!text.includes('workpaperMarkerClickTimer'), 'marker delay state remains');
  requireTrue(!text.includes('workpaperMarkerClickTimer = setTimeout'), 'marker document route is still delayed');
  requireTrue((text.match(/const plainMarkerClick = Boolean\(workpaperMarker\)/g) || []).length === 1,
    'plain marker gate census changed');
  requireTrue((text.match(/!connectMode && !edgeWaypointMode/g) || []).length === 1,
    'active canvas-mode exclusion changed');
  requireTrue((text.match(/!event\.ctrlKey && !event\.metaKey && !event\.shiftKey && !event\.altKey/g) || []).length === 1,
    'modified marker click exclusion changed');
  requireTrue((text.match(/const linkedDocs = workpaperDocsByNode\(state\.activeDiagramId\)\.get\(nodeId\) \|\| \[\];/g) || []).length === 1,
    'inline marker destination lookup missing');
  requireTrue((text.match(/function handlePreviewNodeDoubleClick\(event\)/g) || []).length === 1,
    'double-click route moved or duplicated');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r14-01-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R14_01 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
