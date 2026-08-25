"""
Four theme groups, each named for what it is.

Measured composition before this change:

    Essentials          5 themes,  1 animates
    Office              5 themes,  4 animate
    Japan Collection    8 themes,  8 animate
    Signature          17 themes, 17 animate
    Worlds              4 themes,  0 animate

Two problems, and they are the same problem.

The names are almost swapped. "Signature" holds Wasteland Terminal, Sol Observatory, Space Race,
Abyss, Hero's Grove, Grand Hotel and Nosferatu - those ARE worlds, each one a place with weather.
"Worlds" holds four colour schemes named after places, none of which move. The smaller group carries
the name that fits the larger one.

And what actually separates them is motion: 17 against 0. But motion is already marked on every
single row with a star, and explained by a legend at the foot of the menu. Two groups that differ
only by something written on each row ask a person to learn a taxonomy that duplicates a glyph.

So they merge, under the name that was already sitting on the smaller half. Twenty-one in one group
is not the problem it would be in a flat list: the menu shows eight and offers the rest behind "More
themes", and it carries jump pills. The alternative was a group of four nobody could distinguish
from a group of seventeen.

"Japan Collection" loses its second word for the same reason the others changed - the jump pill
already says "Japan", and a group label that disagrees with its own pill is a small dishonesty of the
kind this project keeps finding.

WHAT IS DELIBERATELY NOT DONE: a "Calm" filter for the nine themes that do not move. It would help
somebody choosing a theme before a client call, but it is new machinery rather than a renaming, and
it should be judged after this settles rather than bundled with it.

WHAT IS LOST, said plainly: "Signature" meant "ours, the ones we are proud of". That is the maker's
frame, not the chooser's - somebody opening this menu is deciding how their diagram should look, not
which themes the author signed. If that idea is worth keeping it belongs somewhere it means
something, not on a group of seventeen that says only "the rest".

Anchor-guarded, not SHA-pinned. Apply AFTER patch_wonders_theme.py.

Usage: python patch_theme_groups.py <path-to-siren.html>
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


# ---------------------------------------------------------------- 1. Japan matches its own pill
patch(
    "1. the Japan group agrees with the pill that jumps to it",
    '<span class="theme-menu-group-label">Japan Collection</span>',
    '<span class="theme-menu-group-label">Japan</span>',
)

patch(
    "2. and so does its jump target",
    'aria-label="Japan Collection themes"',
    'aria-label="Japan themes"',
)

patch(
    "3. the pill points at the renamed group",
    'data-jump-group="Japan Collection themes"',
    'data-jump-group="Japan themes"',
)

# ---------------------------------------------------------------- 2. Signature becomes Worlds
patch(
    "4. Signature is renamed to what its themes actually are",
    '<span class="theme-menu-group-label">Signature</span>',
    '<span class="theme-menu-group-label">Worlds</span>',
)

patch(
    "5. its group label follows",
    'aria-label="Signature themes"',
    'aria-label="Worlds themes"',
)

patch(
    "6. and its pill",
    '<button class="theme-menu-jump" type="button" data-jump-group="Signature themes">Signature</button>',
    '<button class="theme-menu-jump" type="button" data-jump-group="Worlds themes">Worlds</button>',
)

# ---------------------------------------------------------------- 3. the old Worlds folds in
# The four static ones join the group rather than sitting in a second one that differs only by
# whether its themes move - which every row already says for itself.
patch(
    "7. the four static worlds join it, and the second group and its pill go",
    '            </div>\n'
    '            <div class="theme-menu-group" role="group" aria-label="Worlds themes">\n'
    '              <span class="theme-menu-group-label">Worlds</span>\n'
    '              <button class="theme-menu-option" type="button" role="option" data-theme-value="forest"',
    '              <button class="theme-menu-option" type="button" role="option" data-theme-value="forest"',
)

patch(
    "8. the pill that pointed at the folded group is retired",
    '<button class="theme-menu-jump" type="button" data-jump-group="Worlds themes">Worlds</button>\n'
    '              <button class="theme-menu-jump" type="button" data-jump-group="Worlds themes">Worlds</button>',
    '<button class="theme-menu-jump" type="button" data-jump-group="Worlds themes">Worlds</button>',
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
