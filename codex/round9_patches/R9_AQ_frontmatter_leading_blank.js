#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '7FA49EAEFD03155BB87F3505B069F5821B8286B96FD3C4E648671CFBAE072402';
const EXPECTED_OUTPUT_SHA256 = 'DA900FE00BE221AAF4D71CF64949AF71BC3823E37BCF299A31F2407A5A5BC037';
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
String.raw`      function mermaidFrontmatterEnd(source) {
        const lines = String(source == null ? '' : source).split(/\r?\n/);
        if (!lines.length || lines[0].replace(/^\uFEFF/, '').trim() !== '---') return -1;
        return lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)$/.test(line.trim()));
      }`,
String.raw`      function mermaidFrontmatterEnd(source) {
        const lines = String(source == null ? '' : source).split(/\r?\n/);
        const start = lines.findIndex((line, index) =>
          (index === 0 ? line.replace(/^\uFEFF/, '') : line).trim() !== '');
        if (start < 0 || (start === 0 ? lines[start].replace(/^\uFEFF/, '') : lines[start]).trim() !== '---') return -1;
        return lines.findIndex((line, index) => index > start && /^(?:---|\.\.\.)$/.test(line.trim()));
      }`);

  text = replaceExact(text,
`        return cleaned ? 'advanced' : 'flowchart';
      }

      function diagramTypeLabel(type) {`,
`        // An empty editor is the Flowchart starter surface. A complete metadata
        // document with no Mermaid body is different: it has no drawable family,
        // so do not enable a Flowchart starter or title it as one.
        return cleaned ? 'advanced' : (mermaidFrontmatterEnd(sourceText) >= 0 ? 'advanced' : 'flowchart');
      }

      function diagramTypeLabel(type) {`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/const start = lines\.findIndex/g) || []).length === 1, 'leading-blank frontmatter start missing');
  requireTrue((text.match(/index > start/g) || []).length === 1, 'frontmatter end is not relative to its real start');
  requireTrue(text.includes("mermaidFrontmatterEnd(sourceText) >= 0 ? 'advanced' : 'flowchart'"), 'metadata-only classification guard missing');
  requireTrue((text.match(/function mermaidSourceDeclaration/g) || []).length === 1, 'shared declaration scanner changed');
  requireTrue((text.match(/mermaidSourceDeclaration\(/g) || []).length === 7, 'six declaration consumers no longer share the scanner');
  requireTrue(text.includes("const inFrontmatter = frontmatterEnd >= 0 && index <= frontmatterEnd;"), 'Guided frontmatter action gate removed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r9aq-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R9_AQ applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
