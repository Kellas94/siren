#!/usr/bin/env python3
"""
FIX 4 - the card editor's segmented controls are not keyboard reachable.

mapEditorSegmented sets a roving tabindex but binds no arrow-key handler, so only
the already-chosen option can be focused and the others cannot be selected without
a mouse. The same half-built pattern is on the card editor's kind rail.

The "Camera, motion & decisions" panel already implements the full radiogroup
contract in handlePresentationSettingKeydown. Rather than write a second dialect,
this patch lifts the key-walking half of that function into one shared helper -
rovingRadioKeydown - and points all three groups at it:

  1. rovingRadioKeydown(event, item, choose)   new, generic, next to the reference
  2. handlePresentationSettingKeydown          becomes a thin wrapper over it
  3. mapEditorSegmented                        gains a keydown listener + one commit
  4. the card editor's kind rail               gains a keydown listener + one commit

Roles were checked and are already correct everywhere in the card editor
(role=radiogroup / role=radio / aria-checked, never aria-pressed), so no role or
attribute changes are made and nothing that keys off `.is-on` in CSS is touched.

Usage:  python fix_pv_segments.py <target.html>
Aborts without writing if any anchor is missing or not unique.
"""

import io
import os
import sys
import tempfile

# ---------------------------------------------------------------- anchors ----

# 1. The reference radiogroup handler built for "Camera, motion & decisions".
OLD_PRESENT_KEYDOWN = """      function handlePresentationSettingKeydown(event) {
        const button = event.target instanceof Element ? event.target.closest('.present-seg-button') : null;
        const rail = button && button.closest('.present-seg');
        if (!rail) return;
        const buttons = Array.from(rail.querySelectorAll('.present-seg-button'));
        const index = buttons.indexOf(button);
        let next = -1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        setPresentationSetting(rail.dataset.setting, buttons[next].dataset.value);
        buttons[next].focus();
      }
"""

NEW_PRESENT_KEYDOWN = """      /* One radiogroup dialect for the whole app, lifted out of the settings rail
         so the card editor cannot drift into a second one. This is the WAI-ARIA
         radio group contract: the arrows move inside the group and wrap round,
         Home and End reach its ends, and selection follows focus. Only the commit
         differs between callers - the settings rail writes through its <select>,
         the card editor through a closure - so that is the one thing passed in. */
      function rovingRadioKeydown(event, item, choose) {
        const button = event.target instanceof Element ? event.target.closest(item) : null;
        const group = button && button.closest('[role="radiogroup"]');
        if (!group) return false;
        const buttons = Array.from(group.querySelectorAll(item));
        const index = buttons.indexOf(button);
        let next = -1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return false;
        event.preventDefault();
        choose(buttons[next], group);
        buttons[next].focus();
        return true;
      }

      function handlePresentationSettingKeydown(event) {
        rovingRadioKeydown(event, '.present-seg-button', (button, rail) => {
          setPresentationSetting(rail.dataset.setting, button.dataset.value);
        });
      }
"""

# 2. The card editor's own segmented builder - kind-independent: Text size,
#    Alignment and the picture pane's Framing all come out of this one function.
OLD_SEGMENTED = """      function mapEditorSegmented(label, options, get, set) {
        const field = mapEditorField(label);
        field.wrap.classList.add('card-field-inline');
        const group = document.createElement('div');
        group.className = 'card-seg';
        group.setAttribute('role', 'radiogroup');
        group.setAttribute('aria-label', label);
        const buttons = [];
        const sync = () => {
          const current = String(get());
          buttons.forEach(([value, button]) => {
            const on = String(value) === current;
            button.classList.toggle('is-on', on);
            button.setAttribute('aria-checked', String(on));
            button.tabIndex = on ? 0 : -1;
          });
        };
        options.forEach(([value, text, title]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'card-seg-button';
          button.textContent = text;
          button.setAttribute('role', 'radio');
          if (title) button.title = title;
          button.addEventListener('click', () => { set(value); sync(); mapTouchCard(false); });
          buttons.push([value, button]);
          group.appendChild(button);
        });
        sync();
        field.body.appendChild(group);
        return field.wrap;
      }
"""

NEW_SEGMENTED = """      function mapEditorSegmented(label, options, get, set) {
        const field = mapEditorField(label);
        field.wrap.classList.add('card-field-inline');
        const group = document.createElement('div');
        group.className = 'card-seg';
        group.setAttribute('role', 'radiogroup');
        group.setAttribute('aria-label', label);
        const buttons = [];
        const sync = () => {
          const current = String(get());
          buttons.forEach(([value, button]) => {
            const on = String(value) === current;
            button.classList.toggle('is-on', on);
            button.setAttribute('aria-checked', String(on));
            button.tabIndex = on ? 0 : -1;
          });
        };
        // One commit, so the mouse and the arrows cannot mean different things.
        const choose = value => { set(value); sync(); mapTouchCard(false); };
        options.forEach(([value, text, title]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'card-seg-button';
          button.textContent = text;
          button.setAttribute('role', 'radio');
          if (title) button.title = title;
          button.addEventListener('click', () => choose(value));
          buttons.push([value, button]);
          group.appendChild(button);
        });
        /* The roving tabindex above is only half a radiogroup. Without the arrows
           the one Tab stop it leaves lands on the chosen option and every other
           option is unreachable - visible, focusable by nothing. */
        group.addEventListener('keydown', event => rovingRadioKeydown(event, '.card-seg-button', button => {
          const entry = buttons.find(item => item[1] === button);
          if (entry) choose(entry[0]);
        }));
        sync();
        field.body.appendChild(group);
        return field.wrap;
      }
"""

# 3. The kind rail. Built by hand in mapEnsureCardEditor rather than by
#    mapEditorSegmented, but carrying the same half-finished pattern.
OLD_KIND_RAIL = """        const kindButtons = [];
        MAP_CARD_KINDS.forEach(([kind, label, glyph, hint]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'card-kind-tile';
          button.setAttribute('role', 'radio');
          button.title = hint;
          const mark = document.createElement('span');
          mark.className = 'card-kind-glyph';
          mark.textContent = glyph;
          const text = document.createElement('span');
          text.className = 'card-kind-label';
          text.textContent = label;
          button.append(mark, text);
          button.addEventListener('click', () => {
            if (!mapCardEditorCard || mapCardEditorCard.kind === kind) return;
            mapCardEditorCard.kind = kind;
            mapEnsureCardPayload(mapCardEditorCard);
            mapRenderCardEditorPane();
            mapTouchCard(false);
          });
          kindButtons.push([kind, button]);
          rail.appendChild(button);
        });
"""

NEW_KIND_RAIL = """        const kindButtons = [];
        // One commit, so the mouse and the arrows cannot mean different things.
        const chooseKind = kind => {
          if (!mapCardEditorCard || mapCardEditorCard.kind === kind) return;
          mapCardEditorCard.kind = kind;
          mapEnsureCardPayload(mapCardEditorCard);
          mapRenderCardEditorPane();
          mapTouchCard(false);
        };
        MAP_CARD_KINDS.forEach(([kind, label, glyph, hint]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'card-kind-tile';
          button.setAttribute('role', 'radio');
          button.title = hint;
          const mark = document.createElement('span');
          mark.className = 'card-kind-glyph';
          mark.textContent = glyph;
          const text = document.createElement('span');
          text.className = 'card-kind-label';
          text.textContent = label;
          button.append(mark, text);
          button.addEventListener('click', () => chooseKind(kind));
          kindButtons.push([kind, button]);
          rail.appendChild(button);
        });
        // The rail is a radiogroup too, and was missing the same half.
        rail.addEventListener('keydown', event => rovingRadioKeydown(event, '.card-kind-tile', button => {
          const entry = kindButtons.find(item => item[1] === button);
          if (entry) chooseKind(entry[0]);
        }));
"""

# Guards that must already hold - the fix depends on them and must not be
# silently applied to a file where they have changed.
REQUIRED_PRESENT = [
    # The Present overlay's document-capture handler must already stand aside for
    # an open dialog, which is what the card editor is.
    "        if (document.querySelector('dialog[open]')) return;\n",
    # The card editor really is a modal dialog.
    "        dialog.id = 'mapCardEditor';\n",
    # Nothing in the card editor uses aria-pressed for a mutually exclusive set.
    "        group.setAttribute('role', 'radiogroup');\n",
    "        rail.setAttribute('role', 'radiogroup');\n",
]

EDITS = [
    ("handlePresentationSettingKeydown -> shared helper", OLD_PRESENT_KEYDOWN, NEW_PRESENT_KEYDOWN),
    ("mapEditorSegmented -> arrow keys", OLD_SEGMENTED, NEW_SEGMENTED),
    ("card editor kind rail -> arrow keys", OLD_KIND_RAIL, NEW_KIND_RAIL),
]


def main():
    if len(sys.argv) != 2:
        print("usage: fix_pv_segments.py <target.html>", file=sys.stderr)
        return 2
    target = os.path.abspath(sys.argv[1])
    if not os.path.isfile(target):
        print("ABORT: no such file: " + target, file=sys.stderr)
        return 2

    with io.open(target, "r", encoding="utf-8", newline="") as handle:
        text = handle.read()
    original_len = len(text)

    # --- drift check: every anchor present exactly once, nothing applied twice
    problems = []
    for needle in REQUIRED_PRESENT:
        if text.count(needle) < 1:
            problems.append("missing required guard: " + needle.strip()[:80])
    for name, old, _new in EDITS:
        found = text.count(old)
        if found != 1:
            problems.append("anchor %r found %d times, expected 1" % (name, found))
    if "function rovingRadioKeydown(" in text:
        problems.append("rovingRadioKeydown already defined - patch already applied?")
    if problems:
        print("ABORT - not writing. Drift detected:", file=sys.stderr)
        for problem in problems:
            print("  - " + problem, file=sys.stderr)
        return 1

    for name, old, new in EDITS:
        text = text.replace(old, new, 1)
        print("patched: " + name)

    # --- atomic write
    directory = os.path.dirname(target)
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="", dir=directory, delete=False, suffix=".tmp"
    )
    try:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
        handle.close()
        os.replace(handle.name, target)
    except BaseException:
        handle.close()
        if os.path.exists(handle.name):
            os.remove(handle.name)
        raise

    print("wrote %s  (%d -> %d bytes, +%d)" % (target, original_len, len(text), len(text) - original_len))
    return 0


if __name__ == "__main__":
    sys.exit(main())
