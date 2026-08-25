#!/usr/bin/env node
'use strict';

// R7 AF: detect every starter family and preserve the two flowchart-based starter identities.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '6E4A866586437D670D2CF1EC620F3ED11BA0DEB5E147121DE6A1F5E3C2D44012';
const EXPECTED_OUTPUT_SHA256 = '87EB3DBEF3160B6871C846B994A934E4C4D03E620A198DEDE654207A851C1667';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(process.argv.length === 3, 'usage: node R7_AF_persist_starter_type.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  const oldDetector = `      function detectMermaidDiagramType(source) {
        const cleaned = String(source || '')
          .replace(/%%\\{[\\s\\S]*?\\}%%/g, '')
          .split(/\\r?\\n/)
          .map(line => line.trim())
          .find(line => line && !/^%%/.test(line)) || '';
        if (/^(flowchart|graph)\\b/i.test(cleaned)) return 'flowchart';
        if (/^stateDiagram(?:-v2)?\\b/i.test(cleaned)) return 'state';
        if (/^sequenceDiagram\\b/i.test(cleaned)) return 'sequence';
        if (/^classDiagram\\b/i.test(cleaned)) return 'class';
        if (/^erDiagram\\b/i.test(cleaned)) return 'er';
        if (/^journey\\b/i.test(cleaned)) return 'journey';
        if (/^gantt\\b/i.test(cleaned)) return 'gantt';
        // A git graph is a type of its own, not the catch-all: naming it here is what
        // lets the type chip, the starter list and the drawing's own menu say so.
        if (/^gitGraph\\b/i.test(cleaned)) return 'gitgraph';
        return cleaned ? 'advanced' : 'flowchart';
      }`;
  const newDetector = `      function detectMermaidDiagramType(source) {
        const sourceText = String(source || '');
        const normalized = sourceText.trim().replace(/\\r\\n/g, '\\n');
        // Swimlane and Ishikawa deliberately use ordinary flowchart syntax. Preserve
        // their identity for the starters the app itself created; arbitrary flowcharts
        // must still be detected from their declaration, not guessed from appearance.
        if (normalized === String(DIAGRAM_TYPE_STARTERS?.swimlane || '').trim().replace(/\\r\\n/g, '\\n')) return 'swimlane';
        if (normalized === String(DIAGRAM_TYPE_STARTERS?.ishikawa || '').trim().replace(/\\r\\n/g, '\\n')) return 'ishikawa';
        const cleaned = sourceText
          .replace(/%%\\{[\\s\\S]*?\\}%%/g, '')
          .split(/\\r?\\n/)
          .map(line => line.trim())
          .find(line => line && !/^%%/.test(line)) || '';
        if (/^(flowchart|graph)\\b/i.test(cleaned)) return 'flowchart';
        if (/^stateDiagram(?:-v2)?\\b/i.test(cleaned)) return 'state';
        if (/^sequenceDiagram\\b/i.test(cleaned)) return 'sequence';
        if (/^classDiagram\\b/i.test(cleaned)) return 'class';
        if (/^erDiagram\\b/i.test(cleaned)) return 'er';
        if (/^journey\\b/i.test(cleaned)) return 'journey';
        if (/^gantt\\b/i.test(cleaned)) return 'gantt';
        if (/^architecture-beta\\b/i.test(cleaned)) return 'architecture';
        if (/^C4Context\\b/i.test(cleaned)) return 'c4';
        if (/^block-beta\\b/i.test(cleaned)) return 'block';
        if (/^timeline\\b/i.test(cleaned)) return 'timeline';
        if (/^kanban\\b/i.test(cleaned)) return 'kanban';
        if (/^mindmap\\b/i.test(cleaned)) return 'mindmap';
        if (/^requirementDiagram\\b/i.test(cleaned)) return 'requirement';
        if (/^xychart-beta\\b/i.test(cleaned)) return 'xy';
        if (/^pie\\b/i.test(cleaned)) return 'pie';
        // A git graph is a type of its own, not the catch-all: naming it here is what
        // lets the type chip, the starter list and the drawing's own menu say so.
        if (/^gitGraph\\b/i.test(cleaned)) return 'gitgraph';
        return cleaned ? 'advanced' : 'flowchart';
      }`;
  text = replaceExact(text, oldDetector, newDetector);

  requireTrue(text !== original, 'patch made no change');
  for (const branch of ["return 'architecture'", "return 'c4'", "return 'block'", "return 'timeline'", "return 'kanban'", "return 'mindmap'", "return 'requirement'", "return 'xy'", "return 'pie'", "return 'ishikawa'"]) {
    requireTrue(text.includes(branch), `detector post-condition failed for ${branch}`);
  }
  requireTrue(text.split('function detectMermaidDiagramType(source)').length === 2, 'detector function count changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r7af-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R7_AF applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
