"""
Ship 1.70.0 — version and changelog.

Run LAST, after Codex's round 10 (AS, AT, AU) and, in order:
  patch_second_editor_slot.py, patch_window_title.py, patch_theme_groups.py,
  patch_slot_honest_tab.py, patch_editor_heading.py, patch_menu_heading_wrap.py,
  patch_theme_groups_select.py

An independent verification pass drove round 10 against the base and the merged build with real
keyboard and mouse. Four things it found are why this file is not a copy of the handback:

  - A SHIP-BLOCKER in MY patch, not Codex's. The new second editor tab was still being painted
    disabled by a block written for the old one: it read "Guided", carried aria-disabled, said the
    visual builder does not cover this type - and worked anyway when clicked. Fixed before shipping
    and NOT described below, because a defect introduced and removed inside one release is not news
    to anyone outside it. What IS news is the part that shipped in 1.69.0: on sixteen types the tab
    was greyed out and led to a panel that could not edit them.
  - Two changelog sentences would have been broken promises. The narrow-menu announcement does NOT
    give anybody a visible scrollbar - there is no [data-scrollable] rule in the stylesheet at all -
    so it is described as reaching screen readers only. And the Present row was never genuinely cut
    at 300px; the real cuts are at 240 to 256, so the note says that rather than "on a phone".
  - The submenu offset is not a constant 568px as the handback implied. It runs from a few pixels to
    501 depending on where inside the block you press. The note gives the range.
  - The long-name menu heading fix is measured at 412 and 480 only. The tab's menu did not open at
    375 or 320 in this harness - on ALL THREE builds - so nothing is claimed at those widths.
  - The verification called the long-name cut pre-existing. Measured against the SHIPPED 1.69.0 it
    is not the same defect: there the menu is not squeezed at all and hangs 75px off the left edge
    of a 412px screen, so the name is unreadable for a different reason. Round 10's narrow-width
    work is what brings the menu on screen; this release completes it. The note describes what a
    person actually had before, which is the menu off the screen, not the heading past a border.
  - 'Pressing the greyed-out tab did nothing' was drafted and is false: measured on the shipped
    build it opens the visual builder panel, which then says it cannot help with this type.

Also NOT claimed: AS's recovery is described as one use on one paragraph, which is what it is - the
handback's "any ordinary input clears the fact" was refuted, the fact survives blur and focus
changes, so no note says it clears.

Anchor-guarded, not SHA-pinned.

Usage: python ship_1_70_0.py <path-to-siren.html>
"""
import io, os, sys, hashlib

path = sys.argv[1]
s = io.open(path, encoding="utf-8").read()
print("input  SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d occurrence(s), found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


patch("1. version 1.69.0 -> 1.70.0",
      "const APP_VERSION = '1.69.0';",
      "const APP_VERSION = '1.70.0';")

NOTES = [
    "The tab beside Code names the editor it opens, on every kind of diagram. It used to say "
    "“Visual” on all twenty types, while the visual builder can only edit flowcharts. On the sixteen "
    "it cannot touch — pie, class, state, mindmap, timeline and the rest — the tab was greyed out, "
    "and pressing it anyway opened the builder's panel, which then explained it could make nothing "
    "here. It now reads Build where blocks work, Sequence on a "
    "sequence diagram and Guided everywhere else, and pressing it opens exactly that. The heading "
    "above the editor follows: it reads “Guided lines” when the Guided rows are what you are looking "
    "at, instead of “Mermaid source”. Each of the three also has a description of its own now; all "
    "three used to describe the visual builder, including on a sequence diagram.",

    "The window and the browser tab use the name you typed. Naming a diagram left the title still "
    "reading “Diagram 1”, because it was showing the label the app generates rather than the name "
    "you gave it. It now prefers yours, and keeps up while you are still typing it.",

    "Two new themes, and one group fewer. Wonders · Night and Wonders · Day bring the list to 39. "
    "The list is now four groups — Essentials, Office, Japan, Worlds — instead of five: “Japan "
    "Collection” is simply called Japan, so it matches the pill that jumps to it, and Signature has "
    "been folded into Worlds. The phone list is grouped the same way as the menu, which it was not. "
    "A line at the foot of the menu explains the ✦ mark: it means the theme moves gently behind the "
    "diagram.",

    "A long name in a right-click menu stays on the screen and wraps instead of being cut. The "
    "heading of one of these menus is the name of the thing the menu is about, and a name with no "
    "spaces and no hyphens in it — an underscored file name, which is what a workpaper usually is — "
    "used to hold the menu wider than a narrow window could show. On a 412-pixel-wide screen the "
    "menu hung 75 pixels off the left edge, taking the start of the name and the left edge of every "
    "row with it. The menu is now kept on screen and the name wraps onto a second line. Measured at "
    "412 and 480 pixels wide; narrower than that has not been measured.",

    "A slash you deleted can be typed again. Typing “/” in a document opens the Add block menu, and "
    "Backspace closes it and leaves the slash behind. Typing “/” a second time used to give you “//” "
    "and no menu, so the recovery the app offers could only be used once. The menu now reopens, and "
    "choosing from it uses up the slash rather than leaving a stray line behind. This is one "
    "reopening, on the paragraph it happened in.",

    "“Turn into” and “Mark as” open where you clicked. Right-clicking a block in a document and "
    "choosing one of those opened the second list at the block’s left edge — anywhere from a few "
    "pixels to 501 away from the pointer, depending on where inside the block you pressed — far "
    "enough that it read as an unrelated panel rather than an answer to what you had just chosen. "
    "Both now open at the pointer. Opening them from the keyboard or from the block’s own toolbar "
    "still puts them beside that control, which is where they belong.",

    "A menu squeezed into a very narrow window keeps its words. Between about 240 and 256 pixels "
    "wide — where a phone lands at high zoom rather than at its normal size — the Present menu’s "
    "“Export the deck as PowerPoint (.pptx)” ran past the edge and the end of the sentence was cut. "
    "Rows now wrap when the menu is squeezed. A menu that cannot fit also reports correctly that it "
    "scrolls; that report goes to screen readers, and no new scrollbar appears on screen.",
]

body = "\n".join("            '%s'%s" % (n.replace("'", "’"), "," if i < len(NOTES) - 1 else "")
                 for i, n in enumerate(NOTES))

patch("2. changelog entry for 1.70.0",
      "        {\n          version: '1.69.0',",
      "        {\n          version: '1.70.0',\n          notes: [\n" + body + "\n          ]\n        },\n"
      "        {\n          version: '1.69.0',")

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
