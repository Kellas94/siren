#!/usr/bin/env node
'use strict';

// R7 AE: make Guided counts and guidance truthful for the active diagram family.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435';
const EXPECTED_OUTPUT_SHA256 = '6E4A866586437D670D2CF1EC620F3ED11BA0DEB5E147121DE6A1F5E3C2D44012';

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(process.argv.length === 3, 'usage: node R7_AE_truthful_guided_counts.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(
    text,
    "        updateDiagramTypeStarterUi();\n        codeOnlyMaybeShowHint();",
    "        updateDiagramTypeStarterUi();\n        updateStructureGuidance(el.source?.value || state.source || '');\n        codeOnlyMaybeShowHint();"
  );

  const marker = '      function renderStructureEditor() {';
  const helper = String.raw`      function structureNativeSummary(source, rows, namedBlockCount, linkCount) {
        const text = String(source == null ? '' : source);
        const lines = text.split(/\r?\n/);
        const declaration = lines.map(line => line.trim()).find(line => line && !/^%%/.test(line)) || '';
        const count = (value, singular, plural = singular + 's') => value + ' ' + (value === 1 ? singular : plural);
        if (/^(flowchart|graph)\b/i.test(declaration)) {
          return count(namedBlockCount, 'block') + ' · ' + count(linkCount, 'connection');
        }
        if (/^sequenceDiagram\b/i.test(declaration)) {
          const participants = new Set();
          lines.forEach(line => {
            const declared = /^\s*(?:participant|actor)\s+(?:"([^"]+)"|(\S+))/i.exec(line);
            if (declared) participants.add(declared[1] || declared[2]);
          });
          const messages = lines.filter(line => /-{1,2}(?:>>?|x|\)|\\|\/)\s*[^:]+:/.test(line)).length;
          return count(participants.size, 'participant') + ' · ' + count(messages, 'message');
        }
        if (/^gantt\b/i.test(declaration)) {
          const tasks = lines.filter(line => {
            const clean = line.trim();
            return clean.includes(':') && !/^(gantt|title|dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker|section)\b/i.test(clean);
          });
          const dependencies = tasks.filter(line => /\bafter\s+[\w-]+/i.test(line)).length;
          return count(tasks.length, 'task') + ' · ' + count(dependencies, 'dependency', 'dependencies');
        }
        if (/^mindmap\b/i.test(declaration)) {
          const declarationIndex = lines.findIndex(line => line.trim() === declaration);
          const nodes = lines.slice(declarationIndex + 1)
            .filter(line => line.trim() && !/^\s*%%/.test(line) && !/^\s*:::/i.test(line));
          return count(nodes.length, 'node') + ' · ' + count(Math.max(0, nodes.length - 1), 'link');
        }
        if (/^block(?:-beta)?\b/i.test(declaration)) {
          const blocks = new Set();
          lines.slice(1).forEach(line => {
            const clean = line.replace(/%%.*$/, '').trim();
            if (!clean || /^(columns|space)\b/i.test(clean)) return;
            for (const match of clean.matchAll(/\b([A-Za-z_][\w-]*)\s*(?=[\[({<])/g)) blocks.add(match[1]);
            const bare = clean.replace(/\b[A-Za-z_][\w-]*\s*(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|<[^>]*>)/g, ' ');
            for (const token of bare.match(/\b[A-Za-z_][\w-]*\b/g) || []) {
              if (!/^(block|end|columns|space)$/i.test(token)) blocks.add(token);
            }
          });
          return count(blocks.size, 'block');
        }
        if (/^kanban\b/i.test(declaration)) {
          const entries = lines.slice(1).filter(line => line.trim() && !/^\s*%%/.test(line))
            .map(line => ({ indent: (line.match(/^[ \t]*/) || [''])[0].replace(/\t/g, '    ').length, text: line.trim() }));
          const minimum = entries.length ? Math.min(...entries.map(entry => entry.indent)) : 0;
          const columns = entries.filter(entry => entry.indent === minimum).length;
          const cards = entries.filter(entry => entry.indent > minimum).length;
          return count(columns, 'column') + ' · ' + count(cards, 'card');
        }
        return '';
      }

      function updateStructureGuidance(source, summary = null) {
        const text = String(source == null ? '' : source);
        const declaration = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !/^%%/.test(line)) || '';
        const flowchart = /^(flowchart|graph)\b/i.test(declaration);
        const hint = document.querySelector('.struct-guide-hint > span:first-child');
        if (el.structureModeButton) el.structureModeButton.title = flowchart
          ? 'The same Mermaid code, with its parts clickable: rename a block, swap a shape, change a connector'
          : 'The Mermaid source line by line, with line-level reorder, move and delete actions';
        if (hint) hint.textContent = flowchart
          ? 'Click a chip to edit it in place. Drag a line number to reorder; right-click a line to add, move or delete it.'
          : 'Each source line stays intact. Drag a line number to reorder; right-click a line to move or delete it; edit type-specific content in Code.';
        if (el.structureCount && summary !== null) {
          el.structureCount.textContent = summary;
          el.structureCount.hidden = !summary;
        }
      }

`;
  text = replaceExact(text, marker, helper + marker);

  const oldCount = "        const linkCount = rows.filter(row => row.kind === 'link').length + chainSteps;\n        el.structureCount.textContent = namedBlocks.size + (namedBlocks.size === 1 ? ' block · ' : ' blocks · ')\n          + linkCount + (linkCount === 1 ? ' connection' : ' connections');";
  const newCount = "        const linkCount = rows.filter(row => row.kind === 'link').length + chainSteps;\n        const nativeSummary = structureNativeSummary(el.source.value, rows, namedBlocks.size, linkCount);\n        updateStructureGuidance(el.source.value, nativeSummary);";
  text = replaceExact(text, oldCount, newCount);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/function structureNativeSummary\(/g) || []).length === 1, 'native-summary helper post-condition failed');
  requireTrue((text.match(/function updateStructureGuidance\(/g) || []).length === 1, 'Guided guidance helper post-condition failed');
  requireTrue((text.match(/const nativeSummary = structureNativeSummary\(/g) || []).length === 1, 'native-summary call post-condition failed');
  requireTrue((text.match(/updateStructureGuidance\(el\.source\?\.value \|\| state\.source \|\| ''\)/g) || []).length === 1, 'type-refresh guidance call post-condition failed');
  requireTrue(!text.includes('el.structureCount.textContent = namedBlocks.size'), 'generic flowchart counter survived');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r7ae-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R7_AE applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
