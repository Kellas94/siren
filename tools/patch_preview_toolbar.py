"""
Group the preview toolbar: twelve permanent controls become four.

Measured at 1440x900 with nothing open, the preview toolbar carries twelve controls against the
outside review's threshold of seven. They do four different jobs, and three of them - Style,
Comments and Review - were always three tabs of one panel wearing three buttons.

  View     absorbs zoom, the zoom menu, and the vertical/horizontal layout switch.
           All four answer one question: how am I looking at this. None changes the diagram.
  Inspect  absorbs Style, Comments and Review.
  Filters  stays. It changes what the drawing SHOWS, which is a different verb.
  Present  stays, with its own menu, unchanged.

NOTHING IS REMOVED. Every absorbed control keeps its id, its handler and its place in the DOM; it
is only hidden, and each menu row forwards a click to the original button. That is the same rule
that made the theme-menu cap safe - a cap on what is shown, not a cut of what exists - and it means
the command palette, the keyboard paths and every existing test still reach all twelve.

Reuses openStructureMenu, which is how the workspace bar already folds four selects into one menu.
No new menu machinery.

Deliberately NOT done here, and each for a reason:
  - "Hide panel" should move onto the divider it moves, which is a drag/double-click interaction
    rather than a button, and that is a separate piece of work.
  - The three walk-through controls should fold into Present, but they are a group of three with
    their own disabled-state logic; folding them is not a wrapping job.

Anchor-guarded, not SHA-pinned.

Usage: python patch_preview_toolbar.py <path-to-siren.html>
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


# ---------------------------------------------------------------- 1. the two grouped buttons
patch(
    "1. add the View and Inspect buttons",
    '            <div class="present-cluster" role="group" aria-label="Present">',
    '            <button class="btn ghost compact" id="previewViewButton" type="button" data-palette="skip"\n'
    '                    aria-haspopup="true" aria-expanded="false"\n'
    '                    title="Zoom, fit and flow direction — how you are looking at the diagram">'
    '<span aria-hidden="true">◉</span><span class="btn-label">View</span></button>\n'
    '            <button class="btn ghost compact" id="previewInspectButton" type="button" data-palette="skip"\n'
    '                    aria-haspopup="true" aria-expanded="false"\n'
    '                    title="Style, comments and review for this diagram">'
    '<span aria-hidden="true">⚙</span><span class="btn-label">Inspect</span></button>\n'
    '            <div class="present-cluster" role="group" aria-label="Present">',
)

# ---------------------------------------------------------------- 2. hide what they absorb
patch(
    "2. hide the absorbed controls",
    "    .theme-menu-option[aria-selected=\"true\"] .theme-option-check { opacity: 1; }",
    "    .theme-menu-option[aria-selected=\"true\"] .theme-option-check { opacity: 1; }\n"
    "\n"
    "    /* ---- the grouped preview toolbar -------------------------------------------------\n"
    "       Twelve controls became four. The absorbed ones are HIDDEN, never removed: they keep\n"
    "       their ids, their handlers and their DOM position, so the command palette, the\n"
    "       keyboard paths and the existing tests all still reach them, and each menu row simply\n"
    "       forwards a click to the original button. Removing them would have been a smaller\n"
    "       patch and a much larger promise. */\n"
    "    body[data-preview-grouped=\"on\"] .zoom-tools > .zoom-cluster,\n"
    "    body[data-preview-grouped=\"on\"] .zoom-tools > .preview-layout-switch,\n"
    "    body[data-preview-grouped=\"on\"] .pane-actions > #styleShortcutButton,\n"
    "    body[data-preview-grouped=\"on\"] .pane-actions > #commentsButton,\n"
    "    body[data-preview-grouped=\"on\"] .pane-actions > #reviewButton { display: none; }\n"
    "    /* The grouped buttons only exist in grouped mode, so the ungrouped layout is untouched\n"
    "       and this whole change is one attribute away from being off. */\n"
    "    body:not([data-preview-grouped=\"on\"]) #previewViewButton,\n"
    "    body:not([data-preview-grouped=\"on\"]) #previewInspectButton { display: none; }",
)

# ---------------------------------------------------------------- 3. cache the new ids
patch(
    "3. register the two buttons",
    "'zoomChipButton','zoomMenuButton',",
    "'zoomChipButton','zoomMenuButton','previewViewButton','previewInspectButton',",
)

# ---------------------------------------------------------------- 4. the menus
patch(
    "4. open a menu that forwards to the original controls",
    "      function openStructureMenu(anchor, options, current, onPick, config = null) {",
    "      /* Each row forwards to the button it replaced. No handler is duplicated and no logic\n"
    "         moves, so a control cannot drift out of step with the row that now opens it. A row\n"
    "         whose target is missing or disabled is offered as disabled rather than silently\n"
    "         doing nothing. */\n"
    "      function forwardTo(id) {\n"
    "        const target = document.getElementById(id);\n"
    "        if (target && !target.disabled) target.click();\n"
    "      }\n"
    "\n"
    "      function previewGroupRows(spec) {\n"
    "        return spec.map(([id, label]) => {\n"
    "          const target = document.getElementById(id);\n"
    "          return [id, label, !target || target.disabled];\n"
    "        });\n"
    "      }\n"
    "\n"
    "      function openPreviewViewMenu(anchor) {\n"
    "        const vertical = document.getElementById('verticalLayoutButton');\n"
    "        const on = vertical && vertical.getAttribute('aria-pressed') === 'true';\n"
    "        openStructureMenu(anchor, previewGroupRows([\n"
    "          ['zoomChipButton', 'Fit the whole diagram'],\n"
    "          ['zoomMenuButton', 'Zoom\\u2026'],\n"
    "          ['verticalLayoutButton', (on ? '\\u2713 ' : '\\u2007\\u2007') + 'Vertical flow'],\n"
    "          ['horizontalLayoutButton', (on ? '\\u2007\\u2007' : '\\u2713 ') + 'Horizontal flow']\n"
    "        ]), '', forwardTo, { plain: true, keyboard: true, role: 'menu', label: 'View' });\n"
    "      }\n"
    "\n"
    "      function openPreviewInspectMenu(anchor) {\n"
    "        openStructureMenu(anchor, previewGroupRows([\n"
    "          ['styleShortcutButton', 'Style \\u00b7 fonts, colours, legend'],\n"
    "          ['commentsButton', 'Comments'],\n"
    "          ['reviewButton', 'Review status and audit trail']\n"
    "        ]), '', forwardTo, { plain: true, keyboard: true, role: 'menu', label: 'Inspect' });\n"
    "      }\n"
    "\n"
    "      function openStructureMenu(anchor, options, current, onPick, config = null) {",
)

# ---------------------------------------------------------------- 5. wire them, and turn it on
patch(
    "5. wire the buttons and enable grouped mode",
    "        if (el.themeMenuButton) {",
    "        if (el.previewViewButton) {\n"
    "          el.previewViewButton.addEventListener('click', () => openPreviewViewMenu(el.previewViewButton));\n"
    "        }\n"
    "        if (el.previewInspectButton) {\n"
    "          el.previewInspectButton.addEventListener('click', () => openPreviewInspectMenu(el.previewInspectButton));\n"
    "        }\n"
    "        document.body.dataset.previewGrouped = 'on';\n"
    "\n"
    "        if (el.themeMenuButton) {",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
