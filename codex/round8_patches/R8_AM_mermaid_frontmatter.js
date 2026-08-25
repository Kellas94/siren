#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EXPECTED_INPUT_SHA256 = '5F0CD90E49AD707D52071B571865A6A3944E07BB860F1F5D785156407E87246A';
const EXPECTED_OUTPUT_SHA256 = 'B3714C1748274D6C13C1149162D62193FE488ADCE6492AC183BCD82354A99DBB';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}
function main() {
  requireTrue(process.argv.length === 3, 'usage: node R8_AM_mermaid_frontmatter.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target), beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8'); let text = original;

  text = replaceExact(text,
`      function detectMermaidDiagramType(source) {
        const sourceText = String(source || '');`,
String.raw`      // Mermaid accepts a YAML document only when it is a complete frontmatter block
      // at the beginning. Blank those lines rather than deleting them so Guided line
      // numbers and every source-addressed edit continue to refer to the original file.
      function mermaidSourceLinesForScan(source) {
        const lines = String(source == null ? '' : source).split(/\r?\n/);
        if (!lines.length || lines[0].replace(/^\uFEFF/, '').trim() !== '---') return lines;
        const end = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)$/.test(line.trim()));
        if (end < 0) return lines;
        for (let index = 0; index <= end; index += 1) lines[index] = '';
        return lines;
      }

      function mermaidSourceDeclaration(source) {
        return mermaidSourceLinesForScan(source).join('\n')
          .replace(/%%\{[\s\S]*?\}%%/g, '')
          .split(/\r?\n/)
          .map(line => line.trim())
          .find(line => line && !/^%%/.test(line)) || '';
      }

      function detectMermaidDiagramType(source) {
        const sourceText = String(source || '');`);

  text = replaceExact(text,
String.raw`        const cleaned = sourceText
          .replace(/%%\{[\s\S]*?\}%%/g, '')
          .split(/\r?\n/)
          .map(line => line.trim())
          .find(line => line && !/^%%/.test(line)) || '';`,
`        const cleaned = mermaidSourceDeclaration(sourceText);`);

  text = replaceExact(text,
String.raw`        const firstLine = String(source == null ? '' : source).split(/\r?\n/)
          .map(line => line.trim()).find(line => line && !/^%%/.test(line)) || '';
        const flowchartish = /^(flowchart|graph)\s+/i.test(firstLine);`,
String.raw`        const firstLine = mermaidSourceDeclaration(source);
        const flowchartish = /^(flowchart|graph)\s+/i.test(firstLine);`);

  text = replaceExact(text,
String.raw`      function structureIsFlowchart() {
        const first = String(el.source.value || '').split(/\r?\n/)
          .map(line => line.trim()).find(line => line && !/^%%/.test(line)) || '';
        return /^(flowchart|graph)\s+/i.test(first);
      }`,
String.raw`      function structureIsFlowchart() {
        return /^(flowchart|graph)\s+/i.test(mermaidSourceDeclaration(el.source.value));
      }`);

  text = replaceExact(text,
String.raw`      function structureNativeSummary(source, rows, namedBlockCount, linkCount) {
        const text = String(source == null ? '' : source);
        const lines = text.split(/\r?\n/);
        const declaration = lines.map(line => line.trim()).find(line => line && !/^%%/.test(line)) || '';`,
`      function structureNativeSummary(source, rows, namedBlockCount, linkCount) {
        const lines = mermaidSourceLinesForScan(source);
        const declaration = mermaidSourceDeclaration(source);`);

  text = replaceExact(text,
String.raw`      function updateStructureGuidance(source, summary = null) {
        const text = String(source == null ? '' : source);
        const declaration = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !/^%%/.test(line)) || '';
        const flowchart = /^(flowchart|graph)\b/i.test(declaration);`,
String.raw`      function updateStructureGuidance(source, summary = null) {
        const declaration = mermaidSourceDeclaration(source);
        const flowchart = /^(flowchart|graph)\b/i.test(declaration);`);

  text = replaceExact(text,
String.raw`        const declaration = String(sourceText || '')
          .replace(/%%\{[\s\S]*?\}%%/g, '')
          .split(/\r?\n/)
          .map(line => line.trim())
          .find(line => line && !/^%%/.test(line)) || '';`,
`        const declaration = mermaidSourceDeclaration(sourceText);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/function mermaidSourceLinesForScan/g) || []).length === 1, 'frontmatter line scanner missing');
  requireTrue((text.match(/function mermaidSourceDeclaration/g) || []).length === 1, 'shared declaration scanner missing');
  requireTrue((text.match(/mermaidSourceDeclaration\(/g) || []).length === 7, 'not all six consumers use the shared declaration scanner');
  requireTrue((text.match(/mermaidSourceLinesForScan\(/g) || []).length === 3, 'line-preserving scan is not shared with native summary');
  requireTrue(text.includes("if (end < 0) return lines;"), 'truncated frontmatter fail-closed guard missing');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8'), afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r8am-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R8_AM applied: ${beforeHash} -> ${afterHash}\n`);
}
main();
