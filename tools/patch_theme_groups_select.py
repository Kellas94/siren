"""
The phone's theme list is grouped the same way the desktop menu is.

MINE, AND UNSHIPPED. patch_theme_groups.py cut the theme menu from five groups to four - Essentials,
Office, Japan, Worlds - and renamed "Japan Collection" to "Japan" so the group agrees with the pill
that jumps to it. It only ever touched the quick menu.

The two <select> elements underneath it were left on the old five. Measured on the merged build:

    quick menu (desktop)   Essentials 5 | Office 5 | Japan 8 | Worlds 21
    select (phone)         Essentials 5 | Office 5 | Japan Collection 8 | Signature 17 | Worlds 4

Same thirty-nine themes, two different group schemes, and the select is not a fallback: below the
container-query breakpoint it is the only route to a theme. So a person on a phone is looking for
Wonders under "Worlds", where the desktop put it, and finds it under "Signature".

This is the same trap the Wonders patch already walked into once - the legacy selects are what
state.theme is actually read from, and a theme added to the menu alone is a theme that does not
exist. Here it is the group names rather than the themes, and the cost is only confusion rather than
a missing feature, but it is the same omission.

Signature merges INTO Worlds rather than the other way round, and in that order, so the sequence a
person sees is byte-for-byte the sequence the quick menu shows.

Anchor-guarded, not SHA-pinned.

Usage: python patch_theme_groups_select.py <path-to-siren.html>
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


# Both selects: #themePreset and #themePresetMobile.
patch("1. Japan Collection -> Japan, as on the menu and on the pill that jumps to it",
      '<optgroup label="Japan Collection">',
      '<optgroup label="Japan">', count=2)

patch("2. Signature opens the Worlds group instead of a fifth one of its own",
      '<optgroup label="Signature">',
      '<optgroup label="Worlds">', count=2)

patch("3. and the old Worlds four join the end of it rather than starting again",
      '</optgroup><optgroup label="Worlds"><option value="forest">',
      '<option value="forest">', count=2)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
