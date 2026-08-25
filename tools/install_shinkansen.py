# -*- coding: utf-8 -*-
"""
SHINKANSEN - one installer for the whole theme.

    python install_shinkansen.py <target.html>

Applies, in a single anchor-guarded pass, all three engineers' deliverables:

  A. PALETTE   - the [data-theme="shinkansen"] token block, six scoped surface
                 rules, the Mermaid preset, the ambient veil tokens and every
                 registration list (menu, both native selects, the light-theme
                 form-control lists, the marker glyph, the option count).
  B. SCENE     - AMBIENT_SCENES.shinkansen, spliced between koi and aurora so
                 the Japan Collection stays contiguous in source.
  C. INTRO     - the intro stylesheet, the overlay markup, the element-id
                 registration, the themeIntroTimers slot and the
                 themeIntroOverlayFor "own" map entry.

Every anchor is asserted with an exact occurrence count BEFORE anything is
written; if a single one drifts, nothing is written at all. Re-running on an
already-patched file is refused, so the script is idempotent.

The source app is never written to - patch a copy.
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = 'shinkansen'

SCENE_FILE = os.path.join(HERE, 'scene_shinkansen.js')
INTRO_HTML = os.path.join(HERE, 'intro_shinkansen.html')
INTRO_CSS = os.path.join(HERE, 'intro_shinkansen.css')


def read_lf(path):
    """Read a deliverable and normalise it to the app's LF-only convention."""
    txt = io.open(path, encoding='utf-8', newline='').read()
    return txt.replace('\r\n', '\n').replace('\r', '\n')


# ==========================================================================
# A.  PALETTE
# ==========================================================================
A_TOKENS_ANCHOR = """        linear-gradient(180deg, #ebe8dc, #e6e1d1);
    }

    [data-theme="koi"] {"""

A_TOKENS = """        linear-gradient(180deg, #ebe8dc, #e6e1d1);
    }

    /* Shinkansen - a platform under a pale overcast sky. Pearl-white livery and the
       greys of painted steel and poured concrete carry the grounds; JR blue is the
       one structural colour; the safety yellow of the tactile paving is the single
       precious accent and is rationed like the warning it is. Status comes off the
       signal head rather than a generic green/amber/red: proceed, caution, stop. */
    [data-theme="shinkansen"] {
      color-scheme: light;
      --canvas-bg: #f7f9fb;
      --app-bg: #e4e9ee;
      --panel-bg: #f7f9fb;
      --panel-alt: #e8edf2;
      --panel-elevated: #fdfeff;
      --sidebar-start: #f7f9fb;
      --sidebar-end: #dfe6ed;
      --input-bg: #fdfeff;
      --text: #16202b;
      --muted: #4a5765;
      --subtle: #55636f;
      --border: #ccd5dd;
      --border-strong: #697682;
      --field-border: #6d7b88;
      --primary: #0f4c96;
      --primary-hover: #0b3c78;
      --primary-text: #f4f8ff;
      --secondary: #e3e9f0;
      --secondary-hover: #d3dce6;
      --secondary-text: #202b36;
      --danger: #a4262c;
      --danger-strong: #8a1b21;
      --danger-bg: #f8e3e2;
      --success: #146b43;
      --success-bg: #dcefe3;
      --warning: #8f4d07;
      --warning-bg: #f6e9c9;
      --focus-ring: #0f4c96;
      --code-text: #35404b;
      --pill-text: #0d3d78;
      --pill-bg: #dce6f2;
      --code-bg: #eef2f6;
      --deco-gold: #755500;
      --shadow: 0 18px 50px rgba(24, 38, 54, .14);
      --shadow-soft: 0 8px 24px rgba(24, 38, 54, .09);
      --node-fill: #fdfeff;
      --node-text: #16202b;
      --node-border: #2b4a72;
      --node-accent: #dbe6f4;
      --node-accent-border: #0f4c96;
      --line-color: #4c5a67;
      --edge-label-bg: #e8eef4;
      /* The tactile paving as paint rather than ink. --deco-gold above is the same
         yellow taken down until it is legible type; this is the line itself, and it
         is allowed on exactly one edge in the whole application. */
      --sk-safety: #f0bf00;
    }

    /* Shinkansen surface, two motifs and no more.

       ONE - THE ENAMEL SIGNBOARD. The header is a station nameplate: a wiped white
       enamel plate, the line-colour band across the foot of the plate, and then the
       platform edge itself - the yellow tactile line - as the last three pixels. That
       line is the only bright yellow in the application. The band sits at 6..4px from
       the foot rather than higher up: measured on the real header (72px, 3px border),
       anything above 7px runs straight under the baseline of .brand-version and reads
       as an underline on the version string. Down here the blue and the yellow read as
       one pair - line colour over platform edge - and the type is clear of both.

       TWO - THE PLATFORM. Poured concrete on a 128px slab module with the raised studs
       of a tactile warning tile pressed into it: a highlight above each stud and a
       shadow below, so they read as domes rather than as graph paper. It goes on the
       three surfaces where ground is actually visible. Note that body is NOT one of
       them: .app paints --app-bg opaquely over the whole viewport, so a body texture
       would never render a pixel.

       The preview card is the other material - pearl-white painted steel, brushed
       lengthwise - and it stays that quiet because diagrams have to sit on it. */
    [data-theme="shinkansen"] .app-header {
      background-image:
        linear-gradient(180deg, rgba(15, 76, 150, 0) calc(100% - 6px), rgba(15, 76, 150, .92) calc(100% - 6px), rgba(15, 76, 150, .92) calc(100% - 4px), rgba(15, 76, 150, 0) calc(100% - 4px)),
        linear-gradient(180deg, rgba(255, 255, 255, .95) 0%, rgba(255, 255, 255, .12) 44%, rgba(15, 76, 150, .05) 100%),
        linear-gradient(180deg, var(--panel-bg), var(--panel-alt));
      border-bottom: 3px solid var(--sk-safety, #f0bf00);
    }
    /* With the ambient scene running the system clears surface patterns off the bars
       (background shorthand above ambient veils). The enamel wipe and its line-colour
       band are the header's signature, so they return as translucent layers over the
       veil; the platform edge is a border and was never affected. */
    body[data-ambient="on"][data-theme="shinkansen"] .app-header {
      background-image:
        linear-gradient(180deg, rgba(15, 76, 150, 0) calc(100% - 6px), rgba(15, 76, 150, .8) calc(100% - 6px), rgba(15, 76, 150, .8) calc(100% - 4px), rgba(15, 76, 150, 0) calc(100% - 4px)),
        linear-gradient(180deg, rgba(255, 255, 255, .55) 0%, rgba(255, 255, 255, .08) 44%, rgba(15, 76, 150, .04) 100%);
    }
    [data-theme="shinkansen"] .editor-pane {
      background-image:
        radial-gradient(circle at 8.1px 8.1px, rgba(255, 255, 255, .72) 0 1.5px, transparent 1.6px),
        radial-gradient(circle at 9.1px 9.1px, rgba(26, 42, 58, .04) 0 1.9px, transparent 2px),
        repeating-linear-gradient(90deg, rgba(26, 42, 58, .026) 0 1px, transparent 1px 128px),
        repeating-linear-gradient(180deg, rgba(26, 42, 58, .02) 0 1px, transparent 1px 128px),
        linear-gradient(180deg, var(--sidebar-start), var(--sidebar-end));
      background-size: 18px 18px, 18px 18px, auto, auto, auto;
    }
    [data-theme="shinkansen"] .preview-pane {
      background-image:
        radial-gradient(circle at 8.1px 8.1px, rgba(255, 255, 255, .72) 0 1.5px, transparent 1.6px),
        radial-gradient(circle at 9.1px 9.1px, rgba(26, 42, 58, .04) 0 1.9px, transparent 2px),
        repeating-linear-gradient(90deg, rgba(26, 42, 58, .026) 0 1px, transparent 1px 128px),
        repeating-linear-gradient(180deg, rgba(26, 42, 58, .02) 0 1px, transparent 1px 128px),
        linear-gradient(180deg, #edf1f5, #e4eaf0);
      background-size: 18px 18px, 18px 18px, auto, auto, auto;
    }
    /* Rolling stock: pearl-white painted steel, brushed lengthwise. */
    [data-theme="shinkansen"] .preview-card {
      background-image:
        repeating-linear-gradient(180deg, rgba(26, 42, 58, .016) 0 1px, rgba(255, 255, 255, .5) 1px 2px, transparent 2px 6px);
    }
    [data-theme="shinkansen"] .wp-surface {
      background-image:
        radial-gradient(circle at 8.1px 8.1px, rgba(255, 255, 255, .72) 0 1.5px, transparent 1.6px),
        radial-gradient(circle at 9.1px 9.1px, rgba(26, 42, 58, .04) 0 1.9px, transparent 2px),
        repeating-linear-gradient(90deg, rgba(26, 42, 58, .026) 0 1px, transparent 1px 128px),
        repeating-linear-gradient(180deg, rgba(26, 42, 58, .02) 0 1px, transparent 1px 128px),
        linear-gradient(180deg, #eff2f6, #e6ecf1);
      background-size: 18px 18px, 18px 18px, auto, auto, auto;
    }

    [data-theme="koi"] {"""

VEIL_ZEN = ('    [data-theme="zen"]       { --ambient-opacity: .95; --ambient-card: rgba(246, 243, 234, .6); '
            '--ambient-bar: rgba(246, 243, 234, .74); --ambient-pane: rgba(246, 243, 234, .68); }\n')

# The departure indicator is the darkest, highest-contrast object in the ambient
# scene and it lands behind the header, the workspace bar and the preview toolbar.
# Measured on the real frame: at .91 its amber numerals are still legible through
# the chrome, at .97 they are a whisper, and only at 1 are they gone. The bars are
# the enamel signage of this theme and an enamel plate is opaque, so they take the
# full veil; the scene keeps its transparency where it belongs - the panes and the
# diagram card.
VEIL_SK = ('    [data-theme="shinkansen"] { --ambient-opacity: .95; --ambient-card: rgba(247, 249, 251, .62); '
           '--ambient-bar: rgba(247, 249, 251, 1); --ambient-pane: rgba(247, 249, 251, .76); }\n')

MERMAID_ZEN = (
    "        zen: {\n"
    "          canvasBg: '#f1eee4', text: '#201e18', muted: '#555246',\n"
    "          nodeFill: '#fbf9f0', nodeText: '#201e18', nodeBorder: '#837e6a',\n"
    "          nodeAccent: '#e4e9d7', nodeAccentBorder: '#45663a', line: '#5f5c4c', edgeLabel: '#eceadb'\n"
    "        },\n")

MERMAID_SK = (
    "        shinkansen: {\n"
    "          canvasBg: '#f7f9fb', text: '#16202b', muted: '#4a5765',\n"
    "          nodeFill: '#fdfeff', nodeText: '#16202b', nodeBorder: '#2b4a72',\n"
    "          nodeAccent: '#dbe6f4', nodeAccentBorder: '#0f4c96', line: '#4c5a67', edgeLabel: '#e8eef4'\n"
    "        },\n")

KOI_MENU_BTN = ('<button class="theme-menu-option" type="button" role="option" data-theme-value="koi" '
                'aria-selected="false"><span class="theme-option-swatch" style="--swatch-a:#0a1a14;'
                '--swatch-b:#e8833c"></span><span>Koi Pond</span>'
                '<span class="theme-option-check">✓</span></button>\n')

# Every swatch in this menu is the theme's own --app-bg run into its own --primary
# (Zen #eae6da/#45663a, Ukiyo-e #ece1c8/#1c4d7c, Koi #0a1a14/#e8833c). Shinkansen
# follows it: steel ground into JR blue. Built first with the safety yellow in the
# --primary slot it rendered as a plain yellow chip - a near twin of Kintsugi two
# rows above it in the same collection - and advertised a gold theme instead of a
# pearl-and-blue one. The yellow is rationed to one edge in the app; it is rationed
# out of the swatch for the same reason.
SK_MENU_BTN = ('              <button class="theme-menu-option" type="button" role="option" '
               'data-theme-value="shinkansen" aria-selected="false"><span class="theme-option-swatch" '
               'style="--swatch-a:#e4e9ee;--swatch-b:#0f4c96"></span><span>Shinkansen</span>'
               '<span class="theme-option-check">✓</span></button>\n')

# ==========================================================================
# B.  SCENE  - anchor is the head of the aurora entry, which follows koi.
# ==========================================================================
B_SCENE_ANCHOR = '        },\n\n/* Aurora Borealis - curtains of cold fire standing over an arctic night, hems'

# ==========================================================================
# C.  INTRO
# ==========================================================================
C_CSS_KOI_LINE = ".koi-intro-overlay .theme-intro-progress i { background: linear-gradient(90deg, #e8833c, #d4af37); }"
C_CSS_GENERIC_LINE = "    .generic-intro-overlay { background: var(--intro-bg, #0a0a0a); }"
C_CSS_ANCHOR = C_CSS_KOI_LINE + "\n" + C_CSS_GENERIC_LINE

C_MARKUP_ANCHOR = ('  <div class="theme-intro-overlay generic-intro-overlay" id="genericIntroOverlay" hidden '
                   'aria-live="polite" aria-label="Theme loading">')

C_IDLIST_ANCHOR = "'zenIntroOverlay','koiIntroOverlay','genericIntroOverlay'"
C_IDLIST_NEW = "'zenIntroOverlay','koiIntroOverlay','shinkansenIntroOverlay','genericIntroOverlay'"

C_TIMERS_ANCHOR = ("      const themeIntroTimers = { kpmg: null, sakura: null, tokyo: null, ukiyoe: null, "
                   "zen: null, koi: null,")
C_TIMERS_NEW = ("      const themeIntroTimers = { kpmg: null, sakura: null, tokyo: null, ukiyoe: null, "
                "zen: null, koi: null, shinkansen: null,")

C_OWNMAP_ANCHOR = "zen: el.zenIntroOverlay, koi: el.koiIntroOverlay }[key];"
C_OWNMAP_NEW = ("zen: el.zenIntroOverlay, koi: el.koiIntroOverlay, "
                "shinkansen: el.shinkansenIntroOverlay }[key];")


def build_edits():
    scene = read_lf(SCENE_FILE)
    if not scene.endswith('\n'):
        scene += '\n'
    intro_html = read_lf(INTRO_HTML)
    if not intro_html.endswith('\n'):
        intro_html += '\n'
    intro_css = read_lf(INTRO_CSS)
    if not intro_css.endswith('\n'):
        intro_css += '\n'

    return [
        # ---- A. palette -------------------------------------------------
        ('A1  token block + 6 surface rules', 1, A_TOKENS_ANCHOR, A_TOKENS),
        ('A2  ambient card veil list', 1,
         '[data-theme="zen"], [data-theme="koi"], [data-theme="aurora"]',
         '[data-theme="zen"], [data-theme="shinkansen"], [data-theme="koi"], [data-theme="aurora"]'),
        ('A3  ambient veil tokens', 1, VEIL_ZEN, VEIL_ZEN + VEIL_SK),
        ('A4  theme-menu marker glyph list', 1,
         '    .theme-menu-option[data-theme-value="zen"] > span:nth-child(2)::before,\n',
         '    .theme-menu-option[data-theme-value="zen"] > span:nth-child(2)::before,\n'
         '    .theme-menu-option[data-theme-value="shinkansen"] > span:nth-child(2)::before,\n'),
        ('A5  light-theme shared UI tokens', 1,
         '    [data-theme="ukiyoe"],\n    [data-theme="zen"],\n    [data-theme="grandhotel"],\n',
         '    [data-theme="ukiyoe"],\n    [data-theme="zen"],\n    [data-theme="shinkansen"],\n'
         '    [data-theme="grandhotel"],\n'),
        ('A6  light-theme select colour-scheme', 1,
         '    [data-theme="zen"] select,\n    [data-theme="grandhotel"] select,\n',
         '    [data-theme="zen"] select,\n    [data-theme="shinkansen"] select,\n'
         '    [data-theme="grandhotel"] select,\n'),
        ('A7  light-theme form-control lists', 8,
         '[data-theme="zen"], [data-theme="grandhotel"])',
         '[data-theme="zen"], [data-theme="shinkansen"], [data-theme="grandhotel"])'),
        ('A8  native selects (desktop + mobile)', 2,
         '<option value="koi">Koi Pond</option></optgroup>',
         '<option value="koi">Koi Pond</option><option value="shinkansen">Shinkansen</option></optgroup>'),
        ('A9  theme menu option + swatch', 1, KOI_MENU_BTN, KOI_MENU_BTN + SK_MENU_BTN),
        ('A10 Mermaid preset themePresets.shinkansen', 1, MERMAID_ZEN, MERMAID_ZEN + MERMAID_SK),
        ('A11 theme option count comment', 1,
         'so Tab cannot wander through 36 options into the header.',
         'so Tab cannot wander through 37 options into the header.'),

        # ---- B. scene ---------------------------------------------------
        ('B1  AMBIENT_SCENES.shinkansen', 1, B_SCENE_ANCHOR,
         '        },\n\n' + scene +
         '\n/* Aurora Borealis - curtains of cold fire standing over an arctic night, hems'),

        # ---- C. intro ---------------------------------------------------
        ('C1  intro stylesheet', 1, C_CSS_ANCHOR,
         C_CSS_KOI_LINE + '\n' + intro_css + C_CSS_GENERIC_LINE),
        ('C2  intro overlay markup', 1, C_MARKUP_ANCHOR, intro_html + C_MARKUP_ANCHOR),
        ('C3  element id registration', 1, C_IDLIST_ANCHOR, C_IDLIST_NEW),
        ('C4  themeIntroTimers slot', 1, C_TIMERS_ANCHOR, C_TIMERS_NEW),
        ('C5  themeIntroOverlayFor own map', 1, C_OWNMAP_ANCHOR, C_OWNMAP_NEW),
    ]


def main():
    if len(sys.argv) < 2:
        print('usage: install_shinkansen.py <target.html>')
        return 2
    path = sys.argv[1]

    for f in (SCENE_FILE, INTRO_HTML, INTRO_CSS):
        if not os.path.exists(f):
            print('MISSING DELIVERABLE: %s' % f)
            return 1

    src = io.open(path, encoding='utf-8', newline='').read()
    before = len(src)

    if KEY in src:
        print('REFUSED (idempotent): "%s" already present in %s' % (KEY, path))
        return 1

    edits = build_edits()

    # ---- guard pass: nothing is written unless every anchor matches ------
    problems = []
    for name, count, anchor, _repl in edits:
        found = src.count(anchor)
        if found != count:
            problems.append('  %-42s expected %d, found %d' % (name, count, found))
    if problems:
        print('ANCHOR CHECK FAILED - nothing written:')
        print('\n'.join(problems))
        return 1

    for name, count, anchor, repl in edits:
        src = src.replace(anchor, repl, count)
        print('  ok  %-42s x%d' % (name, count))

    # ---- post-conditions -------------------------------------------------
    checks = [
        ('token block', '[data-theme="shinkansen"] {\n      color-scheme: light;', 1),
        ('ambient veil tokens', '[data-theme="shinkansen"] { --ambient-opacity', 1),
        ('Mermaid preset', "        shinkansen: {\n          canvasBg:", 1),
        ('ambient scene entry', '        shinkansen: {\n          settleFrames:', 1),
        ('theme menu option', 'data-theme-value="shinkansen"', 2),
        ('native selects', '<option value="shinkansen">Shinkansen</option>', 2),
        ('intro overlay markup', 'id="shinkansenIntroOverlay"', 1),
        ('intro overlay id registered', "'shinkansenIntroOverlay'", 1),
        ('intro timers slot', 'shinkansen: null', 1),
        ('intro own-map entry', 'shinkansen: el.shinkansenIntroOverlay', 1),
        # 3 = the overlay root, its reduced-motion override, and the night-variant
        # guard; 2 = the header rule plus its ambient-veil counterpart.
        ('intro stylesheet', '.shinkansen-intro-overlay {', 3),
        ('surface rules', '[data-theme="shinkansen"] .app-header', 2),
        ('intro root rule', '\n    .shinkansen-intro-overlay {', 1),
    ]
    bad = []
    for name, needle, want in checks:
        got = src.count(needle)
        if got != want:
            bad.append('  %-30s expected %d, found %d' % (name, want, got))
    if bad:
        print('POST-CONDITION FAILED - nothing written:')
        print('\n'.join(bad))
        return 1

    io.open(path, 'w', encoding='utf-8', newline='').write(src)
    print('INSTALLED %s  %d -> %d chars (+%d)' % (path, before, len(src), len(src) - before))
    return 0


if __name__ == '__main__':
    sys.exit(main())
