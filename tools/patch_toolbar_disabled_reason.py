"""
A greyed-out row in the View menu must say why it is greyed out.

Found by looking at a screenshot rather than at code: on a mindmap the app disables the
vertical/horizontal switch and explains itself through #orientationHint - "Vertical / horizontal
applies to flowcharts, mindmap sets its own direction in code." Once those two buttons moved into
the View menu, the row went grey and the sentence stayed behind on a hint attached to a control that
is no longer on screen.

openStructureMenu already supports the honest version: a third tuple entry that is a STRING both
disables the row and becomes its tooltip, which is the pattern the rest of the app uses for
unavailable actions. previewGroupRows was handing it a bare `true`, so it took the silent branch.

The reason is not re-worded here. It is read from the app's own hint, so the menu cannot drift out
of step with it - there is one sentence, in one place, and both surfaces show it.

Anchor-guarded, not SHA-pinned. Apply AFTER patch_preview_toolbar.py.

Usage: python patch_toolbar_disabled_reason.py <path-to-siren.html>
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
    "1. a disabled row carries the app's own explanation",
    "      function previewGroupRows(spec) {\n"
    "        return spec.map(([id, label]) => {\n"
    "          const target = document.getElementById(id);\n"
    "          return [id, label, !target || target.disabled];\n"
    "        });\n"
    "      }",
    "      function previewGroupRows(spec) {\n"
    "        return spec.map(([id, label, reason]) => {\n"
    "          const target = document.getElementById(id);\n"
    "          if (target && !target.disabled) return [id, label, false];\n"
    "          // A string here both disables the row and becomes its tooltip - the app's existing\n"
    "          // way of saying an action exists but is not available now. A bare `true` greys the\n"
    "          // row and explains nothing, which is how a control loses its reason when it moves\n"
    "          // into a menu and leaves its hint behind on the surface it came from.\n"
    "          const why = typeof reason === 'function' ? reason() : reason;\n"
    "          return [id, label, why || 'Not available for this diagram type.'];\n"
    "        });\n"
    "      }",
)

patch(
    "2. the flow rows borrow the orientation hint's own sentence",
    "        rows.push.apply(rows, previewGroupRows([\n"
    "          ['verticalLayoutButton', 'Vertical'],\n"
    "          ['horizontalLayoutButton', 'Horizontal']\n"
    "        ]));",
    "        // Read, never re-worded: syncLayoutOrientationControl keeps this sentence current and\n"
    "        // names the actual diagram type, so the menu says exactly what the hint says.\n"
    "        const flowWhy = () => {\n"
    "          const hint = document.getElementById('orientationHint');\n"
    "          return hint ? (hint.title || hint.textContent || '') : '';\n"
    "        };\n"
    "        rows.push.apply(rows, previewGroupRows([\n"
    "          ['verticalLayoutButton', 'Vertical', flowWhy],\n"
    "          ['horizontalLayoutButton', 'Horizontal', flowWhy]\n"
    "        ]));",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
