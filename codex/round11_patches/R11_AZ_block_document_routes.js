#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '3E00390550F8D4CA4B563C0582F637619AF4770A884C538C06B0F2B01C6AF793';
const EXPECTED_OUTPUT_SHA256 = 'A4ECD8BD60784D0E6CBAA1C539F3034596387581FC4685F53FA31C18CFAF0A08';
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
`        if (linked) {
          rows.push([() => followDrillLink(id), '↳  Open linked diagram']);
          rows.push([() => openNodeInspector(id, anchor), 'Edit block…']);
        }
        if (!readOnlyMode) {`,
`        if (linked) {
          rows.push([() => followDrillLink(id), '↳  Open linked diagram']);
          rows.push([() => openNodeInspector(id, anchor), 'Edit block…']);
        }
        const documents = nodeWorkpapersFor(id);
        if (documents.length) {
          rows.push([null, 'Documents', 'heading']);
          documents.forEach(({ doc, scope }) => {
            const scopeText = scope === 'whole diagram' ? ' · whole diagram' : ' · this block';
            rows.push([() => openNodeWorkpaper(doc), \`▤  \${doc.ref} · \${doc.title}\${scopeText}\`]);
          });
        }
        if (!readOnlyMode) {`);

  text = replaceExact(text,
`      function renderNodeDocPanel(nodeId) {
        if (!el.nodeDocList) return;
        el.nodeDocList.replaceChildren();
        const docs = [];
        (Array.isArray(state.workpapers) ? state.workpapers : []).forEach(doc => {
          const nodeLink = doc.links.find(link => link.diagramId === state.activeDiagramId && link.nodeId === nodeId);
          const diagramLink = doc.links.find(link => link.diagramId === state.activeDiagramId && !link.nodeId);
          if (nodeLink) docs.push({ doc, scope: 'this step' });
          else if (diagramLink) docs.push({ doc, scope: 'whole diagram' });
        });`,
`      // One scope calculation serves both the inspector and the block menu. A
      // node-specific link wins over a whole-diagram link from the same document.
      function nodeWorkpapersFor(nodeId, diagramId = state.activeDiagramId) {
        const docs = [];
        (Array.isArray(state.workpapers) ? state.workpapers : []).forEach(doc => {
          const nodeLink = doc.links.find(link => link.diagramId === diagramId && link.nodeId === nodeId);
          const diagramLink = doc.links.find(link => link.diagramId === diagramId && !link.nodeId);
          if (nodeLink) docs.push({ doc, scope: 'this step' });
          else if (diagramLink) docs.push({ doc, scope: 'whole diagram' });
        });
        return docs;
      }

      // The inspector row and the context-menu row must arrive in Docs identically.
      function openNodeWorkpaper(doc) {
        if (!doc) return;
        commitWorkpaperSession(activeWorkpaper());
        state.workpaperView.activeId = doc.id;
        closeNodeInspector(false);
        setWorkpapersOpen(true);
      }

      function renderNodeDocPanel(nodeId) {
        if (!el.nodeDocList) return;
        el.nodeDocList.replaceChildren();
        const docs = nodeWorkpapersFor(nodeId);`);

  text = replaceExact(text,
`          row.addEventListener('click', () => {
            commitWorkpaperSession(activeWorkpaper());
            state.workpaperView.activeId = doc.id;
            closeNodeInspector(false);
            setWorkpapersOpen(true);
          });`,
`          row.addEventListener('click', () => openNodeWorkpaper(doc));`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/function nodeWorkpapersFor\(nodeId, diagramId = state\.activeDiagramId\)/g) || []).length === 1,
    'shared node-document resolver missing');
  requireTrue((text.match(/nodeWorkpapersFor\(/g) || []).length === 3,
    'node-document resolver caller census changed');
  requireTrue((text.match(/function openNodeWorkpaper\(doc\)/g) || []).length === 1,
    'shared document opener missing');
  requireTrue((text.match(/openNodeWorkpaper\(/g) || []).length === 3,
    'shared document opener caller census changed');
  requireTrue((text.match(/scope === 'whole diagram' \? ' · whole diagram' : ' · this block'/g) || []).length === 1,
    'block-menu document scope labels missing');
  requireTrue((text.match(/rows\.push\(\[null, 'Documents', 'heading'\]\)/g) || []).length === 1,
    'block-menu Documents section missing');
  requireTrue((text.match(/function renderNodeDocPanel\(nodeId\)/g) || []).length === 1,
    'node document panel census changed');
  requireTrue(text.includes("if (nodeLink) docs.push({ doc, scope: 'this step' });"),
    'node-specific document precedence changed');
  requireTrue(text.includes("else if (diagramLink) docs.push({ doc, scope: 'whole diagram' });"),
    'whole-diagram document fallback changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r11az-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R11_AZ applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
