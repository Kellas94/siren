"""
Cap the theme quick menu at eight, and give the other twenty-nine a door at the foot.

Measured on this base before touching it (probe_theme_menu.js, 1440x900):
  37 themes, all 37 rows in one open menu, 5 groups (Essentials 5, Office 5,
  Japan Collection 8, Signature 15, Worlds 4). The open menu measures 520x800 with a
  scrollHeight of 1061, so 261px - roughly six rows - are already below the fold, and
  the app has grown a sticky jump rail to compensate for a list that does not fit.

The eight kept in front are the app's own two work groups (Essentials + Office = 10)
minus the three static darks that are measurably redundant with Dark - Navy 0.009,
Slate 0.011 and Solarized 0.020 canvas luminance against Dark's 0.006, all four static,
all four in the same band - plus Art Deco, which is the one produced theme the source
already hand-patches FOR THIS MENU (see body[data-theme="artdeco"] #themeMenu) and the
only representative in front of the cap of the twenty-seven themes the picker marks
with an animation glyph.

  dark  light  oled  kpmg  cupertino  paper  blueprint  artdeco

Nothing is deleted. All thirty-seven option buttons stay in the DOM with their ids
unchanged, so the command palette still harvests every theme and a thirty-eighth theme
lands behind the cap by default rather than in front of it - which was the point.

NOT pinned to an input SHA: this base moves. The anchor count assertions are the guard.

Usage: python patch_theme_menu.py <path-to-siren.html>
"""
import io, os, sys, hashlib

path = sys.argv[1]
s = io.open(path, encoding="utf-8").read()
before = hashlib.sha256(s.encode("utf-8")).hexdigest().upper()
print("input  SHA-256 %s" % before)
print("input  bytes   %d" % len(s.encode("utf-8")))


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d occurrence(s) of the anchor, found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


# ---------------------------------------------------------------- 1. mark the eight
# The bare attribute is NOT an anchor: data-theme-value="oled" also appears in the CSS
# that prefixes an animation glyph to the marked themes, so oled, cupertino, paper,
# blueprint and artdeco each match twice. role="option" ... aria-selected="false" is
# what makes each one occur exactly once.
QUICK_EIGHT = [
    ("dark",      "the boot default - applyTheme falls back to it - and one of only nine static themes"),
    ("light",     "the ONLY static light theme: every other light theme reports data-ambient=on"),
    ("oled",      "contrast 19.63:1, second highest of 37; this IS the high-contrast option"),
    ("kpmg",      "the one brand theme, canvas luminance 1.000, appearance bar lives in this menu"),
    ("cupertino", "the other theme whose appearance bar lives in this menu; day/night x blue/green"),
    ("paper",     "luminance 0.959 - the document look, the one to export and print from"),
    ("blueprint", "the dark member of the Office group, luminance 0.025"),
    ("artdeco",   "the one produced theme in front of the cap; the source already special-cases it here"),
]
for theme, why in QUICK_EIGHT:
    patch(
        "1.%-9s quick  (%s)" % (theme, why),
        'role="option" data-theme-value="%s" aria-selected="false"' % theme,
        'role="option" data-theme-quick data-theme-value="%s" aria-selected="false"' % theme,
    )

# ---------------------------------------------------------------- 2. the menu starts capped
# data-mode lives in the markup, not only in JS, so the very first paint of the menu is
# already eight rows. If the script that sets it never runs, the menu is still capped
# rather than briefly flashing all thirty-seven.
patch(
    "2. #themeMenu opens in quick mode",
    '<div class="theme-menu" id="themeMenu" role="listbox" aria-label="Choose theme" hidden>',
    '<div class="theme-menu" id="themeMenu" role="listbox" aria-label="Choose theme" data-mode="quick" hidden>',
)

# ---------------------------------------------------------------- 3. the door to the rest
# It goes in the sticky rail, not at the bottom of the list. The rail is the one part of
# this menu that stays on screen while the list scrolls, so "the other 29" is one click
# away from anywhere. data-palette="skip" keeps the command palette from harvesting it as
# a theme; the palette already offers all 37 themes by name.
patch(
    "3. add the More themes button at the foot of the menu",
    '            <label class="theme-menu-soft">',
    '            <!-- The cap needs a door. It sits at the FOOT, after the eight: read top to\n'
    '                 bottom, a door placed first offers the rest before you have seen what you\n'
    '                 have. It is also the last Tab stop before the soften toggle, for free -\n'
    '                 querySelectorAll returns document order, so moving it here moves it in the\n'
    '                 keyboard walk too, with no change to the tab logic. -->\n'
    '            <button class="theme-menu-more" id="themeMenuMoreButton" type="button" data-palette="skip" aria-expanded="false" aria-controls="themeMenu">More themes…</button>\n'
    '            <label class="theme-menu-soft">',
)

# ---------------------------------------------------------------- 4. the quick-mode CSS
patch(
    "4. quick-mode display rules",
    '.theme-menu-option[aria-selected="true"] .theme-option-check { opacity: 1; }',
    '.theme-menu-option[aria-selected="true"] .theme-option-check { opacity: 1; }\n'
    '\n'
    '    /* ---- the quick menu cap -------------------------------------------------------\n'
    '       Eight themes in front, the rest one click behind the rail\'s More themes button.\n'
    '       Hiding is a display rule and nothing is removed from the DOM: the command palette\n'
    '       still finds all thirty-seven by name, every option keeps its unique\n'
    '       data-theme-value, and a thirty-eighth theme is behind the cap the moment it is\n'
    '       added because it will not carry data-theme-quick. */\n'
    '    /* At the foot it is a row, not a pill: full width, so it reads as the end of the\n'
    '       list rather than another chip floating beside the group jumps. */\n'
    '    .theme-menu-more {\n'
    '      display: block;\n'
    '      width: 100%;\n'
    '      margin: 8px 0 2px;\n'
    '      text-align: left;\n'
    '      padding: 7px 11px;\n'
    '      border: 1px solid var(--border-strong);\n'
    '      border-radius: 9px;\n'
    '      background: var(--panel-alt);\n'
    '      color: var(--text);\n'
    '      font-size: 11px;\n'
    '      font-weight: 750;\n'
    '      letter-spacing: .05em;\n'
    '      cursor: pointer;\n'
    '    }\n'
    '    .theme-menu-more:hover,\n'
    '    .theme-menu-more:focus-visible { border-color: var(--primary); color: var(--text); }\n'
    '    .theme-menu[data-mode="quick"] .theme-menu-option:not([data-theme-quick]) { display: none; }\n'
    '    /* Eight rows read as a list, so no group headings and one column. In two columns the\n'
    '       eight arrive as 2+1, 2+2, 1 across three separate grids - a ragged block, not a menu. */\n'
    '    .theme-menu[data-mode="quick"] .theme-menu-group-label { display: none; }\n'
    '    .theme-menu[data-mode="quick"] .theme-menu-group { grid-template-columns: 1fr; }\n'
    '    /* A group whose every option is hidden must stop drawing its divider, or the capped\n'
    '       menu grows three rules across empty space where Japan and Worlds used to be. */\n'
    '    .theme-menu[data-mode="quick"] .theme-menu-group + .theme-menu-group {\n'
    '      margin-top: 0;\n'
    '      padding-top: 0;\n'
    '      border-top: none;\n'
    '    }\n'
    '    /* The group jumps are a map of a list that is not on screen in quick mode. */\n'
    '    .theme-menu[data-mode="quick"] .theme-menu-jump { display: none; }',
)

# ---------------------------------------------------------------- 5. cache the new button
patch(
    "5. cache #themeMenuMoreButton",
    "'headerThemeControl','themeMenuButton','themeMenuLabel','themeMenu','ambientSoftToggle',",
    "'headerThemeControl','themeMenuButton','themeMenuLabel','themeMenu','themeMenuMoreButton','ambientSoftToggle',",
)

# ---------------------------------------------------------------- 6. the mode helpers
# themeMenuOptions() keeps returning ALL of them: syncThemeMenu has to set aria-selected
# and the button label from the full list whether or not the chosen theme is one of the
# eight. Keyboard navigation gets its own filtered list below.
patch(
    "6. add the quick-menu helpers",
    "      function themeMenuOptions() {\n"
    "        return el.themeMenu ? Array.from(el.themeMenu.querySelectorAll('.theme-menu-option[data-theme-value]')) : [];\n"
    "      }",
    "      function themeMenuOptions() {\n"
    "        return el.themeMenu ? Array.from(el.themeMenu.querySelectorAll('.theme-menu-option[data-theme-value]')) : [];\n"
    "      }\n"
    "\n"
    "      /* The rows the arrows and the roving tabindex are allowed to land on. In quick mode\n"
    "         the other twenty-nine are display:none, and a row that cannot be seen must not be\n"
    "         a keyboard stop or Tab walks into nothing. offsetParent is null for exactly those\n"
    "         - and for every row while the menu is closed, which is why the full list is the\n"
    "         fallback rather than an empty array. */\n"
    "      function themeMenuNavOptions() {\n"
    "        const all = themeMenuOptions();\n"
    "        const shown = all.filter(option => option.offsetParent !== null);\n"
    "        return shown.length ? shown : all;\n"
    "      }\n"
    "\n"
    "      function themeMenuIsExpanded() {\n"
    "        return el.themeMenu?.dataset.mode === 'all';\n"
    "      }\n"
    "\n"
    "      function setThemeMenuExpanded(expanded) {\n"
    "        if (!el.themeMenu) return;\n"
    "        el.themeMenu.dataset.mode = expanded ? 'all' : 'quick';\n"
    "        if (el.themeMenuMoreButton) {\n"
    "          const options = themeMenuOptions();\n"
    "          // Counted from the DOM, never from a literal: add a theme and this is right.\n"
    "          const rest = options.length - options.filter(option => option.hasAttribute('data-theme-quick')).length;\n"
    "          el.themeMenuMoreButton.textContent = expanded ? 'Show fewer' : `More themes\\u2026 (${rest})`;\n"
    "          el.themeMenuMoreButton.setAttribute('aria-expanded', String(expanded));\n"
    "        }\n"
    "        // Quick is one narrow column, the full list is two wide ones, so the box has to be\n"
    "        // re-measured rather than left at whichever width it happened to open with.\n"
    "        positionThemeMenu();\n"
    "      }\n"
    "\n"
    "      /* Open on the list that contains the current theme. Someone sitting on Ukiyo-e who\n"
    "         opens a menu of eight with no tick anywhere in it has been told their theme is\n"
    "         gone. */\n"
    "      function themeMenuShouldExpandForActive() {\n"
    "        const active = themeMenuOptions().find(option => option.dataset.themeValue === state.theme);\n"
    "        return Boolean(active && !active.hasAttribute('data-theme-quick'));\n"
    "      }",
)

# ---------------------------------------------------------------- 7. width follows the mode
patch(
    "7. narrow the box in quick mode",
    "        const width = Math.min(520, Math.max(220, viewportWidth - margin * 2));",
    "        // 520 fits two whole theme names side by side; the capped list is eight rows in\n"
    "        // one column and 520 of width for one column of eight is a wall with a list in it.\n"
    "        const widthCap = el.themeMenu.dataset.mode === 'all' ? 520 : 312;\n"
    "        const width = Math.min(widthCap, Math.max(220, viewportWidth - margin * 2));",
)

# ---------------------------------------------------------------- 8. choose the mode on open
patch(
    "8. pick the mode when the menu opens",
    "        if (next) {\n"
    "          positionThemeMenu();",
    "        if (next) {\n"
    "          setThemeMenuExpanded(themeMenuShouldExpandForActive());\n"
    "          positionThemeMenu();",
)

# ---------------------------------------------------------------- 9. keyboard uses the shown rows
patch(
    "9a. focus-on-open lands on a visible row",
    "              const selected = themeMenuOptions().find(option => option.getAttribute('aria-selected') === 'true');\n"
    "              (selected || themeMenuOptions()[0])?.focus({ preventScroll: true });",
    "              const navOptions = themeMenuNavOptions();\n"
    "              const selected = navOptions.find(option => option.getAttribute('aria-selected') === 'true');\n"
    "              (selected || navOptions[0])?.focus({ preventScroll: true });",
)

patch(
    "9b. arrow-from-the-button walks the shown rows",
    "        setThemeMenuOpen(true, false);\n"
    "        const options = themeMenuOptions();",
    "        setThemeMenuOpen(true, false);\n"
    "        const options = themeMenuNavOptions();",
)

patch(
    "9c. arrows inside the menu walk the shown rows",
    "      function handleThemeMenuKeydown(event) {\n"
    "        const options = themeMenuOptions();",
    "      function handleThemeMenuKeydown(event) {\n"
    "        const options = themeMenuNavOptions();",
)

patch(
    "9d. Tab reaches More themes and skips the hidden pills",
    "          const jumps = Array.from(el.themeMenu.querySelectorAll('.theme-menu-jump'));",
    "          // The More button is a Tab stop; the group jumps are display:none in quick mode\n"
    "          // and an invisible pill must not swallow a Tab press.\n"
    "          const jumps = Array.from(el.themeMenu.querySelectorAll('.theme-menu-more, .theme-menu-jump'))\n"
    "            .filter(stop => stop.offsetParent !== null);",
)

# ---------------------------------------------------------------- 10. the click handler
patch(
    "10. handle the More themes click",
    "      function handleThemeMenuClick(event) {\n"
    "        const jump = event.target.closest('.theme-menu-jump');",
    "      function handleThemeMenuClick(event) {\n"
    "        if (event.target.closest('#themeMenuMoreButton')) {\n"
    "          const expanding = !themeMenuIsExpanded();\n"
    "          setThemeMenuExpanded(expanding);\n"
    "          // Expanding drops twenty-nine rows in below the fold; collapsing can leave the\n"
    "          // scroll position past the end of a much shorter list. Either way, go to the top.\n"
    "          el.themeMenu.scrollTop = 0;\n"
    "          return;\n"
    "        }\n"
    "        const jump = event.target.closest('.theme-menu-jump');",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
after = hashlib.sha256(s.encode("utf-8")).hexdigest().upper()
print("output SHA-256 %s" % after)
print("output bytes   %d" % len(s.encode("utf-8")))
