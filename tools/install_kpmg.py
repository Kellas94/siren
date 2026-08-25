#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
install_kpmg.py - ONE installer for the whole "KPMG Blue" ultra theme.

Applies, in order, into a COPY of T_Industries_SIREN_v1.html:

  A. NIGHT APPEARANCE       night token palette + Day/Night finish bar
                            (#kpmgFinishBar), state.kpmg, kpmgVariant /
                            applyKpmgThemePreset / syncKpmgUi / applyKpmgVariant,
                            registration in el() / applyTheme / click handler.
  B. AMBIENT SCENE          the "engraved plate" AMBIENT_SCENES.kpmg entry read
                            from scene_kpmg.js, PLUS the --ambient-* veil tokens
                            for kpmg day and kpmg night (without them the veils
                            fall back to .45 / --panel-bg and the plate is either
                            invisible or painted over).
  C. ARRIVAL SEQUENCE       #kpmgIntroOverlay markup (intro_kpmg.html) and its
                            stylesheet (intro_kpmg.css), plus the three
                            registrations the shared intro machinery needs:
                            el() roster, themeIntroTimers key, and the
                            themeIntroOverlayFor "own" map entry.

Every replacement asserts its anchor occurs EXACTLY ONCE before anything is
written. No line numbers are used anywhere, so the patch survives concurrent
edits elsewhere in the file. Nothing is written unless every edit succeeds.

USAGE
    python install_kpmg.py <path-to-a-COPY>

The script refuses C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html outright
and refuses any file that already carries part of this work.
"""

import io
import os
import sys

PROTECTED = "t_industries_siren_v1.html"
PROTECTED_DIR = "downloads"
HERE = os.path.dirname(os.path.abspath(__file__))


def sidecar(name):
    path = os.path.join(HERE, name)
    with io.open(path, encoding="utf-8", newline="") as handle:
        return handle.read().replace(chr(13) + chr(10), chr(10))


# ==========================================================================
# A. NIGHT APPEARANCE  (constants as delivered by the night-palette agent,
#    with the integration fixes noted inline)
# ==========================================================================

CSS_ANCHOR = """      --line-color: #345f9e;
      --edge-label-bg: #e7edf8;
    }
"""

CSS_ADDITION = """
    /* ----------------------------------------------------------------------
       KPMG Blue - NIGHT appearance.

       Pure CSS hung on a body attribute, deliberately the same route the
       Cupertino finishes take rather than the inline palette the Kintsugi
       finishes install: an inline palette has to be defended against the
       accessibility tuner, and there is no reason to take that on when a
       cascade will do.

       A Big-Four audit firm after dark: deep navy and indigo, never a grey
       dark theme and never neon.  KPMG blue #00338d is too dark to carry an
       accent in the dark, so it lifts to #4d9bf0 for rings, outlines and the
       brand hairline - places nothing sits on top of.  The violet #483698
       lifts to #7c6ce0 and keeps its job in the header rule.  --primary stays
       DARK ENOUGH for white label text to clear 4.5:1 on it, and
       --primary-hover goes darker still.  Square 4px radii are untouched.
       ---------------------------------------------------------------------- */
    [data-theme="kpmg"][data-kpmg-variant="night"] {
      color-scheme: dark;
      --app-bg: #070d1e;
      --panel-bg: #0d1630;
      --panel-alt: #111c3a;
      --panel-elevated: #16234a;
      --sidebar-start: #101a38;
      --sidebar-end: #090f24;
      --canvas-bg: #0a122a;
      --input-bg: #0e1832;
      --text: #e9eefb;
      --muted: #a7b8d8;
      --subtle: #97a9cc;
      --border: #223458;
      --border-strong: #47679e;
      --field-border: #52709f;
      /* White ink on a filled accent: #ffffff clears 4.81:1 on --primary and
         6.98:1 on --primary-hover, which is the DARKER of the two. */
      --primary: #2a6fd8;
      --primary-hover: #1f57ab;
      --primary-text: #ffffff;
      --secondary: #18264a;
      --secondary-hover: #203058;
      --secondary-text: #e9eefb;
      --danger: #ff9a90;
      --danger-strong: #ffb3aa;
      --danger-bg: #3d1618;
      --success: #6fdfa8;
      --success-bg: #0e2e26;
      --warning: #ffd27a;
      --warning-bg: #372a10;
      --focus-ring: #4d9bf0;
      --code-text: #cfe0f8;
      --pill-text: #a9c8f5;
      --pill-bg: #14264a;
      --code-bg: #060c1c;
      --deco-gold: #4d9bf0;
      --shadow: 0 20px 54px rgba(2, 6, 18, .62);
      --shadow-soft: 0 8px 26px rgba(2, 6, 18, .48);
      --node-fill: #12203f;
      --node-text: #eaf1ff;
      --node-border: #6d8ab8;
      --node-accent: #132a5c;
      --node-accent-border: #4d9bf0;
      --line-color: #7fa8e0;
      --edge-label-bg: #0d1a35;
      /* The shared light-theme UI tokens list kpmg, and their cream constants
         read wrong once the surfaces go navy.  Restate them for night. */
      --ui-scrollbar-track: #0b142b;
      --ui-input-shadow: inset 0 1px 0 rgba(255, 255, 255, .05), 0 1px 2px rgba(2, 6, 18, .45);
      --ui-input-shadow-focus: 0 0 0 3px color-mix(in srgb, var(--focus-ring) 30%, transparent);
      --ui-scrollbar-thumb: color-mix(in srgb, var(--primary) 62%, #24365e);
      --ui-scrollbar-thumb-hover: color-mix(in srgb, var(--focus-ring) 58%, #24365e);
      --ui-scrollbar-border: color-mix(in srgb, var(--panel-bg) 88%, #050a16);
      --ui-dialog-bg: color-mix(in srgb, var(--panel-bg) 94%, #050a16 6%);
      --ui-dialog-section-bg: color-mix(in srgb, var(--panel-alt) 94%, #050a16 6%);
    }

    /* A very quiet pool of light behind the shell.  Static: it is painted by
       the body, BEHIND the ambient canvas, and nothing in it animates, so the
       picture is already finished on frame 1. */
    body[data-theme="kpmg"][data-kpmg-variant="night"] {
      background-image:
        radial-gradient(circle at 14% -8%, rgba(47, 127, 224, .16), transparent 46%),
        radial-gradient(circle at 88% 2%, rgba(124, 108, 224, .13), transparent 40%),
        radial-gradient(circle at 52% 116%, rgba(19, 42, 92, .55), transparent 58%);
    }

    /* The day header stripe is #00338d / #005eb8 on white; at night those two
       vanish into the panel, so the stripe takes the lifted blue and the
       lifted violet instead.  background-size / position / repeat stay
       inherited from the day rule. */
    [data-theme="kpmg"][data-kpmg-variant="night"] .app-header,
    [data-theme="kpmg"][data-kpmg-variant="night"] .diagram-workspace-bar {
      border-bottom-color: #2f7fe0;
      background-image: linear-gradient(90deg, #2f7fe0 0 9px, transparent 9px 18px, #7c6ce0 18px 27px, transparent 27px);
      box-shadow: inset 0 -1px 0 rgba(124, 108, 224, .34), var(--shadow-soft);
    }

    /* kpmg is in the shared light-theme form-control list, which pins
       color-scheme: light.  Outrank it so the native controls and their
       popups come up dark at night. */
    [data-theme="kpmg"][data-kpmg-variant="night"]
      :is(input:not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), select, textarea) {
      color-scheme: dark;
    }

    /* .struct-token[data-kind="id"] and [data-kind="direction"] paint themselves
       in var(--primary).  --primary is pinned dark so WHITE clears 4.5:1 on it,
       which is the right trade for a filled button but leaves it at 4.05:1 as
       ink on the code well.  Night gives those two tokens their own lifted ink:
       #7db4f5 on --code-bg measures 9.02:1. */
    [data-theme="kpmg"][data-kpmg-variant="night"] .struct-token[data-kind="id"],
    [data-theme="kpmg"][data-kpmg-variant="night"] .struct-token[data-kind="direction"] { color: #7db4f5; }

    /* The appearance bar, in both appearances: square like the rest of kpmg. */
    [data-theme="kpmg"] #kpmgFinishBar { display: flex; }
    [data-theme="kpmg"] #kpmgFinishBar .kintsugi-finish { border-radius: 4px; }
    [data-theme="kpmg"] #kpmgFinishBar .kintsugi-finish-swatch { border-radius: 2px; border-color: rgba(255, 255, 255, .22); }
"""


# --------------------------------------------------------------------------
# 2. HTML: the finish bar, placed immediately before the Cupertino one
# --------------------------------------------------------------------------

BAR_ANCHOR = """        <div class="kintsugi-finish-bar" id="cupertinoFinishBar" hidden aria-label="Cupertino appearance">"""

BAR_ADDITION = """        <div class="kintsugi-finish-bar" id="kpmgFinishBar" hidden aria-label="KPMG Blue appearance">
          <strong class="kintsugi-mark" title="KPMG Blue appearance">Appearance</strong>
          <div class="kintsugi-finish-options" role="group" aria-label="Appearance">
            <button class="kintsugi-finish" type="button" data-kpmg-light="day" aria-pressed="false" title="Day appearance"><span class="kintsugi-finish-swatch" style="--ka:#ffffff;--kb:#00338d"></span><span>Day</span></button>
            <button class="kintsugi-finish" type="button" data-kpmg-light="night" aria-pressed="false" title="Night appearance"><span class="kintsugi-finish-swatch" style="--ka:#0d1630;--kb:#4d9bf0"></span><span>Night</span></button>
          </div>
        </div>

"""


# --------------------------------------------------------------------------
# 3. el(...) id list
# --------------------------------------------------------------------------

EL_ANCHOR = "'kintsugiFinishBar','cupertinoFinishBar','cupertinoIntroOverlay'"
EL_REPLACEMENT = "'kintsugiFinishBar','cupertinoFinishBar','kpmgFinishBar','cupertinoIntroOverlay'"


# --------------------------------------------------------------------------
# 4. default state
# --------------------------------------------------------------------------

STATE_ANCHOR = "        cupertino: { variant: 'day-blue' },\n"
STATE_REPLACEMENT = "        cupertino: { variant: 'day-blue' },\n        kpmg: { variant: 'day' },\n"


# --------------------------------------------------------------------------
# 5. click handler, beside the cupertino one
# --------------------------------------------------------------------------

CLICK_ANCHOR = "        if (el.kintsugiFinishBar) el.kintsugiFinishBar.addEventListener('click', event => {"

CLICK_ADDITION = """        if (el.kpmgFinishBar) el.kpmgFinishBar.addEventListener('click', event => {
          const picked = event.target.closest('[data-kpmg-light]');
          if (picked) applyKpmgVariant(picked.dataset.kpmgLight);
        });
"""


# --------------------------------------------------------------------------
# 6. the four functions, next to the cupertino four
# --------------------------------------------------------------------------

FN_ANCHOR = """      function syncKintsugiUi() {
        if (!el.kintsugiFinishBar) return;"""

FN_ADDITION = """      const KPMG_VARIANTS = ['day', 'night'];

      function kpmgVariant() {
        const chosen = state.kpmg && state.kpmg.variant;
        return KPMG_VARIANTS.includes(chosen) ? chosen : 'day';
      }

      /* The diagram palette is JavaScript, not CSS, so the night appearance has
         to hand the renderer its own node colours the way Cupertino does. */
      const KPMG_DIAGRAM = {
        day: { canvasBg: '#ffffff', text: '#172033', muted: '#526078', nodeFill: '#edf4ff', nodeText: '#15213b',
          nodeBorder: '#00338d', nodeAccent: '#eee9fb', nodeAccentBorder: '#483698', line: '#345f9e', edgeLabel: '#e7edf8' },
        night: { canvasBg: '#0a122a', text: '#e9eefb', muted: '#a7b8d8', nodeFill: '#12203f', nodeText: '#eaf1ff',
          nodeBorder: '#6d8ab8', nodeAccent: '#132a5c', nodeAccentBorder: '#4d9bf0', line: '#7fa8e0', edgeLabel: '#0d1a35' }
      };

      function applyKpmgThemePreset() {
        const variant = kpmgVariant();
        Object.assign(themePresets.kpmg, KPMG_DIAGRAM[variant]);
        if (state.theme === 'kpmg') document.body.dataset.kpmgVariant = variant;
        else delete document.body.dataset.kpmgVariant;
      }

      function syncKpmgUi() {
        if (!el.kpmgFinishBar) return;
        const active = state.theme === 'kpmg';
        el.kpmgFinishBar.hidden = !active;
        const variant = kpmgVariant();
        el.kpmgFinishBar.querySelectorAll('[data-kpmg-light]').forEach(button => {
          button.setAttribute('aria-pressed', String(active && button.dataset.kpmgLight === variant));
        });
      }

      function applyKpmgVariant(variant, shouldRender = true) {
        state.kpmg = { variant: KPMG_VARIANTS.includes(variant) ? variant : 'day' };
        scheduleSave();
        applyKpmgThemePreset();
        syncKpmgUi();
        if (state.theme === 'kpmg') {
          // The scene reads the appearance in init, so it is rebuilt rather
          // than recoloured, and the tuner re-reads the new surfaces.
          stopAmbientScene();
          syncAmbientScene();
          tuneThemeAccessibility();
          if (shouldRender) renderDiagram({ reason: 'theme', saveVersion: false });
        }
      }

"""


# --------------------------------------------------------------------------
# 7. applyTheme(), beside the cupertino pair
# --------------------------------------------------------------------------

APPLY_ANCHOR = """        applyCupertinoThemePreset();
        syncCupertinoUi();
        if (themeName === 'wasteland') applyWastelandThemePreset();"""

APPLY_REPLACEMENT = """        applyCupertinoThemePreset();
        syncCupertinoUi();
        applyKpmgThemePreset();
        syncKpmgUi();
        if (themeName === 'wasteland') applyWastelandThemePreset();"""



# ==========================================================================
# B. AMBIENT SCENE
# ==========================================================================

# B1. The scene body itself, spliced in at the head of AMBIENT_SCENES so it sits
#     beside the other scenes at their own indentation.
SCENE_ANCHOR = "      const AMBIENT_SCENES = {\n"

# B2. The veil tokens. #ambientCanvas falls back to opacity .45 and the chrome
#     falls back to the OPAQUE --panel-bg when a theme does not name these, so
#     without this line the plate is half-invisible behind a solid shell.
AMBIENT_TOKENS_ANCHOR = """    [data-theme="cupertino"][data-cupertino-variant^="night"] { --ambient-card: rgba(17, 21, 28, .66); --ambient-bar: rgba(15, 18, 24, .88); --ambient-pane: rgba(17, 21, 28, .84); }
"""

AMBIENT_TOKENS_ADDITION = """    [data-theme="kpmg"]      { --ambient-opacity: .95; --ambient-card: rgba(255, 255, 255, .72); --ambient-bar: rgba(255, 255, 255, .91); --ambient-pane: rgba(255, 255, 255, .88); --ambient-blur: 0px; }
    [data-theme="kpmg"][data-kpmg-variant="night"] { --ambient-card: rgba(11, 19, 42, .76); --ambient-bar: rgba(9, 16, 36, .93); --ambient-pane: rgba(11, 19, 42, .90); }

    /* INTEGRATION FIX - the theme's one piece of chrome ornament vs the ambient veil.
       'body[data-ambient="on"] .app-header { background: var(--ambient-bar, ...) }'
       is the SHORTHAND, so switching the scene on resets background-image,
       -size, -position and -repeat to their initial values. The KPMG rule that
       paints the navy/blue dash rule along the bottom of the header only wins
       back 'background-image' (it is more specific), which left the day stripe
       erased outright and the night stripe painted at auto size from the top
       left - a 27px-wide floor-to-ceiling bar down the left of both bars.
       Measured in the running app, not reasoned about: see i_hdr_day.png /
       i_hdr_night.png.

       Restated here at a specificity that outranks the veil rule, with the veil
       colour kept as background-COLOR so the scene still shows through. */
    body[data-ambient="on"][data-theme="kpmg"] .app-header,
    body[data-ambient="on"][data-theme="kpmg"] .diagram-workspace-bar {
      background-color: var(--ambient-bar, var(--panel-bg));
      background-image: linear-gradient(90deg, #00338d 0 9px, transparent 9px 18px, #005eb8 18px 27px, transparent 27px);
      background-size: 100% 4px;
      background-position: left bottom;
      background-repeat: no-repeat;
    }
    body[data-ambient="on"][data-theme="kpmg"][data-kpmg-variant="night"] .app-header,
    body[data-ambient="on"][data-theme="kpmg"][data-kpmg-variant="night"] .diagram-workspace-bar {
      background-image: linear-gradient(90deg, #2f7fe0 0 9px, transparent 9px 18px, #7c6ce0 18px 27px, transparent 27px);
    }
"""


# ==========================================================================
# C. ARRIVAL SEQUENCE
# ==========================================================================

INTRO_CSS_ANCHOR = "    @keyframes theme-intro-fade {"

INTRO_MARKUP_ANCHOR = """  <div class="theme-intro-overlay zen-intro-overlay" id="zenIntroOverlay\""""

INTRO_EL_ANCHOR = "'cupertinoIntroOverlay','kintsugiIntroOverlay'"
INTRO_EL_REPLACEMENT = "'cupertinoIntroOverlay','kpmgIntroOverlay','kintsugiIntroOverlay'"

INTRO_TIMER_ANCHOR = "      const themeIntroTimers = { sakura: null, tokyo: null,"
INTRO_TIMER_REPLACEMENT = "      const themeIntroTimers = { kpmg: null, sakura: null, tokyo: null,"

INTRO_OWN_ANCHOR = "        const own = { cupertino: el.cupertinoIntroOverlay,"
INTRO_OWN_REPLACEMENT = "        const own = { kpmg: el.kpmgIntroOverlay, cupertino: el.cupertinoIntroOverlay,"


# ==========================================================================
# machinery
# ==========================================================================

class PatchError(RuntimeError):
    pass


def _guard(text, anchor, label):
    hits = text.count(anchor)
    if hits != 1:
        raise PatchError(
            "anchor for %s occurs %d times, expected exactly 1.\n  anchor: %r"
            % (label, hits, anchor[:140])
        )


def insert_before(text, anchor, addition, label):
    _guard(text, anchor, label)
    return text.replace(anchor, addition + anchor, 1)


def insert_after(text, anchor, addition, label):
    _guard(text, anchor, label)
    return text.replace(anchor, anchor + addition, 1)


def swap(text, anchor, replacement, label):
    _guard(text, anchor, label)
    return text.replace(anchor, replacement, 1)


ALREADY_PATCHED_MARKERS = [
    'data-kpmg-variant="night"',
    'kpmgFinishBar',
    'KPMG_VARIANTS',
    'applyKpmgThemePreset',
    'kpmgIntroOverlay',
    'kpmg-intro-overlay',
    'AMBIENT_SCENES.kpmg',
    '        kpmg: {\n          settleFrames',
]


def patch(path):
    scene = sidecar("scene_kpmg.js")
    intro_css = sidecar("intro_kpmg.css")
    intro_markup = sidecar("intro_kpmg.html")

    if not scene.rstrip().endswith("},"):
        raise PatchError("scene_kpmg.js does not close with '},' - not an AMBIENT_SCENES entry")
    if "kpmgIntroOverlay" not in intro_markup:
        raise PatchError("intro_kpmg.html does not carry #kpmgIntroOverlay")

    with io.open(path, encoding="utf-8", newline="") as handle:
        src = handle.read()

    present = [m for m in ALREADY_PATCHED_MARKERS if m in src]
    if present:
        raise PatchError(
            "file already carries part of the KPMG theme (found %s). Start from a clean copy."
            % ", ".join(repr(p[:40]) for p in present)
        )

    out = src

    # ---- A. night appearance -------------------------------------------------
    out = insert_after(out, CSS_ANCHOR, CSS_ADDITION, "A1 kpmg day token block (CSS)")
    out = insert_before(out, BAR_ANCHOR, BAR_ADDITION, "A2 cupertino finish bar markup")
    out = swap(out, EL_ANCHOR, EL_REPLACEMENT, "A3 el() id list - finish bar")
    out = swap(out, STATE_ANCHOR, STATE_REPLACEMENT, "A4 defaultState.cupertino")
    out = insert_before(out, CLICK_ANCHOR, CLICK_ADDITION, "A5 kintsugi finish bar click handler")
    out = insert_before(out, FN_ANCHOR, FN_ADDITION, "A6 syncKintsugiUi declaration")
    out = swap(out, APPLY_ANCHOR, APPLY_REPLACEMENT, "A7 applyTheme cupertino pair")

    # ---- B. ambient scene ----------------------------------------------------
    out = insert_after(out, SCENE_ANCHOR, "\n" + scene.rstrip("\n") + "\n", "B1 AMBIENT_SCENES head")
    out = insert_after(out, AMBIENT_TOKENS_ANCHOR, AMBIENT_TOKENS_ADDITION, "B2 ambient veil token table")

    # ---- C. arrival sequence -------------------------------------------------
    out = insert_before(out, INTRO_CSS_ANCHOR, intro_css.rstrip("\n") + "\n", "C1 theme-intro-fade keyframes")
    out = insert_before(out, INTRO_MARKUP_ANCHOR, intro_markup.rstrip("\n") + "\n", "C2 zen intro overlay markup")
    out = swap(out, INTRO_EL_ANCHOR, INTRO_EL_REPLACEMENT, "C3 el() id list - intro overlay")
    out = swap(out, INTRO_TIMER_ANCHOR, INTRO_TIMER_REPLACEMENT, "C4 themeIntroTimers roster")
    out = swap(out, INTRO_OWN_ANCHOR, INTRO_OWN_REPLACEMENT, "C5 themeIntroOverlayFor own map")

    if out == src:
        raise PatchError("nothing changed - refusing to write")

    with io.open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(out)

    return len(src), len(out)


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 2
    target = os.path.abspath(argv[1])
    lowered = target.replace("\\", "/").lower()
    if lowered.endswith(PROTECTED) and ("/" + PROTECTED_DIR + "/") in lowered:
        print("REFUSED: %s is the read-only original. Patch a copy." % target)
        return 3
    if not os.path.isfile(target):
        print("REFUSED: %s does not exist." % target)
        return 4
    try:
        before, after = patch(target)
    except PatchError as error:
        print("INSTALL FAILED: %s" % error)
        return 1
    print("installed KPMG ultra theme into %s  (%d -> %d bytes, +%d)"
          % (target, before, after, after - before))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
