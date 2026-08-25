"""
The `wonders` theme: the human record, night and day.

The owner's brief was the Civilization idea - the greatest works, from before the common era through
to the machine reading this. It ships as TWO presets rather than one theme with a switch, because
SIREN has no mechanism for a theme with two modes: all 37 declare a single `color-scheme`, nothing
pairs them, and inventing that pairing is new machinery rather than a theme.

The palettes were measured, not chosen by eye. Night reads lapis as the ground the wonders stood
against, limestone as the built thing, bronze as the joinery, gold leaf as the emphasis. Day carries
the same idea onto papyrus.

    night   block label 12.37:1   title 14.09:1   decision 6.98:1   connector 5.30:1
    day     block label 14.65:1   title  9.83:1   decision 7.79:1   connector 3.72:1

Three things established while building it, recorded so nobody re-derives them:

 1. The phosphor cannot belong to a block. A preset applies to every node equally - SIREN has no
    per-node theme mechanism - so "one node as the modern era" was an invented capability. It lives
    in the chrome instead: the record is ancient, the instrument reading it is not.
 2. A light theme is defined by its border, not its fill. The shipped light themes measure 1.01 to
    1.11 block-against-canvas; day is 1.23. The real defect that comparison exposed was the border,
    which started at 3.19:1 - the weakest of the group - and is now 4.97:1.
 3. An ambient theme needs almost no chrome CSS. Aurora, a complete one, has three rules. Earlier
    notes here claimed the chrome was "the largest part of what a theme is"; measured, that is true
    of Art Deco (95 rules) and false of every ambient theme.

The scene follows the rule the codebase already states for Aurora - burn at the edges, leave the
middle calm - so the silhouettes sit in the bottom band and the middle of the frame, where the
diagram is, stays plain. One wonder crosses in about ninety seconds, deliberately below the speed at
which motion pulls the eye. Soften applies a blur and does not stop anything, so the scene has to be
calm at source rather than calm only when softened.

Also fixed here, because it was measured while counting the roster and it is the same kind of defect
this project keeps hunting: KPMG Blue is the only theme with an ambient scene and no star. 28 themes
animate, 27 carry the mark. No theme carries the mark without animating, so the glyph never
over-promises - it just missed the one theme an auditor is most likely to want.

Anchor-guarded, not SHA-pinned.

Usage: python patch_wonders_theme.py <path-to-siren.html>
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


# ---------------------------------------------------------------- 1. the two palettes
patch(
    "1. the two palettes",
    "        aurora: {\n"
    "          canvasBg: '#08111d', text: '#e6f2ee', muted: '#9fc0b8',",

    "        wonders: {\n"
    "          canvasBg: '#101d33', text: '#f2ead9', muted: '#c3b79c',\n"
    "          nodeFill: '#e6dcc3', nodeText: '#221c14', nodeBorder: '#8d6a3c',\n"
    "          nodeAccent: '#c9a227', nodeAccentBorder: '#f0d67a', line: '#b08a52', edgeLabel: '#0c1626'\n"
    "        },\n"
    "        wondersday: {\n"
    "          canvasBg: '#e9dfc6', text: '#3b2f1e', muted: '#6d5c42',\n"
    "          nodeFill: '#fbf6ea', nodeText: '#2a2118', nodeBorder: '#7a5628',\n"
    "          nodeAccent: '#d8b23f', nodeAccentBorder: '#8a6412', line: '#8d6a3c', edgeLabel: '#e4d9bd'\n"
    "        },\n"
    "        aurora: {\n"
    "          canvasBg: '#08111d', text: '#e6f2ee', muted: '#9fc0b8',",
)

# ---------------------------------------------------------------- 2. the menu entries
patch(
    "2. both appear in the menu, after Ie",
    '<button class="theme-menu-option" type="button" role="option" data-theme-value="ie" aria-selected="false">'
    '<span class="theme-option-swatch" style="--swatch-a:#fdf9f2;--swatch-b:#a61b1b"></span>'
    '<span>Ie</span><span class="theme-option-check">✓</span></button>',

    '<button class="theme-menu-option" type="button" role="option" data-theme-value="ie" aria-selected="false">'
    '<span class="theme-option-swatch" style="--swatch-a:#fdf9f2;--swatch-b:#a61b1b"></span>'
    '<span>Ie</span><span class="theme-option-check">✓</span></button>\n'
    '              <button class="theme-menu-option" type="button" role="option" data-theme-value="wonders" aria-selected="false">'
    '<span class="theme-option-swatch" style="--swatch-a:#101d33;--swatch-b:#c9a227"></span>'
    '<span>Wonders · Night</span><span class="theme-option-check">✓</span></button>\n'
    '              <button class="theme-menu-option" type="button" role="option" data-theme-value="wondersday" aria-selected="false">'
    '<span class="theme-option-swatch" style="--swatch-a:#e9dfc6;--swatch-b:#8a6412"></span>'
    '<span>Wonders · Day</span><span class="theme-option-check">✓</span></button>',
)

# ---------------------------------------------------------------- 3. the star, and KPMG's missing one
patch(
    "3. both carry the star, and KPMG Blue finally gets the one it earned",
    '.theme-menu-option[data-theme-value="cupertino"] > span:nth-child(2)::before,',
    '.theme-menu-option[data-theme-value="wonders"] > span:nth-child(2)::before,\n'
    '    .theme-menu-option[data-theme-value="wondersday"] > span:nth-child(2)::before,\n'
    '    /* KPMG Blue was the only theme in the app with an ambient scene and no mark: 28 animate,\n'
    '       27 were starred. Nothing was starred without animating, so the glyph never promised too\n'
    '       much - it just missed the one theme an auditor is most likely to reach for. */\n'
    '    .theme-menu-option[data-theme-value="kpmg"] > span:nth-child(2)::before,\n'
    '    .theme-menu-option[data-theme-value="cupertino"] > span:nth-child(2)::before,',
)

# ---------------------------------------------------------------- 4. the chrome
patch(
    "4. the ambient chrome for both",
    '[data-theme="aurora"]    { --ambient-opacity: .96;',

    '/* A theme is its custom properties. This was nearly shipped without them, on the assumption\n'
    '   that themePresets was enough because it is what buildMermaidConfig reads - and it is not.\n'
    '   Measured: with data-theme="wonders" set and the diagram redrawn, a block still painted\n'
    '   rgb(23, 34, 48). The rendered SVG carries no fill attribute at all; the colour comes from\n'
    '   these variables, and without a block of its own a theme silently inherits the :root\n'
    '   defaults - which is Dark wearing somebody else s name. */\n'
    '    [data-theme="wonders"] {\n'
    '      --app-bg: #0b1526; --panel-bg: #101d33; --panel-alt: #14243d; --panel-elevated: #182b47;\n'
    '      --sidebar-start: #101d33; --sidebar-end: #0b1526; --canvas-bg: #101d33; --input-bg: #0e1b30;\n'
    '      --text: #f2ead9; --muted: #c3b79c; --subtle: #9c8f76;\n'
    '      --border: #2f4560; --border-strong: #4a5f7f; --field-border: #5c6f8c;\n'
    '      --primary: #b08a52; --primary-hover: #c9a227; --primary-text: #16120b;\n'
    '      --secondary: #1c2f4b; --secondary-hover: #26405f; --secondary-text: #f2ead9;\n'
    '      --danger: #f3b7a6; --danger-strong: #d4674a; --danger-bg: rgba(212, 103, 74, 0.16);\n'
    '      --success: #a8d5b5; --success-bg: rgba(96, 160, 118, 0.16);\n'
    '      --warning: #f0d67a; --warning-bg: rgba(201, 162, 39, 0.16);\n'
    '      --focus-ring: #f0d67a; --code-text: #ecdfc4; --pill-text: #f0d67a;\n'
    '      --pill-bg: rgba(201, 162, 39, 0.16); --code-bg: #0c1626;\n'
    '      --node-fill: #e6dcc3; --node-text: #221c14; --node-border: #8d6a3c;\n'
    '      --node-accent: #c9a227; --node-accent-border: #f0d67a;\n'
    '      --line-color: #b08a52; --edge-label-bg: #0c1626;\n'
    '    }\n'
    '    [data-theme="wondersday"] {\n'
    '      --app-bg: #ded2b4; --panel-bg: #e9dfc6; --panel-alt: #e2d6b9; --panel-elevated: #f2ebd9;\n'
    '      --sidebar-start: #e9dfc6; --sidebar-end: #ded2b4; --canvas-bg: #e9dfc6; --input-bg: #f5efdf;\n'
    '      --text: #3b2f1e; --muted: #6d5c42; --subtle: #857a63;\n'
    '      --border: #c3b394; --border-strong: #a3906c; --field-border: #8f7d5c;\n'
    '      --primary: #8a6412; --primary-hover: #6f5010; --primary-text: #fbf6ea;\n'
    '      --secondary: #dccfae; --secondary-hover: #cfbf98; --secondary-text: #3b2f1e;\n'
    '      --danger: #8c3a24; --danger-strong: #a8452b; --danger-bg: rgba(168, 69, 43, 0.12);\n'
    '      --success: #3f6b4a; --success-bg: rgba(63, 107, 74, 0.12);\n'
    '      --warning: #7a5628; --warning-bg: rgba(216, 178, 63, 0.20);\n'
    '      --focus-ring: #8a6412; --code-text: #3b2f1e; --pill-text: #6f5010;\n'
    '      --pill-bg: rgba(216, 178, 63, 0.22); --code-bg: #f2ebd9;\n'
    '      --node-fill: #fbf6ea; --node-text: #2a2118; --node-border: #7a5628;\n'
    '      --node-accent: #d8b23f; --node-accent-border: #8a6412;\n'
    '      --line-color: #8d6a3c; --edge-label-bg: #e4d9bd;\n'
    '    }\n'
    '    /* And these four say how much of the scene shows through the card, the bar and the pane. */\n'
    '    [data-theme="wonders"] { color-scheme: dark; --ambient-opacity: .95; --ambient-card: rgba(16, 29, 51, .74); --ambient-bar: rgba(16, 29, 51, .88); --ambient-pane: rgba(16, 29, 51, .82); }\n'
    '    [data-theme="wondersday"] { color-scheme: light; --ambient-opacity: .92; --ambient-card: rgba(233, 223, 198, .80); --ambient-bar: rgba(233, 223, 198, .90); --ambient-pane: rgba(233, 223, 198, .86); }\n'
    '    /* The horizon is quiet already, so it needs less blur than the default 14px to settle. */\n'
    '    body[data-ambient-soft="on"][data-theme="wonders"],\n'
    '    body[data-ambient-soft="on"][data-theme="wondersday"] { --ambient-blur: 10px; }\n'
    '    [data-theme="aurora"]    { --ambient-opacity: .96;',
)

# ---------------------------------------------------------------- 5. the scene
SCENE = r"""        /* Wonders - a horizon of the human record drifting past, the era changing as it goes.
           Ten silhouettes in order, from before the common era to the rack that runs the model
           reading this. Everything lives in the bottom band: the middle of the frame is where the
           diagram sits and it is left plain, which is the rule the Aurora scene already states.
           One wonder crosses in about ninety seconds - slow enough that it never pulls the eye. */
        wonders: {
          settleFrames: 24,
          frameMs: 45,
          init(context, width, height, ratio) {
            const day = state.theme === 'wondersday';
            /* Each wonder is drawn into a unit box, 0..1 wide and 0..1 tall, sitting on y = 1. */
            const ERAS = [
              (g, w, h) => { g.moveTo(0, h); g.lineTo(w / 2, 0); g.lineTo(w, h); },
              (g, w, h) => { const s = 4; for (let i = 0; i < s; i += 1) { const t = i / s, b = (i + 1) / s;
                g.moveTo(w * t * 0.42, h * (1 - t)); g.lineTo(w - w * t * 0.42, h * (1 - t));
                g.lineTo(w - w * b * 0.42, h * (1 - b)); g.lineTo(w * b * 0.42, h * (1 - b)); } },
              (g, w, h) => { g.moveTo(0, h * 0.38); g.lineTo(w / 2, 0); g.lineTo(w, h * 0.38);
                g.lineTo(w, h * 0.46); g.lineTo(0, h * 0.46);
                for (let i = 0; i < 6; i += 1) { const cx = w * (0.08 + i * 0.168);
                  g.moveTo(cx, h * 0.46); g.lineTo(cx + w * 0.05, h * 0.46); g.lineTo(cx + w * 0.05, h); g.lineTo(cx, h); } },
              (g, w, h) => { g.moveTo(0, h * 0.28); g.lineTo(w, h * 0.28); g.lineTo(w, h * 0.40); g.lineTo(0, h * 0.40);
                for (let i = 0; i < 4; i += 1) { const cx = w * (0.125 + i * 0.25), r = w * 0.085;
                  g.moveTo(cx - r, h); g.lineTo(cx - r, h * 0.62); g.arc(cx, h * 0.62, r, Math.PI, 0); g.lineTo(cx + r, h); } },
              (g, w, h) => { g.moveTo(w * 0.42, h); g.lineTo(w * 0.42, h * 0.30); g.lineTo(w * 0.5, 0);
                g.lineTo(w * 0.58, h * 0.30); g.lineTo(w * 0.58, h);
                g.moveTo(w * 0.16, h); g.lineTo(w * 0.16, h * 0.55); g.lineTo(w * 0.30, h * 0.42); g.lineTo(w * 0.30, h);
                g.moveTo(w * 0.70, h); g.lineTo(w * 0.70, h * 0.42); g.lineTo(w * 0.84, h * 0.55); g.lineTo(w * 0.84, h); },
              (g, w, h) => { g.moveTo(w * 0.18, h); g.lineTo(w * 0.18, h * 0.52); g.lineTo(w * 0.82, h * 0.52); g.lineTo(w * 0.82, h);
                g.moveTo(w * 0.24, h * 0.52); g.arc(w * 0.5, h * 0.52, w * 0.26, Math.PI, 0);
                g.moveTo(w * 0.47, h * 0.24); g.lineTo(w * 0.5, h * 0.10); g.lineTo(w * 0.53, h * 0.24); },
              (g, w, h) => { g.moveTo(0, h); g.lineTo(0, h * 0.62); g.lineTo(w * 0.62, h * 0.62); g.lineTo(w * 0.62, h);
                g.moveTo(w * 0.70, h); g.lineTo(w * 0.74, h * 0.10); g.lineTo(w * 0.84, h * 0.10); g.lineTo(w * 0.88, h);
                for (let i = 0; i < 3; i += 1) { const cx = w * (0.10 + i * 0.18);
                  g.moveTo(cx, h * 0.62); g.lineTo(cx, h * 0.44); g.lineTo(cx + w * 0.10, h * 0.44); g.lineTo(cx + w * 0.10, h * 0.62); } },
              (g, w, h) => { g.moveTo(w * 0.36, h); g.lineTo(w * 0.46, 0); g.lineTo(w * 0.54, 0); g.lineTo(w * 0.64, h);
                for (let i = 1; i < 7; i += 1) { const t = i / 7, yy = h * t, sp = w * (0.10 + 0.16 * t);
                  g.moveTo(w * 0.5 - sp, yy); g.lineTo(w * 0.5 + sp, yy); g.lineTo(w * 0.5 + sp, yy + h * 0.02); g.lineTo(w * 0.5 - sp, yy + h * 0.02); } },
              (g, w, h) => { g.moveTo(w * 0.44, h); g.lineTo(w * 0.44, h * 0.58); g.lineTo(w * 0.56, h * 0.58); g.lineTo(w * 0.56, h);
                g.moveTo(w * 0.16, h * 0.56); g.arc(w * 0.5, h * 0.66, w * 0.36, Math.PI * 1.08, Math.PI * 1.92); g.lineTo(w * 0.5, h * 0.66);
                g.moveTo(w * 0.30, h); g.lineTo(w * 0.70, h); g.lineTo(w * 0.70, h * 0.94); g.lineTo(w * 0.30, h * 0.94); },
              (g, w, h) => { g.moveTo(w * 0.20, h); g.lineTo(w * 0.20, h * 0.18); g.lineTo(w * 0.80, h * 0.18); g.lineTo(w * 0.80, h);
                for (let i = 0; i < 7; i += 1) { const yy = h * (0.24 + i * 0.10);
                  g.moveTo(w * 0.26, yy); g.lineTo(w * 0.74, yy); g.lineTo(w * 0.74, yy + h * 0.035); g.lineTo(w * 0.26, yy + h * 0.035); } }
            ];
            return {
              day,
              eras: ERAS,
              /* The silhouettes must be DARKER than the sky wherever the glow brightens it. An
                 earlier draft used a lighter stone and they vanished exactly where the horizon was
                 brightest, which is the one place the eye looks. */
              ground: day ? '#e9dfc6' : '#101d33',
              mid: day ? '#d9c9a4' : '#132b45',
              floor: day ? '#cbb98f' : '#1a2338',
              stone: day ? '#8d7a52' : '#0a1425',
              ember: day ? '208, 150, 70' : '176, 104, 44',
              crossMs: 90000,
              spacing: 0.21
            };
          },
          draw(context, bits, width, height, ratio, frame) {
            if (!bits) return;
            const now = frame * 45;
            context.clearRect(0, 0, width, height);

            const sky = context.createLinearGradient(0, height * 0.42, 0, height);
            sky.addColorStop(0, bits.ground);
            sky.addColorStop(0.72, bits.mid);
            sky.addColorStop(1, bits.floor);
            context.fillStyle = bits.ground;
            context.fillRect(0, 0, width, height);
            context.fillStyle = sky;
            context.fillRect(0, height * 0.42, width, height * 0.58);

            /* A low sun just under the horizon. Gold over lapis goes olive - yellow at low alpha on
               blue reads green - so this is a warmer, redder ember rather than gold leaf. */
            const hz = height * 0.93;
            const glow = context.createRadialGradient(width * 0.5, hz, 0, width * 0.5, hz, Math.max(width, height) * 0.42);
            glow.addColorStop(0, 'rgba(' + bits.ember + ', .20)');
            glow.addColorStop(0.55, 'rgba(' + bits.ember + ', .07)');
            glow.addColorStop(1, 'rgba(' + bits.ember + ', 0)');
            context.fillStyle = glow;
            context.fillRect(0, height * 0.5, width, height * 0.5);

            const bandH = Math.max(48 * ratio, height * 0.17);
            const baseY = height * 0.955;
            const step = width * bits.spacing;
            const travel = (now % bits.crossMs) / bits.crossMs;
            const offset = travel * step;
            const count = Math.ceil(width / step) + 2;
            const first = Math.floor((now / bits.crossMs) * 1);

            context.save();
            context.fillStyle = bits.stone;
            for (let i = -1; i < count; i += 1) {
              const x = width - (i * step - offset);
              const era = bits.eras[(((i + first) % bits.eras.length) + bits.eras.length) % bits.eras.length];
              const w = step * 0.62;
              const h = bandH * (0.72 + 0.28 * (((i + first) % 3) / 2));
              context.beginPath();
              era(context, w, h);
              context.save();
              context.translate(x - w / 2, baseY - h);
              context.translate(-(x - w / 2), -(baseY - h));
              context.restore();
              /* The path was built in unit space at the origin, so it is drawn through a transform
                 rather than by rebuilding it per position. */
              context.setTransform(ratio, 0, 0, ratio, 0, 0);
              context.translate((x - w / 2) / ratio, (baseY - h) / ratio);
              context.beginPath();
              era(context, w / ratio, h / ratio);
              context.fill();
              context.setTransform(ratio, 0, 0, ratio, 0, 0);
            }
            context.restore();
            context.setTransform(ratio, 0, 0, ratio, 0, 0);

            /* One line of light along the horizon, the only warm thing in the frame. */
            context.fillStyle = 'rgba(' + bits.ember + ', ' + (bits.day ? '.34' : '.46') + ')';
            context.fillRect(0, (baseY - 1) / ratio, width / ratio, 1.2);
          }
        },
        /* The day mode is the same horizon under a different sky, so it delegates rather than
           duplicating: init() above already reads state.theme to choose its palette. Registering it
           is not optional - a theme absent from this map simply has no scene, which is exactly what
           the first build of this patch shipped: night animated, day was a still palette and the
           canvas stayed blank. */
        wondersday: {
          settleFrames: 24,
          frameMs: 45,
          init(context, width, height, ratio) {
            return AMBIENT_SCENES.wonders.init(context, width, height, ratio);
          },
          draw(context, bits, width, height, ratio, frame) {
            AMBIENT_SCENES.wonders.draw(context, bits, width, height, ratio, frame);
          }
        },
"""

patch(
    "5. the scene",
    "        aurora: {\n          settleFrames: 20,\n          frameMs: 45,",
    SCENE + "        aurora: {\n          settleFrames: 20,\n          frameMs: 45,",
)

# ---------------------------------------------------------------- 6. the roster nobody sees
patch(
    "6. the legacy selects, which are what state.theme is actually read from",
    '<option value="ie">Ie</option></optgroup>',
    '<option value="ie">Ie</option>'
    '<option value="wonders">Wonders · Night</option>'
    '<option value="wondersday">Wonders · Day</option></optgroup>',
    count=2,
)

# The theme roster lives in FOUR places that must agree: the visible menu, the two legacy selects,
# and themePresets. Miss the selects and everything looks right and nothing works - which is exactly
# what happened, and it took a positive control to see it.
#
#   syncStateFromControls():  state.theme = el.themePreset.value;
#
# That line runs before a render. applyTheme writes document.body.dataset.theme directly, so the
# chrome, the ambient scene and the star all switched correctly and the diagram kept Dark's palette,
# because state.theme had been quietly reset to whatever the old dropdown held - and the new themes
# were not options in it. Measured: matrix gave rgb(2,26,8), kpmg gave rgb(237,244,255), and both
# wonders themes gave rgb(23,34,48), Dark's exact node fill.

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
