#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '079C733BC0E38A031AA7210179C7D9BEE740A7C50A0B2CA488B0312BEBA46B72';
const EXPECTED_OUTPUT_SHA256 = '771C7C6CC02F2E849665063818824D450D75FB65F751CCDAF975EE145C6F66C3';
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
`        if (resolved.kind === 'diagram') {
          setWorkpapersOpen(false);
          if (resolved.diagram.id !== state.activeDiagramId) switchDiagram(resolved.diagram.id);
          return;
        }`,
`        if (resolved.kind === 'diagram') {
          const nodeId = resolved.node && resolved.node.id;
          setWorkpapersOpen(false);
          if (resolved.diagram.id !== state.activeDiagramId) switchDiagram(resolved.diagram.id);
          if (nodeId) {
            const openTarget = () => {
              if (state.activeDiagramId !== resolved.diagram.id) return;
              const anchor = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
              if (anchor) openNodeInspector(nodeId, anchor);
            };
            // Switching starts an asynchronous render. Reuse a current drawing when
            // there is one; otherwise open the inspector only after the target render.
            if (lastRenderedSignature === buildRenderSignature()) requestAnimationFrame(openTarget);
            else renderDiagram({ reason: 'Diagram reference opened', saveVersion: false })
              .then(rendered => { if (rendered) openTarget(); });
          }
          return;
        }`);

  text = replaceExact(text,
`          open.title = resolved.kind === 'diagram' ? 'Open this diagram' : resolved.kind === 'block' ? 'Open this document block' : 'Open this document';`,
`          open.title = resolved.kind === 'diagram'
            ? (resolved.node ? 'Open this block in its diagram' : 'Open this diagram')
            : resolved.kind === 'block' ? 'Open this document block' : 'Open this document';`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/const nodeId = resolved\.node && resolved\.node\.id;/g) || []).length === 1,
    'diagram reference node capture missing');
  requireTrue((text.match(/reason: 'Diagram reference opened'/g) || []).length === 1,
    'render-aware reference route missing');
  requireTrue((text.match(/state\.activeDiagramId !== resolved\.diagram\.id/g) || []).length === 1,
    'cross-diagram race guard missing');
  requireTrue((text.match(/findSvgNodeGroups\(el\.diagram, nodeId\)\[0\]/g) || []).length === 1,
    'rendered target lookup missing');
  requireTrue((text.match(/openNodeInspector\(nodeId, anchor\)/g) || []).length === 1,
    'referenced block inspector arrival missing');
  requireTrue((text.match(/Open this block in its diagram/g) || []).length === 1,
    'node-reference tooltip missing');
  requireTrue((text.match(/\? \(resolved\.node \? 'Open this block in its diagram' : 'Open this diagram'\)/g) || []).length === 1,
    'whole-diagram tooltip fallback missing');
  requireTrue((text.match(/function openWorkpaperReference\(resolved\)/g) || []).length === 1,
    'reference opener census changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r11ax-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R11_AX applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
