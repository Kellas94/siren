#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'EB565797BD2E9C15087DBC69F4B8C8F8004138BF716334724FB5301FCF9D559A';
const EXPECTED_OUTPUT_SHA256 = '5E1325FB393BB6808EC84AD86A942D7B7444754CD5DB442F9B65BC14BE36A01B';
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
`      function openWorkpaperReference(resolved) {
        if (!resolved || resolved.dangling) return;`,
`      // A reference arrival is complete only when the named block is on screen.
      // Keep the Build selection, canvas ring, Style target and inspector on the
      // same id, then verify the real post-scroll rectangle before opening a panel.
      function landWorkpaperDiagramNode(diagram, nodeId) {
        if (!diagram || state.activeDiagramId !== diagram.id) return;
        const anchor = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
        if (!anchor || !el.zoomViewport) {
          showToast('The diagram opened, but this reference does not resolve to a rendered block.', 'error');
          return;
        }
        selectVisualNode(nodeId);
        canvasFocusBlock(nodeId);
        const viewport = el.zoomViewport.getBoundingClientRect();
        const box = anchor.getBoundingClientRect();
        el.zoomViewport.scrollTo({
          left: el.zoomViewport.scrollLeft + box.left + box.width / 2 - (viewport.left + viewport.width / 2),
          top: el.zoomViewport.scrollTop + box.top + box.height / 2 - (viewport.top + viewport.height / 2),
          behavior: 'auto'
        });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const landed = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
          if (!landed || state.activeDiagramId !== diagram.id) return;
          const view = el.zoomViewport.getBoundingClientRect();
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
          openNodeInspector(nodeId, landed);
        }));
      }

      function openWorkpaperReference(resolved) {
        if (!resolved || resolved.dangling) return;`);

  text = replaceExact(text,
`            const openTarget = () => {
              if (state.activeDiagramId !== resolved.diagram.id) return;
              const anchor = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
              if (anchor) openNodeInspector(nodeId, anchor);
              else showToast('The diagram opened, but this reference does not resolve to a rendered block.', 'error');
            };`,
`            const openTarget = () => {
              if (state.activeDiagramId !== resolved.diagram.id) return;
              landWorkpaperDiagramNode(resolved.diagram, nodeId);
            };`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/function landWorkpaperDiagramNode\(diagram, nodeId\)/g) || []).length === 1,
    'reference landing helper missing');
  requireTrue((text.match(/selectVisualNode\(nodeId\);/g) || []).length === 1,
    'Build selection is not synchronized');
  requireTrue((text.match(/canvasFocusBlock\(nodeId\);/g) || []).length === 1,
    'canvas focus/ring route missing');
  requireTrue((text.match(/left: el\.zoomViewport\.scrollLeft \+ box\.left \+ box\.width \/ 2/g) || []).length === 1,
    'reference arrival does not centre the viewport');
  requireTrue((text.match(/const fullyVisible = rect\.left >= view\.left \+ padding/g) || []).length === 1,
    'post-scroll visibility check missing');
  requireTrue((text.match(/openNodeInspector\(nodeId, landed\);/g) || []).length === 1,
    'inspector opens before the verified landing');
  requireTrue((text.match(/referenced block could not be brought into view/g) || []).length === 1,
    'off-screen arrival explanation missing');
  requireTrue((text.match(/landWorkpaperDiagramNode\(resolved\.diagram, nodeId\);/g) || []).length === 1,
    'reference opener does not use the landing helper');
  requireTrue((text.match(/function openWorkpaperReference\(resolved\)/g) || []).length === 1,
    'reference opener census changed');
  requireTrue((text.match(/reason: 'Diagram reference opened'/g) || []).length === 1,
    'cross-diagram render route changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r13bh-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R13_BH applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
