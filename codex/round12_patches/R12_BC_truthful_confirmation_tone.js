#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '1B8279C4D0A04B52858DE26C76E5F8090F1555EE37BD280684632D40B7DC33AF';
const EXPECTED_OUTPUT_SHA256 = '101E2ACE553B7AEB44CDC1FF6C9E02042CDAC7F7038741CD8D3BCDFB5322FD61';
const target = path.resolve(process.argv[2] || '');
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

function countExact(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function replaceExact(text, oldText, newText, expected = 1) {
  const count = countExact(text, oldText);
  requireTrue(count === expected, `anchor count ${count}, expected ${expected}: ${oldText.slice(0, 160)}`);
  return text.split(oldText).join(newText);
}

function classifyMultilineCall(text, anchor, expression) {
  const count = countExact(text, anchor);
  requireTrue(count === 1, `classification anchor count ${count}, expected 1: ${anchor}`);
  const anchorAt = text.indexOf(anchor);
  const callAt = text.lastIndexOf('requestConfirmation({', anchorAt);
  requireTrue(callAt >= 0 && anchorAt - callAt < 700, `anchor is not inside a nearby requestConfirmation: ${anchor}`);
  const tail = text.slice(anchorAt);
  const actionMatch = tail.match(/\n([ \t]*)action\s*:/);
  requireTrue(actionMatch, `action field not found after classification anchor: ${anchor}`);
  const actionAt = anchorAt + actionMatch.index;
  const beforeAction = text.slice(anchorAt, actionAt);
  const confirmMatches = Array.from(beforeAction.matchAll(/^[ \t]*confirmText\s*:.*$/gm));
  requireTrue(confirmMatches.length === 1, `confirmText count ${confirmMatches.length}, expected 1 before action: ${anchor}`);
  const confirmAt = anchorAt + confirmMatches[0].index;
  const lineEnd = text.indexOf('\n', confirmAt);
  requireTrue(lineEnd >= 0 && lineEnd <= actionAt, `confirmText line boundary missing: ${anchor}`);
  const indent = (confirmMatches[0][0].match(/^[ \t]*/) || [''])[0];
  return text.slice(0, lineEnd + 1) + `${indent}destructive: ${expression},\n` + text.slice(lineEnd + 1);
}

function main() {
  requireTrue(target && fs.existsSync(target), 'pass the HTML file to patch');
  const originalBytes = fs.readFileSync(target);
  const beforeHash = sha256(originalBytes);
  requireTrue(beforeHash === EXPECTED_INPUT_SHA256, `input SHA-256 ${beforeHash}, expected ${EXPECTED_INPUT_SHA256}`);
  const original = originalBytes.toString('utf8');
  let text = original;

  // 45 real call sites: 12 destructive, 32 non-destructive/recoverable and one
  // whose tone depends on whether Compare is about to overwrite an unsnapshotted
  // non-active target. Each anchor is unique on the pinned input.
  const classifications = [
    ["            title: 'Delete this document?',", 'true'],
    ["          title: record.restoredFromLastGood ? 'Last known-good workspace restored' : 'Download unreadable local data?',", 'false'],
    ["          title: 'Another tab saved newer work',", 'false'],
    ["          title: `Start a ${diagramTypeLabel(type)}?`,", 'false'],
    ["          title: `Remove ${active.name}?`,", 'true'],
    ["          title: `Delete ${folder.name}?`,", 'false'],
    ["            title: `Delete ${diagram.name}?`,", 'true'],
    ["          title: `Delete ${chosen.length} diagram${chosen.length === 1 ? '' : 's'}?`,", 'true'],
    ["          title: crashed ? 'Recover unsaved work?' : 'A draft does not match this workspace',", 'true'],
    ["            title: 'Delete line ' + (row.index + 1) + '?',", 'false'],
    ["            title: 'Move lines to do this?',", 'false'],
    ["          title: 'Rewrite the Mermaid code?',", 'false'],
    ["          title: `Delete “${node.label || node.id}”?`,", 'false'],
    ["          title: `Ungroup “${group.title || group.id}”?`,", 'false'],
    ["          title: 'Start a new visual flowchart?',", 'false'],
    ["          title: 'Reset every block style?',", 'false'],
    ["          title: `Delete class “${name}”?`,", 'false'],
    ["          title: `Delete preset \"${name}\"?`,", 'true'],
    ["          title: `Write the merged result into ${target.name}?`,", 'targetId !== state.activeDiagramId'],
    ["            title: 'Open portable Siren project?',", 'true'],
    ["          title: `Merge ${incoming.length} diagram${incoming.length === 1 ? '' : 's'} from ${fileName}?`,", 'false'],
    ["              title: 'Discard draft release R' + release.seq + '?',", 'true'],
    ["          title: 'Start a blank sequence diagram?',", 'false'],
    ["          title: `Delete connector ${edge.from} → ${edge.to}?`,", 'false'],
    ["          title: 'Restore this revision?',", 'false'],
    ["            confirmText: 'Make the heading, keep the rest',", 'false'],
    ["          title: 'Turn this into ' + nounPhrase + '?',", 'false'],
    ["          title: 'Replace the current diagram?',", 'false'],
    ["          title: `Delete template “${name}”?`,", 'true'],
    ["            title: `Replace ${count} occurrences?`,", 'false'],
    ["          title:`Delete scenario “${name}”?`,", 'false'],
    ["          title:'Reset presentation sequence?',", 'false'],
    ["          title: 'Remove this slide from the presentation?',", 'false'],
    ["          title: 'Delete this card?',", 'false'],
    ["          title: 'Reset the diagram?',", 'false'],
    ["                title: 'Import Copilot agent as a document?',", 'false'],
    ["              title:'Open portable Siren project?',", 'true'],
    ["              title:'Import Excel diagram structure?',", 'false'],
    ["            title:`Import ${kind}?`,", 'false'],
    ["          title:readOnly ? 'Open the read-only shared diagram?' : 'Open the shared flowchart?',", 'false'],
    ["          title: 'Restore this local version?',", 'false'],
    ["          title: 'Delete all restore points?',", 'true'],
    ["          title: `Use ${label}?`,", 'false'],
    ["          title: `Delete “${canvasLabelOf(model, id)}”?`,", 'false']
  ];
  for (const [anchor, expression] of classifications) {
    text = classifyMultilineCall(text, anchor, expression);
  }

  text = replaceExact(text,
`        requestConfirmation({title:\`Delete subflow “\${name}”?\`,message:'The saved component is removed from this browser. Existing diagrams are not changed.',confirmText:'Delete subflow',action:()=>{const library=readSubflows();delete library[name];writeSubflows(library);refreshSubflowOptions();showToast('Subflow deleted.','success');}});`,
`        requestConfirmation({title:\`Delete subflow “\${name}”?\`,message:'The saved component is removed from this browser. Existing diagrams are not changed.',confirmText:'Delete subflow',destructive:true,action:()=>{const library=readSubflows();delete library[name];writeSubflows(library);refreshSubflowOptions();showToast('Subflow deleted.','success');}});`);

  text = replaceExact(text,
`      function requestConfirmation({ title, message, confirmText, action }) {
        confirmCallback = action;
        el.confirmDialogTitle.textContent = title;
        el.confirmDialogMessage.textContent = message;
        el.confirmActionButton.textContent = confirmText || 'Continue';
        showDialog(el.confirmDialog);
      }

      // The same dialog with one button: a gesture that must refuse says why, and offers
      // nothing to confirm.
      let confirmNoticeMode = false;
      function requestNotice({ title, message, closeText }) {
        confirmNoticeMode = true;
        confirmCallback = null;
        el.confirmDialogTitle.textContent = title;
        el.confirmDialogMessage.textContent = message;
        el.confirmDialogMessage.style.whiteSpace = 'pre-line';
        el.confirmActionButton.textContent = closeText || 'OK';
        el.confirmActionButton.classList.remove('danger');
        el.cancelConfirmButton.hidden = true;
        showDialog(el.confirmDialog);
        el.confirmActionButton.focus();
      }

      function closeConfirmDialog() {
        confirmCallback = null;
        if (confirmNoticeMode) {
          confirmNoticeMode = false;
          el.confirmActionButton.classList.add('danger');
          el.cancelConfirmButton.hidden = false;
          el.confirmDialogMessage.style.whiteSpace = '';
        }
        closeDialog(el.confirmDialog);
      }`,
`      let confirmNoticeMode = false;

      function resetConfirmDialogPresentation() {
        confirmNoticeMode = false;
        el.confirmActionButton.classList.add('danger');
        el.cancelConfirmButton.hidden = false;
        el.confirmDialogMessage.style.whiteSpace = '';
      }

      function requestConfirmation({ title, message, confirmText, action, destructive = true }) {
        // Normalize every field that requestNotice changes. A native Escape from a
        // notice must not leak its one-button neutral presentation into this choice.
        resetConfirmDialogPresentation();
        confirmCallback = action;
        el.confirmDialogTitle.textContent = title;
        el.confirmDialogMessage.textContent = message;
        el.confirmActionButton.textContent = confirmText || 'Continue';
        el.confirmActionButton.classList.toggle('danger', destructive !== false);
        showDialog(el.confirmDialog);
      }

      // The same dialog with one button: a gesture that must refuse says why, and offers
      // nothing to confirm.
      function requestNotice({ title, message, closeText }) {
        resetConfirmDialogPresentation();
        confirmNoticeMode = true;
        confirmCallback = null;
        el.confirmDialogTitle.textContent = title;
        el.confirmDialogMessage.textContent = message;
        el.confirmDialogMessage.style.whiteSpace = 'pre-line';
        el.confirmActionButton.textContent = closeText || 'OK';
        el.confirmActionButton.classList.remove('danger');
        el.cancelConfirmButton.hidden = true;
        showDialog(el.confirmDialog);
        el.confirmActionButton.focus();
      }

      function closeConfirmDialog() {
        confirmCallback = null;
        resetConfirmDialogPresentation();
        closeDialog(el.confirmDialog);
      }`);

  text = replaceExact(text,
`        el.confirmDialog.addEventListener('close', () => { confirmCallback = null; });`,
`        el.confirmDialog.addEventListener('close', () => {
          confirmCallback = null;
          resetConfirmDialogPresentation();
        });`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue(countExact(original, 'requestConfirmation(') === 46, 'pinned input no longer has 45 calls plus one definition');
  requireTrue(countExact(text, 'requestConfirmation(') === 46, 'confirmation call census changed');
  requireTrue(countExact(text, 'destructive:') === 45, 'not every existing confirmation call was explicitly classified');
  requireTrue((text.match(/destructive:\s*true/g) || []).length === 12, 'destructive confirmation classification count changed');
  requireTrue((text.match(/destructive:\s*false/g) || []).length === 32, 'neutral confirmation classification count changed');
  requireTrue((text.match(/destructive:\s*targetId !== state\.activeDiagramId/g) || []).length === 1, 'conditional merge classification missing');
  requireTrue(countExact(text, 'destructive = true') === 1, 'safe API default missing');
  requireTrue(countExact(text, 'function resetConfirmDialogPresentation()') === 1, 'dialog presentation reset missing');
  requireTrue(countExact(text, "el.confirmActionButton.classList.toggle('danger', destructive !== false);") === 1, 'tone application missing');
  requireTrue(countExact(text, 'const APP_VERSION =') === countExact(original, 'const APP_VERSION ='), 'APP_VERSION structure changed');
  requireTrue(countExact(text, 'const CHANGELOG =') === countExact(original, 'const CHANGELOG ='), 'CHANGELOG structure changed');
  requireTrue(countExact(text, 'Content-Security-Policy') === countExact(original, 'Content-Security-Policy'), 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') {
    requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  }
  const temporary = path.join(path.dirname(target), `.r12bc-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R12_BC applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
