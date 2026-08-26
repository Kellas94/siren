#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '038D8BA0AEBBBC176C09F19B0D827D169CE92B350253A7CBFC0BD02AACA05BEF';
const EXPECTED_OUTPUT_SHA256 = '794B20044992CF791295182A1F42248281CF0E9B07C7CD35B2A00255F0B6EAAB';
const target = path.resolve(process.argv[2] || '');
const previewOnly = process.argv.includes('--preview');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 160)}`);
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
`        const viewport = el.zoomViewport.getBoundingClientRect();
        const box = anchor.getBoundingClientRect();
        el.zoomViewport.scrollTo({
          left: el.zoomViewport.scrollLeft + box.left + box.width / 2 - (viewport.left + viewport.width / 2),
          top: el.zoomViewport.scrollTop + box.top + box.height / 2 - (viewport.top + viewport.height / 2),
          behavior: 'auto'
        });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const landed = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
          if (!landed || state.activeDiagramId !== diagram.id) return;
          openNodeInspector(nodeId, landed);
        }));`,
`        const viewport = el.zoomViewport.getBoundingClientRect();
        const box = anchor.getBoundingClientRect();
        const previewHidden = getComputedStyle(el.previewPane).display === 'none'
          || viewport.width === 0 || viewport.height === 0;
        const targetHidden = box.width === 0 || box.height === 0
          || anchor.getAttribute('data-t-filtered') === 'hide';
        el.zoomViewport.scrollTo({
          left: el.zoomViewport.scrollLeft + box.left + box.width / 2 - (viewport.left + viewport.width / 2),
          top: el.zoomViewport.scrollTop + box.top + box.height / 2 - (viewport.top + viewport.height / 2),
          behavior: 'auto'
        });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const landed = findSvgNodeGroups(el.diagram, nodeId)[0] || null;
          if (!landed || state.activeDiagramId !== diagram.id) return;
          openNodeInspector(nodeId, landed);
          if (previewHidden || targetHidden) {
            showToast('Block ' + nodeId + ' is open for editing, but the block is not currently visible in Preview.');
          }
        }));`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/const previewHidden = getComputedStyle\(el\.previewPane\)\.display === 'none'/g) || []).length === 1,
    'preview-hidden measurement missing or duplicated');
  requireTrue((text.match(/const targetHidden = box\.width === 0 \|\| box\.height === 0/g) || []).length === 1,
    'target-hidden measurement missing or duplicated');
  requireTrue((text.match(/is open for editing, but the block is not currently visible in Preview\./g) || []).length === 1,
    'neutral visibility explanation missing or duplicated');
  requireTrue((text.match(/openNodeInspector\(nodeId, landed\);/g) || []).length === 1,
    'arrival inspector route changed unexpectedly');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length,
    'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length,
    'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length,
    'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (previewOnly) {
    process.stdout.write(`R15_03 preview: ${beforeHash} -> ${afterHash}\n`);
    return;
  }
  requireTrue(EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED', 'pin the output SHA-256 before applying');
  requireTrue(afterHash === EXPECTED_OUTPUT_SHA256,
    `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r15-03-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try {
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  process.stdout.write(`R15_03 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
