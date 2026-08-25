#!/usr/bin/env node
'use strict';

// R7 AH: promise colour actions only for the one code-only family that offers one.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '4CC21B297D7F5698B16BC6ED447F492BF0C695E6FF6EFF5E9AC1F303DC9F96B1';
const EXPECTED_OUTPUT_SHA256 = '8837F47624FD2E2F1006D91180662A9E1425200AB0DA66FFED1A322096700FEE';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(process.argv.length === 3, 'usage: node R7_AH_truthful_code_only_chip.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(
    text,
    "        const source = String(el.source ? el.source.value : (state.source || ''));\n        // Back on a flowchart this chip is wrong: drop it so the canvas's own chip is alone.\n        if (!source.trim() || detectMermaidDiagramType(source) === 'flowchart') { codeOnlyHideHint(); return; }",
    "        const source = String(el.source ? el.source.value : (state.source || ''));\n        const type = detectMermaidDiagramType(source);\n        // Back on a flowchart this chip is wrong: drop it so the canvas's own chip is alone.\n        if (!source.trim() || type === 'flowchart') { codeOnlyHideHint(); return; }"
  );
  text = replaceExact(
    text,
    "          text.textContent = 'Drawn from its code \\u00b7 click a part to find its line \\u00b7 right-click for fit, size, export and colours';",
    "          text.textContent = type === 'gitgraph'\n            ? 'Drawn from its code \\u00b7 click a part to find its line \\u00b7 right-click for fit, size, export and branch colours'\n            : 'Drawn from its code \\u00b7 click a part to find its line \\u00b7 right-click for fit, size and export';"
  );

  requireTrue(text !== original, 'patch made no change');
  requireTrue(!text.includes("right-click for fit, size, export and colours';"), 'unconditional colour promise survived');
  requireTrue((text.match(/right-click for fit, size, export and branch colours/g) || []).length === 1,
    'gitGraph colour promise post-condition failed');
  requireTrue((text.match(/right-click for fit, size and export/g) || []).length === 1,
    'non-colour chip post-condition failed');
  for (const detector of ["if (/^C4Context\\b/i.test(cleaned)) return 'c4'", "if (/^timeline\\b/i.test(cleaned)) return 'timeline'", "if (/^xychart-beta\\b/i.test(cleaned)) return 'xy'", "if (/^pie\\b/i.test(cleaned)) return 'pie'"]) {
    requireTrue(text.includes(detector), `menu-heading detector missing: ${detector}`);
  }
  requireTrue(text.split('function buildDiagramContextMenu(target)').length === original.split('function buildDiagramContextMenu(target)').length,
    'diagram context-menu dispatcher changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r7ah-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R7_AH applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
