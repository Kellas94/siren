#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '40D04E31375EFE01034393928102EEDC92E3F5F1622F25ADD043E40A82836060';
const EXPECTED_OUTPUT_SHA256 = '038D8BA0AEBBBC176C09F19B0D827D169CE92B350253A7CBFC0BD02AACA05BEF';
const target = path.resolve(process.argv[2] || '');
const previewOnly = process.argv.includes('--preview');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 140)}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(target && fs.existsSync(target), 'pass the HTML file to patch');
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256,
    `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`      let visualSelectedNodeId = '';
      let lastMobileFitSignature = '';`,
`      let visualSelectedNodeId = '';
      // Unapplied labels belong to their diagram and block, never to whichever block
      // a later reference jump selects in the shared Build form.
      const visualNodeLabelDrafts = new Map();
      let visualNodeLabelOwner = null;
      let lastMobileFitSignature = '';`);

  text = replaceExact(text,
`        el.visualNodeSelect.addEventListener('change', () => selectVisualNode(el.visualNodeSelect.value));
        el.updateVisualNodeButton.addEventListener('click', updateVisualNode);`,
`        el.visualNodeSelect.addEventListener('change', () => selectVisualNode(el.visualNodeSelect.value));
        el.visualNodeEditLabel.addEventListener('input', captureVisualNodeLabelDraft);
        el.updateVisualNodeButton.addEventListener('click', updateVisualNode);`);

  text = replaceExact(text,
`      function refreshVisualBuilder(preferredNodeId = '') {`,
`      function visualNodeLabelDraftKey(diagramId, nodeId) {
        return diagramId && nodeId ? JSON.stringify([diagramId, nodeId]) : '';
      }

      function captureVisualNodeLabelDraft() {
        if (!el.visualNodeEditLabel || !visualNodeLabelOwner) return;
        const { diagramId, nodeId } = visualNodeLabelOwner;
        if (diagramId !== state.activeDiagramId) return;
        const model = parseVisualFlowchartSource(el.source?.value || state.source || '');
        const node = model.compatible ? model.nodes.find(item => item.id === nodeId) : null;
        const key = visualNodeLabelDraftKey(diagramId, nodeId);
        if (!node || !key) return;
        if (el.visualNodeEditLabel.value === (node.label || '')) visualNodeLabelDrafts.delete(key);
        else visualNodeLabelDrafts.set(key, el.visualNodeEditLabel.value);
      }

      function refreshVisualBuilder(preferredNodeId = '') {`);

  text = replaceExact(text,
`        if (!model.compatible) {
          visualSelectedNodeId = '';`,
`        if (!model.compatible) {
          visualSelectedNodeId = '';
          visualNodeLabelOwner = null;`);

  text = replaceExact(text,
`        const selected = model.nodes.find(node => node.id === visualSelectedNodeId);
        el.visualNodeEditLabel.value = selected?.label || '';
        el.visualNodeEditShape.value = selected?.shape || 'rect';`,
`        const selected = model.nodes.find(node => node.id === visualSelectedNodeId);
        const labelDraftKey = visualNodeLabelDraftKey(state.activeDiagramId, visualSelectedNodeId);
        el.visualNodeEditLabel.value = labelDraftKey && visualNodeLabelDrafts.has(labelDraftKey)
          ? visualNodeLabelDrafts.get(labelDraftKey)
          : (selected?.label || '');
        visualNodeLabelOwner = selected ? { diagramId: state.activeDiagramId, nodeId: selected.id } : null;
        el.visualNodeEditShape.value = selected?.shape || 'rect';`);

  text = replaceExact(text,
`      function selectVisualNode(id) {
        const model = parseVisualFlowchartSource(el.source.value);
        if (!model.compatible || !model.nodes.some(node => node.id === id)) return;
        visualSelectedNodeId = id;`,
`      function selectVisualNode(id) {
        const model = parseVisualFlowchartSource(el.source.value);
        if (!model.compatible || !model.nodes.some(node => node.id === id)) return;
        captureVisualNodeLabelDraft();
        visualSelectedNodeId = id;`);

  text = replaceExact(text,
`        node.label = label;
        node.shape = el.visualNodeEditShape.value;
        if (applyVisualModel(model, 'Visual block updated', node.id, { type: 'updateNode', id: node.id, label, shape: node.shape })) showToast('Block updated in both visual and code modes.', 'success');`,
`        node.label = label;
        node.shape = el.visualNodeEditShape.value;
        const draftKey = visualNodeLabelDraftKey(state.activeDiagramId, node.id);
        if (applyVisualModel(model, 'Visual block updated', node.id, { type: 'updateNode', id: node.id, label, shape: node.shape }, () => visualNodeLabelDrafts.delete(draftKey))) showToast('Block updated in both visual and code modes.', 'success');`);

  text = replaceExact(text,
`        const viewport = el.zoomViewport.getBoundingClientRect();
        const box = anchor.getBoundingClientRect();`,
`        selectVisualNode(nodeId);
        canvasFocusBlock(nodeId);
        const viewport = el.zoomViewport.getBoundingClientRect();
        const box = anchor.getBoundingClientRect();`);

  // A newly-created Docs reference schedules a marker render. If the jump reuses
  // the current SVG while that timer is pending, the later render replaces the
  // focused <g> and drops keyboard focus onto <body>. Keep the timer state honest
  // and consume a pending render before landing on the referenced block.
  text = replaceExact(text,
`      function scheduleRender(reason) {
        clearTimeout(renderTimer);
        if (!state.autoRender && reason !== 'auto-render-enabled') return;
        renderTimer = setTimeout(() => renderDiagram({ reason, saveVersion: false }), RENDER_DEBOUNCE_MS);
      }`,
`      function scheduleRender(reason) {
        clearTimeout(renderTimer);
        renderTimer = null;
        if (!state.autoRender && reason !== 'auto-render-enabled') return;
        renderTimer = setTimeout(() => {
          renderTimer = null;
          renderDiagram({ reason, saveVersion: false });
        }, RENDER_DEBOUNCE_MS);
      }`);

  text = replaceExact(text,
`      async function renderDiagram({ reason = 'manual', saveVersion = false } = {}) {
        clearTimeout(renderTimer);`,
`      async function renderDiagram({ reason = 'manual', saveVersion = false } = {}) {
        clearTimeout(renderTimer);
        renderTimer = null;`);

  text = replaceExact(text,
`            if (lastRenderedSignature === buildRenderSignature()) requestAnimationFrame(openTarget);`,
`            if (!renderTimer && lastRenderedSignature === buildRenderSignature()) requestAnimationFrame(openTarget);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/const visualNodeLabelDrafts = new Map\(\);/g) || []).length === 1,
    'keyed label draft store missing or duplicated');
  requireTrue((text.match(/el\.visualNodeEditLabel\.addEventListener\('input', captureVisualNodeLabelDraft\);/g) || []).length === 1,
    'label draft input capture missing or duplicated');
  requireTrue((text.match(/selectVisualNode\(nodeId\);\n        canvasFocusBlock\(nodeId\);/g) || []).length === 1,
    'arrival selection sync missing or duplicated');
  requireTrue((text.match(/if \(!renderTimer && lastRenderedSignature === buildRenderSignature\(\)\)/g) || []).length === 1,
    'pending-render arrival guard missing or duplicated');
  requireTrue((text.match(/renderTimer = null;/g) || []).length >= 2,
    'render timer lifecycle was not made explicit');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length,
    'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length,
    'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length,
    'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (previewOnly) {
    process.stdout.write(`R15_02 preview: ${beforeHash} -> ${afterHash}\n`);
    return;
  }
  requireTrue(EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED', 'pin the output SHA-256 before applying');
  requireTrue(afterHash === EXPECTED_OUTPUT_SHA256,
    `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r15-02-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try {
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  process.stdout.write(`R15_02 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
