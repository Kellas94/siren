#!/usr/bin/env python
"""fix_p6_orphan.py - Escape must not orphan a structure menu over a surface that
has already changed mode underneath it.

    python fix_p6_orphan.py <target.html>

In Present, with Build open and the + Add list showing, Escape reached
handlePresentationKeydown -> mapHandleKey -> mapSetBuild(false): Build exited, the
Map went back to presenting, and the menu stayed painted on top of the Present bar,
still live. A hit-tested click on a row then added a slide and opened the card
editor while the app believed it was presenting.

Eight edits, all additive:
  1. a `structureMenuEscape` slot beside `structureMenuAway`
  2. closeStructureMenu() retires that listener the same way it retires the
     outside-mousedown one
  3. openStructureMenu() registers a window-capture Escape guard for EVERY menu:
     close, hand focus back to the anchor, stop the press.  It has to be window
     capture because handlePresentationKeydown is a CAPTURING listener on document.
     Managed (config.keyboard) menus keep exactly the behaviour they had - the
     guard calls closeStructureMenu(true), which is what their own Escape branch
     did - so no opted-in caller changes.
  4/5. mapSetMode() and mapSetBuild() close the menu on the way through
  6/7/8. openPresentation(), closePresentation() and blanking do the same

Anchor-guarded: every anchor must appear exactly once or nothing is written.
"""
import io
import os
import sys
import tempfile

EDITS = []


def edit(name, anchor, replacement):
    EDITS.append((name, anchor, replacement))


# ---------------------------------------------------------------- 1. the slot
edit(
    "state slot",
    "      let structureMenuEl = null;\n"
    "      let structureMenuAway = null;\n"
    "      let structureMenuAnchor = null;\n",

    "      let structureMenuEl = null;\n"
    "      let structureMenuAway = null;\n"
    "      // Escape has to be answered by the menu itself; the listener that does it\n"
    "      // is retired beside the outside-mousedown one, for the same reason.\n"
    "      let structureMenuEscape = null;\n"
    "      let structureMenuAnchor = null;\n",
)

# --------------------------------------------------- 2. retire it on every close
edit(
    "closeStructureMenu retires the Escape guard",
    "        if (structureMenuAway) { document.removeEventListener('mousedown', structureMenuAway, true); structureMenuAway = null; }\n"
    "        if (structureMenuEl) { structureMenuEl.remove(); structureMenuEl = null; }\n",

    "        if (structureMenuAway) { document.removeEventListener('mousedown', structureMenuAway, true); structureMenuAway = null; }\n"
    "        if (structureMenuEscape) { window.removeEventListener('keydown', structureMenuEscape, true); structureMenuEscape = null; }\n"
    "        if (structureMenuEl) { structureMenuEl.remove(); structureMenuEl = null; }\n",
)

# ------------------------------------------------------------ 3. the guard itself
edit(
    "openStructureMenu registers the Escape guard",
    "        structureMenuAway = away;\n"
    "        document.addEventListener('mousedown', away, true);\n"
    "        const first = menu.querySelector('.struct-menu-item:not(:disabled)');\n"
    "        if (first) first.focus();\n",

    "        structureMenuAway = away;\n"
    "        document.addEventListener('mousedown', away, true);\n"
    "        // A menu is a temporary layer over a surface that can change underneath it.\n"
    "        // Escape used to travel straight past it to the app's global handlers: in\n"
    "        // Present one press left Build - the Map swapped back to presenting - while\n"
    "        // the list stayed painted on top of the Present bar, still live, so a click\n"
    "        // on a row added a slide and opened its editor in front of the room. The\n"
    "        // menu now answers its own Escape, hands focus back to the control it came\n"
    "        // from, and stops the press before anyone else sees it. It has to sit on\n"
    "        // window: handlePresentationKeydown is a CAPTURING listener on document, so\n"
    "        // a document-level guard would run second and the deck would move anyway.\n"
    "        const escape = event => {\n"
    "          if (event.key !== 'Escape' || event.defaultPrevented) return;\n"
    "          event.preventDefault();\n"
    "          event.stopPropagation();\n"
    "          event.stopImmediatePropagation();\n"
    "          // A managed menu records its anchor, so closeStructureMenu returns focus\n"
    "          // itself - exactly what its own Escape branch asked for. An unmanaged one\n"
    "          // records nothing, so hand the focus back here instead.\n"
    "          closeStructureMenu(managed);\n"
    "          if (!managed && anchor && anchor.isConnected && typeof anchor.focus === 'function') {\n"
    "            anchor.focus({ preventScroll: true });\n"
    "          }\n"
    "        };\n"
    "        structureMenuEscape = escape;\n"
    "        window.addEventListener('keydown', escape, true);\n"
    "        const first = menu.querySelector('.struct-menu-item:not(:disabled)');\n"
    "        if (first) first.focus();\n",
)

# --------------------------------------------- 4/5. the Map's mode transitions
edit(
    "mapSetMode closes the menu",
    "      function mapSetMode(on) {\n"
    "        mapMode = Boolean(on);\n",

    "      function mapSetMode(on) {\n"
    "        // Whatever was hanging over the old surface does not belong over the new one.\n"
    "        closeStructureMenu(false);\n"
    "        mapMode = Boolean(on);\n",
)

edit(
    "mapSetBuild closes the menu",
    "      function mapSetBuild(on) {\n"
    "        mapBuilding = Boolean(on);\n",

    "      function mapSetBuild(on) {\n"
    "        // Build's own menus - + Add, the deck export - are authoring lists. Leaving\n"
    "        // the mode by any door (Done, E, Escape, closing Present) takes them with it.\n"
    "        closeStructureMenu(false);\n"
    "        mapBuilding = Boolean(on);\n",
)

# ----------------------------------- 6/7/8. entering, leaving and blanking Present
edit(
    "openPresentation closes the menu",
    "      async function openPresentation() {\n"
    "        const openRequest = presentOpenRequest;\n"
    "        presentOpenRequest = '';\n",

    "      async function openPresentation() {\n"
    "        const openRequest = presentOpenRequest;\n"
    "        presentOpenRequest = '';\n"
    "        // The overlay covers whatever was underneath, menus included.\n"
    "        closeStructureMenu(false);\n",
)

edit(
    "closePresentation closes the menu",
    "      function closePresentation() {\n"
    "        // Leaving while blanked must not leave the veil parented to a hidden overlay.\n"
    "        setPresentationBlank('');\n",

    "      function closePresentation() {\n"
    "        // Leaving while blanked must not leave the veil parented to a hidden overlay,\n"
    "        // and leaving with a menu open must not leave it painted over the editor.\n"
    "        closeStructureMenu(false);\n"
    "        setPresentationBlank('');\n",
)

edit(
    "blanking closes the menu",
    "        const layer = presentBlankNode();\n"
    "        layer.dataset.tone = next;\n",

    "        // A blank screen owns the room. Nothing may be left floating over it.\n"
    "        closeStructureMenu(false);\n"
    "        const layer = presentBlankNode();\n"
    "        layer.dataset.tone = next;\n",
)


def main():
    if len(sys.argv) < 2:
        print("usage: fix_p6_orphan.py <target.html>")
        return 2
    target = sys.argv[1]
    with io.open(target, encoding="utf-8", newline="") as handle:
        text = handle.read()
    before = len(text)

    # Two of the anchors are pure insertion points and survive a first run, so an
    # accidental second run would report a confusing half-drift. Say it plainly.
    if "structureMenuEscape" in text:
        print("ALREADY APPLIED - nothing written (found `structureMenuEscape`).")
        return 1

    drift = []
    for name, anchor, _ in EDITS:
        count = text.count(anchor)
        if count != 1:
            drift.append("  %-46s found %d times (expected 1)" % (name, count))
    if drift:
        print("DRIFT - nothing written:")
        print("\n".join(drift))
        return 1

    for name, anchor, replacement in EDITS:
        text = text.replace(anchor, replacement, 1)
        print("  applied: %s" % name)

    directory = os.path.dirname(os.path.abspath(target))
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="",
                                         dir=directory, suffix=".tmp", delete=False)
    try:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
    finally:
        handle.close()
    os.replace(handle.name, target)
    print("wrote %s  %d -> %d bytes (+%d)" % (target, before, len(text), len(text) - before))
    return 0


if __name__ == "__main__":
    sys.exit(main())
