#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EXPECTED_INPUT_SHA256 = '5E1325FB393BB6808EC84AD86A942D7B7444754CD5DB442F9B65BC14BE36A01B';
const EXPECTED_OUTPUT_SHA256 = 'F45E595B3285CD3C724F94E3448794A2A588B8FFB6FF33418B92447E5781AEB7';
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
`      let tourCard = null;

      function endWelcomeTour() {
        document.querySelectorAll('.tour-highlight').forEach(node => node.classList.remove('tour-highlight'));`,
`      let tourCard = null;

      function handleWelcomeTourKeydown(event) {
        if (!tourCard || document.querySelector('dialog[open]')) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          endWelcomeTour();
          return;
        }
        if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey
            || tourCard.contains(document.activeElement)) return;
        const actions = Array.from(tourCard.querySelectorAll('button:not([disabled])'));
        const destination = event.shiftKey ? actions[actions.length - 1] : actions[0];
        if (!destination) return;
        // Capture before the source editor or the legacy canvas route can consume Tab.
        event.preventDefault();
        event.stopPropagation();
        destination.focus();
      }

      function endWelcomeTour() {
        document.removeEventListener('keydown', handleWelcomeTourKeydown, true);
        document.querySelectorAll('.tour-highlight').forEach(node => node.classList.remove('tour-highlight'));`);

  text = replaceExact(text,
`          tourCard.setAttribute('role', 'dialog');
          tourCard.setAttribute('aria-label', 'Welcome tour');
          document.body.appendChild(tourCard);`,
`          tourCard.setAttribute('role', 'dialog');
          tourCard.setAttribute('aria-label', 'Welcome tour');
          tourCard.setAttribute('tabindex', '-1');
          tourCard.setAttribute('aria-live', 'polite');
          tourCard.setAttribute('aria-atomic', 'true');
          document.addEventListener('keydown', handleWelcomeTourKeydown, true);
          document.body.appendChild(tourCard);`);

  requireTrue(text !== original, 'patch made no change');
  requireTrue((text.match(/function handleWelcomeTourKeydown\(event\)/g) || []).length === 1,
    'tour keyboard route missing');
  requireTrue((text.match(/document\.querySelector\('dialog\[open\]'\)/g) || []).length >= 2,
    'tour does not yield Escape to a native dialog');
  requireTrue((text.match(/tourCard\.contains\(document\.activeElement\)/g) || []).length === 1,
    'external-Tab gate missing');
  requireTrue((text.match(/event\.shiftKey \? actions\[actions\.length - 1\] : actions\[0\]/g) || []).length === 1,
    'forward/backward one-press tour route missing');
  requireTrue((text.match(/removeEventListener\('keydown', handleWelcomeTourKeydown, true\)/g) || []).length === 1,
    'tour keyboard lifecycle is not torn down');
  requireTrue((text.match(/addEventListener\('keydown', handleWelcomeTourKeydown, true\)/g) || []).length === 1,
    'tour keyboard lifecycle is not installed');
  requireTrue((text.match(/tourCard\.setAttribute\('tabindex', '-1'\)/g) || []).length === 1,
    'tour card has no programmatic focus target');
  requireTrue((text.match(/tourCard\.setAttribute\('aria-live', 'polite'\)/g) || []).length === 1,
    'tour card is not a polite live region');
  requireTrue((text.match(/tourCard\.setAttribute\('aria-atomic', 'true'\)/g) || []).length === 1,
    'tour announcement is not atomic');
  requireTrue(!text.includes("tourCard.setAttribute('aria-modal', 'true')"),
    'non-modal tour must not claim a modal accessibility contract');
  requireTrue((text.match(/function showTourStep\(index, focusNext = false\)/g) || []).length === 1,
    'AV focus provenance changed');
  requireTrue((text.match(/showTourStep\(index \+ 1, focusNext\)/g) || []).length === 1,
    'hidden tour step lost AV focus provenance');
  requireTrue((text.match(/if \(focusNext\) next\.focus\(\);/g) || []).length === 1,
    'explicit tour action focus changed');
  requireTrue((text.match(/setTimeout\(startWelcomeTour, introPlaying \? 1900 : 1100\)/g) || []).length === 1,
    'first-run timer route changed');
  requireTrue(text.split('const APP_VERSION =').length === original.split('const APP_VERSION =').length, 'APP_VERSION structure changed');
  requireTrue(text.split('const CHANGELOG =').length === original.split('const CHANGELOG =').length, 'CHANGELOG structure changed');
  requireTrue(text.split('Content-Security-Policy').length === original.split('Content-Security-Policy').length, 'CSP structure changed');

  const outputBytes = Buffer.from(text, 'utf8');
  const afterHash = sha256(outputBytes);
  if (EXPECTED_OUTPUT_SHA256 !== 'TO_BE_PINNED') requireTrue(afterHash === EXPECTED_OUTPUT_SHA256, `output SHA-256 ${afterHash}, expected ${EXPECTED_OUTPUT_SHA256}`);
  const temporary = path.join(path.dirname(target), `.r13bi-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(temporary, outputBytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  process.stdout.write(`R13_BI applied: ${beforeHash} -> ${afterHash}\n`);
}

main();
