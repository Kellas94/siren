"""
The zoom control comes back to the toolbar, and the grouped button becomes what it actually holds.

Owner feedback on the grouped toolbar, and it is right: "zoom-ul trebuie inainte cum era ca e greu
sa ajungi la el". Absorbing zoom into a View menu cost two things, and only one of them was an
interaction count:

  - Zoom is not a setting you visit. It is touched constantly while working on a diagram.
  - The chip is a STATUS READOUT. It reads "100%". Behind a menu the current zoom level was not
    readable at all - measured: the chip exists, its text is right, and it is invisible.

The same report named a second symptom, "the zoom popup disappears after you click something else",
and measuring it found they are one bug. Picking "Zoom..." from the menu opened NOTHING: the row
forwards its click synchronously from inside openStructureMenu's own item handler, so #zoomPopover
opens and is closed in the same breath by the document mousedown listener receiving the very click
that summoned it. Measured before the fix: zero popovers in the DOM.

So:

  1. The zoom cluster comes back out. Chip and caret, one visual unit, as before.
  2. The flow switch stays grouped - it is disabled on most diagram types, and a menu row can say
     WHY where a greyed button cannot. But the button that holds it stops being called "View", which
     was only true while it also held zoom. It is Flow, and the menu no longer offers a heading for
     a group that is now the whole menu.
  3. Forwarding is deferred by one turn, so a forwarded control that opens something of its own is
     not killed by the click that summoned it.
  4. A disabled flow button carries its own reason, so the explanation survives even when the
     control is read outside the menu.

Kept from the grouping, because it was the part that was right: Style, Comments and Review were
always three tabs of one panel wearing three buttons. They stay behind Inspect.

Anchor-guarded, not SHA-pinned.

Usage: python patch_zoom_back.py <path-to-siren.html>
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
    "1. the zoom cluster is shown again",
    "    body[data-preview-grouped=\"on\"] .zoom-tools > .zoom-cluster,\n"
    "    body[data-preview-grouped=\"on\"] .zoom-tools > .preview-layout-switch,",
    "    /* Zoom is not grouped. It is touched constantly, and the chip is a readout as much as a\n"
    "       button - behind a menu the current zoom level could not be read at all. The flow switch\n"
    "       is a different case: it is disabled on most diagram types, and a menu row can say why\n"
    "       where a greyed button cannot. */\n"
    "    body[data-preview-grouped=\"on\"] .zoom-tools > .preview-layout-switch,",
)

patch(
    "2. the button is named for what it holds",
    "<span aria-hidden=\"true\">◉</span><span class=\"text-label\">View</span></button>",
    "<span aria-hidden=\"true\">↕</span><span class=\"text-label\">Flow</span></button>",
)

patch(
    "3. and its tooltip says the same",
    "title=\"Zoom, fit and flow direction — how you are looking at the diagram\"",
    "title=\"Which way the diagram runs — top to bottom, or left to right\"",
)

patch(
    "4. the menu holds only the direction now",
    "        const rows = previewGroupRows([\n"
    "          ['zoomChipButton', 'Fit the whole diagram'],\n"
    "          ['zoomMenuButton', 'Zoom\\u2026']\n"
    "        ]);\n"
    "        // The heading matters: without it 'Vertical' reads as a third thing to do rather than\n"
    "        // the current answer to a question the menu is already asking.\n"
    "        rows.push(['', 'Flow', 'heading']);",
    "        // Zoom and Fit left this menu when they went back on the toolbar. What remains is one\n"
    "        // two-state choice, so there is no group left to head - the button's own name says it.\n"
    "        const rows = [];",
)

patch(
    "5. the menu's accessible name follows",
    "          { plain: true, keyboard: true, role: 'menu', label: 'View' });",
    "          { plain: true, keyboard: true, role: 'menu', label: 'Flow' });",
)

patch(
    "6. a forwarded click is deferred one turn",
    "      function forwardTo(id) {\n"
    "        const target = document.getElementById(id);\n"
    "        if (target && !target.disabled) target.click();\n"
    "      }",
    "      function forwardTo(id) {\n"
    "        const target = document.getElementById(id);\n"
    "        if (!target || target.disabled) return;\n"
    "        // One turn later, not now. This runs inside the menu row's own click handler, so that\n"
    "        // click is still propagating: a forwarded control that opens a popover had it closed\n"
    "        // instantly by the same click reaching the popover's own outside-mousedown listener.\n"
    "        // Measured before this line existed: picking such a row produced nothing at all.\n"
    "        setTimeout(() => target.click(), 0);\n"
    "      }",
)

patch(
    "7. a disabled flow button carries its own reason",
    "        el.verticalLayoutButton.disabled = disabled;\n"
    "        el.horizontalLayoutButton.disabled = disabled;",
    "        el.verticalLayoutButton.disabled = disabled;\n"
    "        el.horizontalLayoutButton.disabled = disabled;\n"
    "        // The reason belongs on the control as well as on the hint beside it: a greyed button\n"
    "        // whose explanation lives in a separate element has lost it the moment the eye moves.\n"
    "        if (disabled) {\n"
    "          const why = `Vertical / horizontal applies to flowcharts \\u2014 ${type || 'this diagram type'} sets its own direction in code.`;\n"
    "          el.verticalLayoutButton.title = why;\n"
    "          el.horizontalLayoutButton.title = why;\n"
    "        } else {\n"
    "          el.verticalLayoutButton.title = 'Top-to-bottom flow \\u2014 writes TD';\n"
    "          el.horizontalLayoutButton.title = 'Left-to-right flow \\u2014 writes LR';\n"
    "        }",
)

patch(
    "8. Escape actually closes the zoom popover",
    "        el.zoomPopover.addEventListener('keydown', event => {\n"
    "          if (event.key !== 'Escape') return;\n"
    "          toggleZoomPopover(false);\n"
    "          el.zoomMenuButton.focus();\n"
    "        });",
    "        // This listener sat on the popover itself, and toggleZoomPopover never moves focus into\n"
    "        // it - so the keydown had nowhere to arrive from and Escape did nothing. Measured: the\n"
    "        // popover stayed open. The outside-mousedown handler directly below always worked\n"
    "        // because it is on the document, which is the pattern this now follows.\n"
    "        document.addEventListener('keydown', event => {\n"
    "          if (event.key !== 'Escape' || el.zoomPopover.hidden) return;\n"
    "          toggleZoomPopover(false);\n"
    "          el.zoomMenuButton.focus();\n"
    "        });",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
