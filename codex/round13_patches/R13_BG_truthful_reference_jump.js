#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'AAE20B23D195C73C385040074BEB9B92C923E49C1AEE9FB83C56DC1C5CEBA52B';
const EXPECTED_OUTPUT_SHA256 = 'EB565797BD2E9C15087DBC69F4B8C8F8004138BF716334724FB5301FCF9D559A';
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
`      function resolveWorkpaperLink(raw) {
        const link = sanitizeWorkpaperLink(raw);`,
`      // Source tokens are only candidates. A block promise is made only when the
      // current drawing, or a signature-matched cached drawing, contains the node.
      function workpaperDiagramNodeResolvable(diagram, nodeId) {
        if (!diagram || !nodeId) return false;
        try {
          if (diagram.id === state.activeDiagramId
              && lastRenderedSignature === buildRenderSignature()
              && findSvgNodeGroups(el.diagram, nodeId).length) return true;
          const cached = diagramPreviewCache.get(diagram.id);
          if (!cached || cached.error || !cached.svg
              || cached.signature !== buildDiagramSignature(diagram)) return false;
          const parsed = new DOMParser().parseFromString(cached.svg, 'image/svg+xml');
          if (parsed.querySelector('parsererror')) return false;
          return findSvgNodeGroups(parsed, nodeId).length > 0;
        } catch (error) { return false; }
      }

      function resolveWorkpaperLink(raw) {
        const link = sanitizeWorkpaperLink(raw);`);

  text = replaceExact(text,
`          const dangling = !diagram || Boolean(link.nodeId && !node);
          const detail = node ? (node.label || node.id) : (link.label || link.nodeId);`,
`          const dangling = !diagram || Boolean(link.nodeId && !node);
          const nodeResolvable = Boolean(diagram && link.nodeId
            && workpaperDiagramNodeResolvable(diagram, link.nodeId));
          const detail = node ? (node.label || node.id) : (link.label || link.nodeId);`);

  text = replaceExact(text,
`          return { ...link, diagram, node, dangling, text };`,
`          return { ...link, diagram, node, nodeResolvable, dangling, text };`);

  text = replaceExact(text,
`        const jumpLabel = resolved.kind === 'diagram'
          ? (resolved.nodeId ? '→  Go to this block' : '→  Open this diagram')
          : resolved.kind === 'block' ? '→  Open this document block' : '→  Open this document';
        rows.push([() => openWorkpaperReference(resolved), jumpLabel,
          resolved.dangling ? 'The referenced target is no longer in this workspace.' : undefined]);`,
`        const unresolvedDiagramBlock = resolved.kind === 'diagram'
          && Boolean(resolved.nodeId) && !resolved.nodeResolvable;
        const jumpLabel = resolved.kind === 'diagram'
          ? (resolved.nodeResolvable ? '→  Go to this block' : '→  Open this diagram')
          : resolved.kind === 'block' ? '→  Open this document block' : '→  Open this document';
        rows.push([() => openWorkpaperReference(resolved), jumpLabel,
          resolved.dangling || unresolvedDiagramBlock
            ? 'The referenced target is no longer in this workspace.' : undefined]);`);

  text = replaceExact(text,
`              const anchor = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
              if (anchor) openNodeInspector(nodeId, anchor);`,
`              const anchor = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
              if (anchor) openNodeInspector(nodeId, anchor);
              else showToast('The diagram opened, but this reference does not resolve to a rendered block.', 'error');`);

  text = replaceExact(text,
`            else renderDiagram({ reason: 'Diagram reference opened', saveVersion: false })
              .then(rendered => { if (rendered) openTarget(); });`,
`            else renderDiagram({ reason: 'Diagram reference opened', saveVersion: false })
              .then(rendered => {
                if (rendered) openTarget();
                else showToast('The diagram opened, but its referenced block could not be rendered.', 'error');
              });`);

  text = replaceExact(text,
`            ? (resolved.node ? 'Open this block in its diagram' : 'Open this diagram')`,
`            ? (resolved.nodeResolvable ? 'Open this block in its diagram' : 'Open this diagram')`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/function workpaperDiagramNodeResolvable\(diagram, nodeId\)/g) || []).length === 1,
    'rendered-node resolver missing');
  requireTrue((text.match(/cached\.signature !== buildDiagramSignature\(diagram\)/g) || []).length === 1,
    'cached preview signature gate missing');
  requireTrue((text.match(/findSvgNodeGroups\(parsed, nodeId\)\.length > 0/g) || []).length === 1,
    'cached SVG does not use the shared node-group resolver');
  requireTrue((text.match(/nodeResolvable/g) || []).length === 5,
    'rendered-node truth signal census changed');
  requireTrue((text.match(/unresolvedDiagramBlock/g) || []).length === 2,
    'unresolvable block context gate missing');
  requireTrue((text.match(/Open this block in its diagram/g) || []).length === 1,
    'block tooltip census changed');
  requireTrue((text.match(/The diagram opened, but this reference does not resolve to a rendered block\./g) || []).length === 1,
    'failed same-diagram landing message missing');
  requireTrue((text.match(/The diagram opened, but its referenced block could not be rendered\./g) || []).length === 1,
    'failed cross-diagram render message missing');
  requireTrue((text.match(/function resolveWorkpaperLink\(raw\)/g) || []).length === 1,
    'workpaper reference resolver census changed');
  requireTrue((text.match(/function openWorkpaperReference\(resolved\)/g) || []).length === 1,
    'workpaper reference opener census changed');
  requireTrue((text.match(/function refreshWorkpaperNodeOptions\(\)/g) || []).length === 1,
    'reference picker was moved');
  requireTrue(text.includes('if (diagram) extractMermaidNodeCatalog(diagram.source).forEach(node => {'),
    'optional picker filtering was folded into this job');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r13bg-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R13_BG applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
