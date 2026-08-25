#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697';
const EXPECTED_OUTPUT_SHA256 = '178F8BB844AD532FC6C0CAA9E6D61244FB5B82F78790B5722B925215B349E3F1';
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
`        const nodeEl = target.closest('#diagram [data-node-id], #diagram g.node');`,
`        const nodeEl = target.closest('#diagram [data-t-workpaper-node], #diagram [data-node-id], #diagram g.node');`);

  text = replaceExact(text,
`            markerGlyph.setAttribute('x', String(box.x + box.width - 13));
            markerGlyph.setAttribute('y', String(box.y + 15));`,
`            // Centre the glyph on the 18px hit target without moving any part of
            // that target outside the block frame.
            markerGlyph.setAttribute('x', String(box.x + box.width - 9));
            markerGlyph.setAttribute('y', String(box.y + 15));
            markerGlyph.setAttribute('text-anchor', 'middle');`);

  text = replaceExact(text,
`      function resolveNodeIdFromElement(target) {
        if (!(target instanceof Element)) return '';
        const group = target.closest('[data-node-id], g.node');`,
`      function resolveNodeIdFromElement(target) {
        if (!(target instanceof Element)) return '';
        // The workpaper marker is painted in the adornment layer, outside g.node,
        // but every non-plain gesture still belongs to the block underneath it.
        const workpaperMarker = target.closest('[data-t-workpaper-node]');
        if (workpaperMarker) return workpaperMarker.getAttribute('data-t-workpaper-node') || '';
        const group = target.closest('[data-node-id], g.node');`);

  text = replaceExact(text,
`      function handlePreviewNodeClick(event) {
        const workpaperMarker = event.target instanceof Element
          ? event.target.closest('[data-t-workpaper-node]') : null;
        if (workpaperMarker) {
          const nodeId = workpaperMarker.getAttribute('data-t-workpaper-node') || '';
          const linkedDocs = workpaperDocsByNode(state.activeDiagramId).get(nodeId) || [];
          event.preventDefault();
          event.stopImmediatePropagation();
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
          return;
        }
        // The click that ends a body drag on the canvas is the drag's release, not a click.
        if (performance.now() < canvasMoveSuppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }`,
`      let workpaperMarkerClickTimer = 0;

      function handlePreviewNodeClick(event) {
        // The click that ends a body drag on the canvas is the drag's release, not a
        // document request. This guard must run before the marker-specific route.
        if (performance.now() < canvasMoveSuppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
        const workpaperMarker = event.target instanceof Element
          ? event.target.closest('[data-t-workpaper-node]') : null;
        if (workpaperMarker && event.detail > 1) {
          clearTimeout(workpaperMarkerClickTimer);
          workpaperMarkerClickTimer = 0;
        }
        const plainMarkerClick = Boolean(workpaperMarker)
          && event.button === 0 && event.detail <= 1
          && !connectMode && !edgeWaypointMode
          && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
        if (plainMarkerClick) {
          const nodeId = workpaperMarker.getAttribute('data-t-workpaper-node') || '';
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
          }, 520);
          return;
        }`);

  text = replaceExact(text,
`      function handlePreviewNodeDoubleClick(event) {
        const id = resolveNodeIdFromElement(event.target);`,
`      function handlePreviewNodeDoubleClick(event) {
        clearTimeout(workpaperMarkerClickTimer);
        workpaperMarkerClickTimer = 0;
        const id = resolveNodeIdFromElement(event.target);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/#diagram \[data-t-workpaper-node\], #diagram \[data-node-id\], #diagram g\.node/g) || []).length === 1,
    'marker does not enter the block context-menu route');
  requireTrue((text.match(/markerGlyph\.setAttribute\('text-anchor', 'middle'\)/g) || []).length === 1,
    'marker glyph is not centred on its hit target');
  requireTrue((text.match(/const workpaperMarker = target\.closest\('\[data-t-workpaper-node\]'\);/g) || []).length === 1,
    'shared node resolver does not recognise the marker');
  requireTrue((text.match(/let workpaperMarkerClickTimer = 0;/g) || []).length === 1,
    'single/double marker arbitration state missing');
  requireTrue((text.match(/plainMarkerClick/g) || []).length === 2,
    'plain marker click gate changed');
  requireTrue((text.match(/!connectMode && !edgeWaypointMode/g) || []).length === 1,
    'active canvas modes are not excluded from the marker route');
  requireTrue((text.match(/!event\.ctrlKey && !event\.metaKey && !event\.shiftKey && !event\.altKey/g) || []).length === 1,
    'marker route does not require a genuinely unmodified click on every platform');
  requireTrue((text.match(/\}, 520\);/g) || []).length >= 1,
    'marker single-click arbitration delay missing');
  requireTrue((text.match(/clearTimeout\(workpaperMarkerClickTimer\);/g) || []).length === 3,
    'marker click timer cancellation census changed');
  requireTrue((text.match(/performance\.now\(\) < canvasMoveSuppressClickUntil/g) || []).length === 1,
    'post-drag click suppression changed');
  requireTrue((text.match(/function handlePreviewNodeDoubleClick\(event\)/g) || []).length === 1,
    'block double-click handler census changed');
  requireTrue((text.match(/function findSvgNodeGroups\(/g) || []).length === 1,
    'node-group resolver census changed');
  requireTrue(!text.includes("marker.setAttribute('data-node-id', id)"),
    'marker must not become a duplicate styled node group');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r13be-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R13_BE applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
