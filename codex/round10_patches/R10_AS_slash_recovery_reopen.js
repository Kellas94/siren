#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = 'BAC0C5591C5F9CAECDCD031BE38FFE4EF6221F06C239437CDBFB7BF9BADFF9AB';
const EXPECTED_OUTPUT_SHA256 = '4E4DE34091AB7C1C424250B3062B8E96A3E7CEC1BBE08120A1158365D5791E71';
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
`          // "/" on an empty paragraph is the inserter every writing tool has taught
          // people to expect. It only fires when there is nothing to type over, so a
          // slash inside a sentence is still a slash.
          editor.addEventListener('keydown', event => {`,
`          // "/" on an empty paragraph is the inserter every writing tool has taught
          // people to expect. Backspace deliberately leaves one recoverable marker;
          // that exact marker may reopen the menu once, but ordinary text never can.
          let slashMarkerRecovered = false;
          editor.addEventListener('keydown', event => {`);

  text = replaceExact(text,
`            if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || readOnlyMode) return;
            if (editor.textContent.trim() || editor.querySelector('img, table, li')) return;
            event.preventDefault();`,
`            if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || readOnlyMode) return;
            const recoveredMarker = slashMarkerRecovered && editor.textContent === '/' && block.html === '/';
            if (!recoveredMarker && (editor.textContent.trim() || editor.querySelector('img, table, li'))) return;
            slashMarkerRecovered = false;
            event.preventDefault();`);

  text = replaceExact(text,
`              resumeTyping: text => {
                let caretHost = editor;`,
`              resumeTyping: (text, detail = null) => {
                slashMarkerRecovered = Boolean(detail && detail.recoveredMarker);
                let caretHost = editor;`);

  text = replaceExact(text,
`          editor.addEventListener('input', () => { block.html = wpBoundEditedHtml(editor); touchWorkpaper(doc); });`,
`          editor.addEventListener('input', () => {
            slashMarkerRecovered = false;
            block.html = wpBoundEditedHtml(editor);
            touchWorkpaper(doc);
          });`);

  text = replaceExact(text,
`            config.resumeTyping(text);
          }, true);`,
`            config.resumeTyping(text, { recoveredMarker: event.key === 'Backspace' });
          }, true);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/let slashMarkerRecovered = false;/g) || []).length === 1, 'slash recovery state missing');
  requireTrue((text.match(/const recoveredMarker = slashMarkerRecovered/g) || []).length === 1, 'recovered marker gate missing');
  requireTrue((text.match(/recoveredMarker: event\.key === 'Backspace'/g) || []).length === 1, 'Backspace recovery signal missing');
  requireTrue(text.includes("editor.textContent === '/' && block.html === '/'"), 'recovery is not limited to the exact marker');
  requireTrue(text.includes("editor.textContent.trim() || editor.querySelector('img, table, li')"), 'ordinary non-empty guard removed');
  requireTrue(text.includes("editor.innerHTML = '/&nbsp;'"), 'stable trailing-space caret encoding changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r10as-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R10_AS applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
