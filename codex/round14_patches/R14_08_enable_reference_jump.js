#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '9E7DB5F87F39BA8C0FA597C81CE0A5FE6981EFDBA62523D7C5FE161F3299E41F';
const EXPECTED_OUTPUT_SHA256 = '0C17FB6673FD1FC5DE24CC5C474B49EAE85505589E373E7ABA870BE345338F97';
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
`        const unresolvedDiagramBlock = resolved.kind === 'diagram'
          && Boolean(resolved.nodeId) && !resolved.nodeResolvable;
        const jumpLabel = resolved.kind === 'diagram'
          ? (resolved.nodeResolvable ? '→  Go to this block' : '→  Open this diagram')
          : resolved.kind === 'block' ? '→  Open this document block' : '→  Open this document';
        rows.push([() => openWorkpaperReference(resolved), jumpLabel,
          resolved.dangling || unresolvedDiagramBlock
            ? 'The referenced target is no longer in this workspace.' : undefined]);`,
`        const jumpLabel = resolved.kind === 'diagram'
          ? (resolved.nodeResolvable ? '→  Go to this block' : '→  Open this diagram')
          : resolved.kind === 'block' ? '→  Open this document block' : '→  Open this document';
        rows.push([() => openWorkpaperReference(resolved), jumpLabel,
          resolved.dangling ? 'The referenced target is no longer in this workspace.' : undefined]);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue(!text.includes('unresolvedDiagramBlock'), 'cache-miss disablement remains');
  requireTrue((text.match(/nodeResolvable/g) || []).length === 4,
    'rendered-node truth signal changed outside menu disablement');
  requireTrue((text.match(/resolved\.dangling \? 'The referenced target is no longer in this workspace\.'/g) || []).length === 1,
    'only genuinely dangling targets should disable the jump row');
  requireTrue((text.match(/The diagram opened, but this reference does not resolve to a rendered block\./g) || []).length === 1,
    'honest post-click failure message was removed');
  requireTrue((text.match(/function workpaperDiagramNodeResolvable\(diagram, nodeId\)/g) || []).length === 1,
    'phantom-reference resolver changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r14-08-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R14_08 applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
