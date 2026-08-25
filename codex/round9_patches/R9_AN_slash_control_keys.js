#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '1C088DAC741F7D216474FDC7F6F58ED941E26F053B0175718F7281BD8B3A1288';
const EXPECTED_OUTPUT_SHA256 = '740304BA544D0FB0A081F5234F85914F53E7B2112FC228B2E5C1A07F1587057D';
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
`              // A printable character after the slash means the writer is typing text,
              // not choosing a block. Return the character to the paragraph that owns it.
              resumeTyping: character => {
                editor.textContent = '/' + character;`,
`              // Text immediately after the slash means the writer is writing, not
              // choosing a block. Return it to the paragraph that owns the marker.
              resumeTyping: text => {
                let caretHost = editor;
                if (text === ' ') {
                  // A trailing ordinary space is collapsed by contenteditable before
                  // the next physical key. NBSP is its stable rich-text encoding.
                  editor.innerHTML = '/&nbsp;';
                } else if (text === '\\n') {
                  const nextLine = document.createElement('div');
                  nextLine.appendChild(document.createElement('br'));
                  editor.replaceChildren(document.createTextNode('/'), nextLine);
                  caretHost = nextLine;
                } else {
                  editor.textContent = '/' + text;
                }`);

  text = replaceExact(text,
`                block.html = wpBoundEditedHtml(editor);
                editor.focus({ preventScroll: true });
                const selection = window.getSelection();
                if (selection) {
                  const range = document.createRange();
                  range.selectNodeContents(editor);
                  range.collapse(false);`,
`                block.html = wpBoundEditedHtml(editor);
                editor.focus({ preventScroll: true });
                const selection = window.getSelection();
                if (selection) {
                  const range = document.createRange();
                  range.selectNodeContents(caretHost);
                  range.collapse(text === '\\n');`);

  text = replaceExact(text,
`        // Keep Space/Enter/arrow selection for the bare-slash feature. The first other
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
        }`,
`        // The first row receives focus when the slash opens this menu, but focus alone
        // is not a choice: immediate Space/Enter are ordinary writing. Once the person
        // moves through the list with an arrow/Home/End, Space or Enter picks that row.
        // Backspace is the escape hatch for an accidental slash: close, restore the
        // marker and put the caret after it, so a second Backspace edits normally.
        const menu = structureMenuEl;
        if (menu && config && typeof config.resumeTyping === 'function') {
          let slashMenuNavigated = false;
          menu.addEventListener('keydown', event => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              slashMenuNavigated = true;
              return;
            }
            let text = null;
            if (event.key === 'Backspace') text = '';
            else if (!slashMenuNavigated && event.key === ' ') text = ' ';
            else if (!slashMenuNavigated && event.key === 'Enter') text = '\\n';
            else if (event.key.length === 1 && event.key !== ' ') text = event.key;
            if (text === null) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            closeStructureMenu(false);
            config.resumeTyping(text);
          }, true);
        }`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/let slashMenuNavigated = false;/g) || []).length === 1, 'slash navigation state missing');
  requireTrue((text.match(/event\.key === 'Backspace'/g) || []).length >= 1, 'Backspace escape path missing');
  requireTrue(text.includes("!slashMenuNavigated && event.key === 'Enter'"), 'immediate Enter writing path missing');
  requireTrue(text.includes("!slashMenuNavigated && event.key === ' '"), 'immediate Space writing path missing');
  requireTrue(text.split('function openStructureMenu(anchor').length === original.split('function openStructureMenu(anchor').length, 'global menu engine changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r9an-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R9_AN applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
