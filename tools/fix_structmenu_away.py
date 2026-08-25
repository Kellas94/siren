#!/usr/bin/env python3
# Integration fix (wave 2): openStructureMenu leaked its outside-mousedown capture
# listener whenever the menu closed programmatically (an item pick, or a re-open
# from the same anchor). The stale listener then closed the NEXT menu on the first
# mousedown inside it, so the second consecutive use of the new diagram ⋯ menu
# (Duplicate, then Rename/Remove) went dead. closeStructureMenu now owns the
# listener's removal so every open starts clean.
#
# usage: python fix_structmenu_away.py <target.html>
import io, os, sys, tempfile

def main():
    target = sys.argv[1]
    src = io.open(target, encoding='utf-8', newline='').read()
    applied = []

    def rep(name, old, new, count=1):
        nonlocal src
        found = src.count(old)
        assert found == count, (
            f"{name}: expected {count} occurrence(s) of anchor, found {found}.\n"
            f"Anchor starts: {old[:120]!r}")
        src = src.replace(old, new)
        applied.append(name)

    rep('away-close-owns-listener',
        "      let structureMenuEl = null;\n"
        "\n"
        "      function closeStructureMenu() {\n"
        "        if (structureMenuEl) { structureMenuEl.remove(); structureMenuEl = null; }\n"
        "      }",
        "      let structureMenuEl = null;\n"
        "      let structureMenuAway = null;\n"
        "\n"
        "      function closeStructureMenu() {\n"
        "        // Whoever closes the menu - an item pick, a re-open from the same\n"
        "        // anchor, or a click elsewhere - must also retire the outside-mousedown\n"
        "        // listener. Leaving it behind let a stale listener close the NEXT menu\n"
        "        // on the first mousedown inside it, so the second consecutive use of a\n"
        "        // menu went dead.\n"
        "        if (structureMenuAway) { document.removeEventListener('mousedown', structureMenuAway, true); structureMenuAway = null; }\n"
        "        if (structureMenuEl) { structureMenuEl.remove(); structureMenuEl = null; }\n"
        "      }")

    rep('away-registered-once',
        "        structureMenuEl = menu;\n"
        "        const away = event => {\n"
        "          if (menu.contains(event.target) || anchor.contains(event.target)) return;\n"
        "          closeStructureMenu();\n"
        "          document.removeEventListener('mousedown', away, true);\n"
        "        };\n"
        "        document.addEventListener('mousedown', away, true);",
        "        structureMenuEl = menu;\n"
        "        const away = event => {\n"
        "          if (menu.contains(event.target) || anchor.contains(event.target)) return;\n"
        "          closeStructureMenu();\n"
        "        };\n"
        "        structureMenuAway = away;\n"
        "        document.addEventListener('mousedown', away, true);")

    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(target)), suffix='.tmp')
    with io.open(fd, 'w', encoding='utf-8', newline='') as fh:
        fh.write(src)
    os.replace(tmp, target)
    print(f"applied {len(applied)}:")
    for name in applied:
        print("  - " + name)

if __name__ == '__main__':
    main()
