#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'F93B2CD12E05297907D01D965D21C39683048C344FB830797849662AB3886A56';
const EXPECTED_OUTPUT_SHA256 = '6885555CE62C50D030E0948439C9193AFADD45E7A82638A74862D92913CF5A3E';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
function replaceExact(text, oldText, newText, expected = 1) {
  const count = text.split(oldText).length - 1;
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${JSON.stringify(oldText.slice(0, 220))}`);
  return text.split(oldText).join(newText);
}

function main() {
  requireTrue(process.argv.length === 3, 'usage: node R8_AI_docs_slash_typing.js <input html copy>');
  const target = path.resolve(process.argv[2]);
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  text = replaceExact(text,
`            touchWorkpaper(doc);
            openWorkpaperAddMenu(editor, doc.blocks.indexOf(block), block.id);`,
`            touchWorkpaper(doc);
            openWorkpaperAddMenu(editor, doc.blocks.indexOf(block), block.id, {
              // A printable character after the slash means the writer is typing text,
              // not choosing a block. Return the character to the paragraph that owns it.
              resumeTyping: character => {
                editor.textContent = '/' + character;
                block.html = wpBoundEditedHtml(editor);
                editor.focus({ preventScroll: true });
                const selection = window.getSelection();
                if (selection) {
                  const range = document.createRange();
                  range.selectNodeContents(editor);
                  range.collapse(false);
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
                touchWorkpaper(doc);
              }
            });`);

  text = replaceExact(text,
`      function openWorkpaperAddMenu(anchor, at, replaceBlockId) {
        const doc = activeWorkpaper();`,
`      function openWorkpaperAddMenu(anchor, at, replaceBlockId, config = null) {
        const doc = activeWorkpaper();`);

  text = replaceExact(text,
`        }, { keyboard: true, role: 'menu', label: 'Add block', restoreFocus: true, plain: true });
      }

      // The count on the Docs button is scoped to the active diagram`,
`        }, { keyboard: true, role: 'menu', label: 'Add block', restoreFocus: true, plain: true });
        // Keep Space/Enter/arrow selection for the bare-slash feature. The first other
        // printable key exits the menu and resumes physical typing in the marker row.
        const menu = structureMenuEl;
        if (menu && config && typeof config.resumeTyping === 'function') {
          menu.addEventListener('keydown', event => {
            if (event.ctrlKey || event.metaKey || event.altKey || event.key === ' ' || event.key.length !== 1) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            const character = event.key;
            closeStructureMenu(false);
            config.resumeTyping(character);
          }, true);
        }
      }

      // The count on the Docs button is scoped to the active diagram`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/resumeTyping:/g) || []).length === 1, 'slash resume callback post-condition failed');
  requireTrue((text.match(/typeof config\.resumeTyping === 'function'/g) || []).length === 1, 'slash menu interceptor post-condition failed');
  requireTrue(text.includes("if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || readOnlyMode) return;"), 'slash feature guard was removed');
  requireTrue(text.includes("if (marker === '' || marker === '/') deleteWorkpaperBlock(doc, stale);"), 'marker-only replacement guard was removed');
  requireTrue(text.split('function openStructureMenu(anchor').length === original.split('function openStructureMenu(anchor').length, 'global menu engine changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r8ai-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R8_AI applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
