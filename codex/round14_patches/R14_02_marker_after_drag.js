#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'TO_BE_PINNED';
const EXPECTED_OUTPUT_SHA256 = 'TO_BE_PINNED';
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
  requireTrue(EXPECTED_INPUT_SHA256 !== 'TO_BE_PINNED', 'input SHA-256 is not pinned');
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`      function handlePreviewNodeClick(event) {
        // The click that ends a body drag on the canvas is the drag's release, not a
        // document request. This guard must run before the marker-specific route.
        if (performance.now() < canvasMoveSuppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
        const workpaperMarker = event.target instanceof Element`,
`      function handlePreviewNodeClick(event) {
        const workpaperMarker = event.target instanceof Element`);

  text = replaceExact(text,
`          return;
        }
        const id = resolveNodeIdFromElement(event.target);`,
`          return;
        }
        // Suppress only the body drag's own release click. A separate marker click
        // is an explicit request and must remain available during this short window.
        if (performance.now() < canvasMoveSuppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
        const id = resolveNodeIdFromElement(event.target);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/performance\.now\(\) < canvasMoveSuppressClickUntil/g) || []).length === 1,
    'drag release suppression census changed');
  const markerAt = text.indexOf('if (plainMarkerClick) {');
  const suppressAt = text.indexOf('if (performance.now() < canvasMoveSuppressClickUntil)');
  const resolveAt = text.indexOf('const id = resolveNodeIdFromElement(event.target);', suppressAt);
  requireTrue(markerAt >= 0 && suppressAt > markerAt && resolveAt > suppressAt,
    'drag suppression is not below the marker branch and above the body route');
  requireTrue((text.match(/const plainMarkerClick = Boolean\(workpaperMarker\)/g) || []).length === 1,
    'plain marker gate changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r14-02-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R14_02 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
