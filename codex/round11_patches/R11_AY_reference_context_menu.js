#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '771C7C6CC02F2E849665063818824D450D75FB65F751CCDAF975EE145C6F66C3';
const EXPECTED_OUTPUT_SHA256 = '3E00390550F8D4CA4B563C0582F637619AF4770A884C538C06B0F2B01C6AF793';
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
`      function buildDocsContextMenu(target, point = null) {
        const row = target.closest('#wpList .wp-list-item[data-workpaper-id]');`,
`      function buildDocsContextMenu(target, point = null) {
        const chip = target.closest('#wpLinkChips .wp-link-chip');
        if (chip) return buildDocsReferenceContextMenu(chip);
        const row = target.closest('#wpList .wp-list-item[data-workpaper-id]');`);

  text = replaceExact(text,
`      // Empty space in the register: the same four types New ▾ offers.
      function buildDocsRegisterContextMenu(target) {`,
`      // A reference chip already owns both operations. The context menu resolves
      // the same stored link for an honest destination label, then invokes the
      // existing open/remove controls rather than growing a second mutation path.
      function buildDocsReferenceContextMenu(chip) {
        const doc = activeWorkpaper();
        const index = el.wpLinkChips ? Array.from(el.wpLinkChips.children).indexOf(chip) : -1;
        if (!doc || index < 0 || !doc.links[index]) return null;
        const resolved = resolveWorkpaperLink(doc.links[index]);
        const open = chip.querySelector('.wp-chip-open');
        const remove = chip.querySelector('.wp-chip-remove');
        const rows = [[null, String(open?.textContent || resolved.text).trim(), 'heading']];
        const jumpLabel = resolved.kind === 'diagram'
          ? (resolved.nodeId ? '→  Go to this block' : '→  Open this diagram')
          : resolved.kind === 'block' ? '→  Open this document block' : '→  Open this document';
        rows.push([() => openWorkpaperReference(resolved), jumpLabel,
          resolved.dangling ? 'The referenced target is no longer in this workspace.' : undefined]);
        if (remove) rows.push([() => remove.click(), '×  Remove reference']);
        return { rows, anchor: chip, label: 'Actions for ' + resolved.text, menuConfig: { fitViewport: true } };
      }

      // Empty space in the register: the same four types New ▾ offers.
      function buildDocsRegisterContextMenu(target) {`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/target\.closest\('#wpLinkChips \.wp-link-chip'\)/g) || []).length === 1,
    'reference-chip context branch missing');
  requireTrue((text.match(/function buildDocsReferenceContextMenu\(chip\)/g) || []).length === 1,
    'reference context builder missing');
  requireTrue((text.match(/Array\.from\(el\.wpLinkChips\.children\)\.indexOf\(chip\)/g) || []).length === 1,
    'reference DOM-to-state lookup missing');
  requireTrue((text.match(/String\(open\?\.textContent \|\| resolved\.text\)\.trim\(\)/g) || []).length === 1,
    'chip-text menu heading missing');
  requireTrue((text.match(/resolved\.dangling \? 'The referenced target is no longer in this workspace\.'/g) || []).length === 1,
    'dangling jump explanation missing');
  requireTrue((text.match(/resolved\.nodeId \? '→  Go to this block' : '→  Open this diagram'/g) || []).length === 1,
    'stored block scope is not preserved for a dangling diagram reference');
  requireTrue((text.match(/\[\(\) => remove\.click\(\), '×  Remove reference'\]/g) || []).length === 1,
    'existing remove-button route missing');
  requireTrue((text.match(/openWorkpaperReference\(resolved\)/g) || []).length === 3,
    'reference opener caller census changed');
  requireTrue(text.includes("if (target.closest('#wpDocInner')) return buildDocsPageContextMenu(target, point);"),
    'generic Docs page context route changed');
  requireTrue(text.includes("el.wpLinkChips?.querySelectorAll('.wp-chip-remove').forEach(button => button.remove());"),
    'read-only remove gate changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r11ay-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R11_AY applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
