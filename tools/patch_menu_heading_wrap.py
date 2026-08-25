"""
A context menu stops cutting the name of the thing it is about.

FOUND BY VERIFICATION, PRE-EXISTING - identical on the round 10 build and on the shipped 1.69.0, so
this is not a regression from anybody's patch. It is silent text loss at ordinary phone widths.

Every context menu that is about a named thing puts that name in its heading: the document register,
the diagram tab menu, the board card menu, the folder-choice menu ("Move <name> to"), the Docs page
menu, the presentation menu - eight places build a heading out of a string a person typed.

.struct-menu is display:grid. .struct-menu-heading sets no min-width, no overflow-wrap and no
white-space override, so a grid item's automatic minimum size is its min-content width. One
unbreakable token - which is exactly what an underscored workpaper filename is - pins the single
grid track at whatever that token measures, and the menu is then clamped to the viewport with
overflow hidden. Measured with a diagram renamed through the app's own Rename dialog to
2026_Q3_Revenue_Recognition_Walkthrough_Workpaper_FINAL_v2:

    412px (Pixel)   heading runs 67.5px past the clip edge, one line, no wrap
    375px (iPhone)  104.5px past
    320px           159.5px past

No scrollbar, no ellipsis, nothing that tells the person the name they are reading is not the whole
name. On a rename or a "Move X to" menu, a truncated name is not cosmetic: it is the identity of the
thing the menu is about to act on.

Round 10's AU work released .struct-menu-item to wrap when the menu is squeezed. It never touched
.struct-menu-heading, and because the heading pins the track, every row falls back to one line
anyway - so the wrapping that patch bought was fully defeated by the heading above it.

Two declarations fix the class rather than the one menu:

    min-width: 0          removes the grid item's automatic min-content floor, so the track
                          may shrink below the width of an unbreakable token
    overflow-wrap: anywhere   lets the token break, and - unlike break-word - is counted in the
                          min-content size, which is what makes the track actually give way

Ordinary spaced titles were already wrapping cleanly and are unaffected; this only changes what
happens to a run with no space and no hyphen in it.

Anchor-guarded, not SHA-pinned.

Usage: python patch_menu_heading_wrap.py <path-to-siren.html>
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


patch(
    "1. the heading may shrink and may break, so a long name wraps instead of being cut",

    "    .struct-menu-heading {\n"
    "      padding: 8px 10px 3px;\n",

    "    .struct-menu-heading {\n"
    "      /* These menus name the thing they are about, and that name is whatever somebody typed.\n"
    "         In a grid the heading's min-content width is the track's floor, so one unbreakable\n"
    "         token - an underscored filename - held the menu wider than a phone and the name was\n"
    "         cut with no scrollbar and no ellipsis. min-width removes the floor; overflow-wrap\n"
    "         'anywhere' rather than 'break-word' because only 'anywhere' counts in min-content. */\n"
    "      min-width: 0;\n"
    "      overflow-wrap: anywhere;\n"
    "      padding: 8px 10px 3px;\n",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
