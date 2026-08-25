"""
The star in the theme menu says what it means.

Measured on the shipped build: 28 themes animate, and after the wonders patch all 28 carry the mark.
Nothing carries the mark without animating, so it has never over-promised. But it has never explained
itself either, and two separate things were wrong with that:

  1. NOBODY IS TOLD WHAT IT MEANS. There is no legend, no tooltip, no caption. A person scanning for
     a theme that will not move during a client call has no way to know that the absence of a small
     glyph is the answer they are looking for.

  2. IT IS INVISIBLE TO A SCREEN READER. The glyph is a CSS ::before pseudo-element, so
     `#themeMenu.innerText` contains no U+2726 anywhere - measured. It is decoration as far as
     assistive technology is concerned, which means for those users the information is not merely
     unexplained, it is absent.

Both are fixed here, and deliberately in two different ways rather than one:

  - The pseudo-element gets alt text (`content: "\\2726" / "animated"`), which is the CSS feature that
    exists precisely for a glyph carrying meaning. That closes the accessibility half at the source.
  - A legend sits at the foot of the menu, next to More themes. That closes the half that affects
    everybody, and it does not depend on the alt-text syntax being supported.

The legend is placed at the FOOT rather than the head on purpose. The menu opens showing eight
themes; a caption above them would push the first row down and spend the space the cap was built to
save. At the foot it is where somebody looks once they have started wondering.

Not done here, and it is the owner's call rather than mine: the five group names. Measured coverage
is Essentials 1 of 5 animated, Office 4 of 5, Japan Collection 8 of 8, Signature 15 of 15, Worlds
0 of 4 - so the property a person is actually choosing on cuts across every group, and "Signature"
and "Worlds" describe nothing at all. Renaming a collection is taxonomy, and a legend is the part
that is unambiguously missing.

Anchor-guarded, not SHA-pinned. Apply AFTER patch_wonders_theme.py.

Usage: python patch_theme_legend.py <path-to-siren.html>
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
    "1. the glyph gets an accessible name",
    '{\n'
    '      content: "\\2726";\n'
    '      margin-right: 6px;\n'
    '      font-size: 10px;\n'
    '      opacity: .8;\n'
    '    }',
    '{\n'
    '      /* The alt-text half of `content` is what turns a decorative glyph into one that is read\n'
    '         out. Without it #themeMenu.innerText contains no U+2726 at all, so the mark simply does\n'
    '         not exist for anyone using a screen reader. */\n'
    '      content: "\\2726" / "animated";\n'
    '      margin-right: 6px;\n'
    '      font-size: 10px;\n'
    '      opacity: .8;\n'
    '    }',
)

patch(
    "2. a legend at the foot, where somebody looks once they have started wondering",
    '<button class="theme-menu-more" id="themeMenuMoreButton" type="button" data-palette="skip" aria-expanded="false" aria-controls="themeMenu">More themes…</button>',
    '<p class="theme-menu-legend" role="presentation"><span aria-hidden="true">✦</span> moves gently behind the diagram</p>\n'
    '            <button class="theme-menu-more" id="themeMenuMoreButton" type="button" data-palette="skip" aria-expanded="false" aria-controls="themeMenu">More themes…</button>',
)

patch(
    "3. the legend looks like a caption, not a row",
    "    .theme-menu-option[aria-selected=\"true\"] .theme-option-check { opacity: 1; }",
    "    .theme-menu-option[aria-selected=\"true\"] .theme-option-check { opacity: 1; }\n"
    "\n"
    "    /* Quiet on purpose: it answers a question somebody already has, and must not compete with\n"
    "       the themes above it. The glyph is repeated here at the same size so the two read as the\n"
    "       same mark rather than as a bullet. */\n"
    "    .theme-menu-legend {\n"
    "      grid-column: 1 / -1;\n"
    "      margin: 2px 4px 0;\n"
    "      padding-top: 8px;\n"
    "      border-top: 1px solid var(--border);\n"
    "      font-size: 11px;\n"
    "      color: var(--subtle);\n"
    "    }\n"
    "    .theme-menu-legend span { font-size: 10px; opacity: .8; margin-right: 4px; }",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
