#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EXPECTED_INPUT_SHA256 = 'AC14DB72BC38EF72799B8A323DB649057F63227E84588FD18D79C438E824F844';
const EXPECTED_OUTPUT_SHA256 = '03CD3978B819D993BA9DC0B2E749D134BD40DE35D1BB54D57A2D97C88267167F';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}
function main() {
  requireTrue(process.argv.length === 3, 'usage: node R8_AK_short_docs_block_menu.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target), beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8'); let text = original;

  text = replaceExact(text,
`      max-height: min(72vh, 560px);
      overflow: auto;
      padding: 5px;`,
`      max-height: min(72vh, 560px);
      overflow: auto;
      scrollbar-color: var(--border-strong) transparent;
      scrollbar-width: thin;
      padding: 5px;`);

  text = replaceExact(text,
`    .struct-menu-item {
      display: block;`,
`    .struct-menu::-webkit-scrollbar { width: 10px; }
    .struct-menu::-webkit-scrollbar-thumb { background: var(--border-strong); border: 2px solid transparent; border-radius: 8px; background-clip: padding-box; }
    .struct-menu-item {
      display: block;`);

  text = replaceExact(text,
`        if (config && config.plain) menu.classList.add('is-plain');
        menu.setAttribute('role', role);`,
`        if (config && config.plain) menu.classList.add('is-plain');
        // The global 72vh cap protects long menus across the app. A block-action
        // menu may use the actual viewport when its complete list genuinely fits.
        if (config && config.fitViewport) menu.style.maxHeight = 'calc(100vh - 16px)';
        menu.setAttribute('role', role);`);

  text = replaceExact(text,
`        document.body.appendChild(menu);
        // A menu can be anchored at a POINT rather than at a control`,
`        document.body.appendChild(menu);
        const scrollable = menu.scrollHeight > menu.clientHeight + 1;
        menu.dataset.scrollable = String(scrollable);
        if (scrollable) menu.setAttribute('aria-description', 'Scrollable menu. Use arrow keys, End, or the mouse wheel to reach every action.');
        // A menu can be anchored at a POINT rather than at a control`);

  text = replaceExact(text,
`      function openContextMenu(anchor, rows, point, label) {
        if (!rows || !contextMenuHasActions(rows)) return false;`,
`      function openContextMenu(anchor, rows, point, label, config = null) {
        if (!rows || !contextMenuHasActions(rows)) return false;`);

  text = replaceExact(text,
`        openStructureMenu(anchor, rows, '', run => { if (typeof run === 'function') run(); }, {
          keyboard: true, role: 'menu', restoreFocus: true, plain: true,
          label: label || 'Actions', point: point || null
        });`,
`        openStructureMenu(anchor, rows, '', run => { if (typeof run === 'function') run(); }, {
          ...(config && typeof config === 'object' ? config : {}),
          keyboard: true, role: 'menu', restoreFocus: true, plain: true,
          label: label || 'Actions', point: point || null
        });`);

  text = replaceExact(text,
`        openContextMenu(built.anchor || target, built.rows,
          event.button === 2 ? { x: event.clientX, y: event.clientY } : null, built.label);`,
`        openContextMenu(built.anchor || target, built.rows,
          event.button === 2 ? { x: event.clientX, y: event.clientY } : null, built.label, built.menuConfig);`);

  text = replaceExact(text,
`        openContextMenu(built.anchor || target, built.rows, null, built.label);`,
`        openContextMenu(built.anchor || target, built.rows, null, built.label, built.menuConfig);`);

  text = replaceExact(text,
`        return { rows, anchor: blockEl, label: \`\${workpaperBlockLabel(block)} block actions\` };`,
`        return { rows, anchor: blockEl, label: \`\${workpaperBlockLabel(block)} block actions\`, menuConfig: { fitViewport: true } };`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/max-height: min\(72vh, 560px\)/g) || []).length === 1, 'global menu cap changed or duplicated');
  requireTrue((text.match(/fitViewport/g) || []).length === 2, 'viewport-fit opt-in is not isolated');
  requireTrue((text.match(/data\.scrollable|dataset\.scrollable/g) || []).length === 1, 'scrollability marker post-condition failed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8'), afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r8ak-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R8_AK applied: ${beforeHash} -> ${afterHash}\n`);
}
main();
