#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SIREN - Anime Neon ultra rework, single installer.
Applies, in one all-or-nothing pass:
  1. PALETTE  - twilight-city token block, magic-hour surface ramps, horizon
                hairline under the header, cel top-edge rims, ambient veils,
                themePresets.anime, theme-menu swatch (5 guarded edits).
  2. SCENE    - replaces the anime AMBIENT_SCENES entry with THE TWILIGHT CITY
                (Shinkai establishing shot: magic-hour sky, cel cumulus, moon,
                lit city silhouette, telephone wires, viaduct train, petals).
  3. INTRO    - replaces the anime intro overlay markup + CSS with the episode
                title card (hard cut to the city, chroma-split title slam).

Guarantees:
  - Anchor-guarded: every edit verifies its anchors before anything is written.
    On any drift the target is left untouched and the script exits 1.
  - Idempotent: a step whose new content is already in place is skipped; if the
    whole file is already current the script exits 0 without writing.
  - Validated: after patching (in memory) every inline <script> block must pass
    node --check, or nothing is written.
  - Safe write: original is restored if the final write fails mid-way.

Usage: python install_anime.py <target.html>
"""
import io, os, re, subprocess, sys, tempfile

def fail(msg):
    print("INSTALL ABORTED (target untouched): " + msg)
    sys.exit(1)

# ============================ payloads ============================

PALETTE_EDITS = [
('anime token block',
r'''    [data-theme="anime"] {
      color-scheme: dark;
      --app-bg: #090d20;
      --panel-bg: #141a36;
      --panel-alt: #1b2346;
      --panel-elevated: #222b55;
      --sidebar-start: #151b38;
      --sidebar-end: #0b1027;
      --canvas-bg: #0a1026;
      --input-bg: #0f1631;
      --text: #fff4fb;
      --muted: #cdbdd9;
      --subtle: #aa9abc;
      --border: #404d78;
      --border-strong: #6678aa;
      --field-border: #5d668c;
      --primary: #ff6aa9;
      --primary-hover: #ff86ba;
      --primary-text: #2b0b1c;
      --secondary: #2a3868;
      --secondary-hover: #35477e;
      --secondary-text: #f5f8ff;
      --danger: #ffb3c7;
      --danger-strong: #ff5b86;
      --danger-bg: rgba(255,91,134,.15);
      --success: #a7f3d0;
      --success-bg: rgba(16,185,129,.15);
      --warning: #ffe6a7;
      --warning-bg: rgba(245,158,11,.15);
      --focus-ring: #7dd3fc;
      --code-text: #e9e4ff;
      --pill-text: #ffe5f2;
      --pill-bg: rgba(255,106,169,.17);
      --code-bg: #080e22;
      --deco-gold: #ff86ba;
      --shadow: 0 20px 55px rgba(4,7,22,.42);
      --shadow-soft: 0 9px 28px rgba(6,9,30,.30);
      --node-fill: #202b59;
      --node-text: #fff6fc;
      --node-border: #85c8ff;
      --node-accent: #472a62;
      --node-accent-border: #ff8abd;
      --line-color: #8edcff;
      --edge-label-bg: #2c315f;
    }''',
r'''    [data-theme="anime"] {
      /* Twilight city, last hour of light. Surfaces are the top of the sky
         (indigo-violet, never navy); the elevated tone leans warm the way a
         cloud lit from below does; the pink is the burning horizon, its ink a
         plum shadow (7.25:1, measured); --deco-gold is sodium streetlight. */
      color-scheme: dark;
      --app-bg: #0e0b28;
      --panel-bg: #191441;
      --panel-alt: #211a4d;
      --panel-elevated: #30235c;
      --sidebar-start: #1c1548;
      --sidebar-end: #0d0a26;
      --canvas-bg: #110e30;
      --input-bg: #151038;
      --text: #f7f2ff;
      --muted: #c9bce8;
      --subtle: #a89ad2;
      --border: #473d80;
      --border-strong: #7468b2;
      --field-border: #6b60a8;
      --primary: #ff7d9e;
      --primary-hover: #f26089;
      --primary-text: #33091d;
      --secondary: #2e2765;
      --secondary-hover: #3a327c;
      --secondary-text: #f2f2ff;
      --danger: #ffb3c1;
      --danger-strong: #ff5f7e;
      --danger-bg: rgba(255,95,126,.15);
      --success: #9ff0c8;
      --success-bg: rgba(36,205,150,.15);
      --warning: #ffd9a0;
      --warning-bg: rgba(245,158,11,.15);
      --focus-ring: #7fd8ff;
      --code-text: #e9e6ff;
      --pill-text: #ffdcea;
      --pill-bg: rgba(255,125,158,.16);
      --code-bg: #0c0a26;
      --deco-gold: #ffab52;
      --shadow: 0 20px 55px rgba(6,4,24,.48);
      --shadow-soft: 0 9px 28px rgba(6,4,24,.32);
      --node-fill: #221d50;
      --node-text: #fbf7ff;
      --node-border: #9fa8ff;
      --node-accent: #45205a;
      --node-accent-border: #ff8fae;
      --line-color: #aab2ff;
      --edge-label-bg: #2a2458;
    }'''),

('anime surface rules',
r'''    [data-theme="anime"] .app-header,
    [data-theme="anime"] .diagram-workspace-bar,
    [data-theme="anime"] .preview-card {
      box-shadow: 0 0 0 1px rgba(133,200,255,.10), 0 18px 45px rgba(255,106,169,.08);
      background-image: linear-gradient(135deg, rgba(255,106,169,.08), transparent 34%, rgba(125,211,252,.06));
    }''',
r'''    /* Anime surface: the ground is the magic-hour sky itself - indigo overhead
       falling through violet to one warm band low at the horizon - and raised
       surfaces take a 1px light top edge, the hard rim highlight of cel
       shading. The single beam under the header is the horizon line: sodium
       streetlight burning into sky pink into upper violet. */
    body[data-theme="anime"] {
      background-image: linear-gradient(180deg, #0d0a28 0%, #171040 46%, #2b174d 72%, #45204f 88%, #63284a 100%);
    }
    [data-theme="anime"] .preview-pane {
      background-image: linear-gradient(180deg, #100d2e 0%, #171040 52%, #2b174d 78%, #3f1f4e 92%, #542647 100%);
    }
    [data-theme="anime"] .wp-surface {
      background-image: linear-gradient(180deg, #110e30 0%, #191244 60%, #2b174d 90%, #381c4b 100%);
    }
    [data-theme="anime"] .app-header {
      border-bottom-color: transparent;
      background-image:
        linear-gradient(90deg, #ffab52 0%, #ff7d9e 38%, #b678d9 68%, #6f64c8 100%),
        linear-gradient(180deg, var(--panel-bg), var(--panel-alt));
      background-size: 100% 2px, 100% 100%;
      background-position: left bottom, left top;
      background-repeat: no-repeat;
      box-shadow: inset 0 1px 0 rgba(219,204,255,.14), var(--shadow-soft);
    }
    [data-theme="anime"] .diagram-workspace-bar {
      box-shadow: inset 0 1px 0 rgba(219,204,255,.10), 0 5px 18px rgba(4,3,18,.35);
    }
    [data-theme="anime"] .card {
      box-shadow: inset 0 1px 0 rgba(219,204,255,.16), var(--shadow-soft);
    }
    [data-theme="anime"] .preview-card {
      box-shadow: inset 0 1px 0 rgba(219,204,255,.18), var(--shadow),
        0 0 0 1px color-mix(in srgb, var(--border-strong) 30%, transparent);
    }
    [data-theme="anime"] .btn { box-shadow: inset 0 1px 0 rgba(255,255,255,.30); }
    [data-theme="anime"] .btn.secondary,
    [data-theme="anime"] .btn.danger { box-shadow: inset 0 1px 0 rgba(219,204,255,.14); }
    [data-theme="anime"] .btn.ghost { box-shadow: none; }
    /* The ambient veil sets the 'background' SHORTHAND at higher specificity
       (see the KPMG note by the veil rules), which would erase the horizon
       beam: restate it over the veil colour, scene still showing through. */
    body[data-ambient="on"][data-theme="anime"] .app-header {
      background-color: var(--ambient-bar, var(--panel-bg));
      background-image: linear-gradient(90deg, #ffab52 0%, #ff7d9e 38%, #b678d9 68%, #6f64c8 100%);
      background-size: 100% 2px;
      background-position: left bottom;
      background-repeat: no-repeat;
    }'''),

('anime ambient veil',
r'''[data-theme="anime"]     { --ambient-opacity: .88; --ambient-card: rgba(10, 16, 38, .62);    --ambient-bar: rgba(20, 26, 54, .90);     --ambient-pane: rgba(21, 27, 56, .88); }''',
r'''[data-theme="anime"]     { --ambient-opacity: .88; --ambient-card: rgba(19, 14, 48, .62);    --ambient-bar: rgba(26, 19, 58, .90);     --ambient-pane: rgba(27, 20, 60, .88); }'''),

('themePresets.anime',
r'''        anime: {
          canvasBg: '#0a1026', text: '#fff4fb', muted: '#cdbdd9',
          nodeFill: '#202b59', nodeText: '#fff6fc', nodeBorder: '#85c8ff',
          nodeAccent: '#472a62', nodeAccentBorder: '#ff8abd', line: '#8edcff', edgeLabel: '#2c315f'
        },''',
r'''        anime: {
          canvasBg: '#110e30', text: '#f7f2ff', muted: '#c9bce8',
          nodeFill: '#221d50', nodeText: '#fbf7ff', nodeBorder: '#9fa8ff',
          nodeAccent: '#45205a', nodeAccentBorder: '#ff8fae', line: '#aab2ff', edgeLabel: '#2a2458'
        },'''),

('theme menu swatch',
r'''--swatch-a:#090d20;--swatch-b:#ff6aa9''',
r'''--swatch-a:#171040;--swatch-b:#ff7d9e'''),

]


SCENE_FRAG = r'''        /* Anime — THE TWILIGHT CITY. The Shinkai establishing shot: a vast
           magic-hour sky falling from deep indigo through violet into a burning
           orange horizon, towering cumulus lit hard from below, a city in
           silhouette carrying thousands of window lights, telephone wires
           crossing the top-left corner, a huge low moon rising behind the
           skyline on the right, a distant train crossing an elevated viaduct
           every forty seconds, one plane strobing across the high sky. Sakura
           survives as a handful of dark petals drifting the frame — a garnish.

           Everything is cel-shaded: objects are flat fills with hard-edged
           two-tone steps (clouds are lit-rim + body + deep, the moon is disc +
           craters + a sunset-touched bottom rim). Only the SKY is a gradient,
           because the sky is light, not an object.

           Frame 1 is the finished picture: the whole city is already lit, every
           motion is a pure function of the frame number with a phase offset
           baked at init (clouds sway on a sine anchored at their station, the
           plane is mid-crossing, half the twinkle windows are mid-blink), and
           draw() mutates nothing. The clouds sway instead of streaming so the
           bright under-lit rims can never wander into the centre third; the
           reading box only ever contains sky quieter than #3d2f60, haze-violet
           far towers and dark petal silhouettes — measured worst-case contrast
           inside the centre third stays in the loved 1.0-1.45 band. */
        anime: {
          settleFrames: 4,
          frameMs: 40,
          init(context, width, height, ratio) {
            const W = width, H = height, R = ratio;
            const TAU = Math.PI * 2;
            const minWH = Math.min(W, H);
            const rnd = Math.random;
            const surf = (w, h) => {
              const c = document.createElement('canvas');
              c.width = Math.max(1, Math.round(w));
              c.height = Math.max(1, Math.round(h));
              return c;
            };

            /* ---------------------------------------------------------------
               PALETTE — every colour named once. The centre-third budget owns
               skyBoxFloor (brightest thing allowed in the reading box) and
               farB (darkest thing allowed in the reading box).
               --------------------------------------------------------------- */
            const P = {
              skyTop: '#0d1234', sky18: '#161a44', sky34: '#232253', sky50: '#2e2758',
              sky60: '#3a2c5e',
              skyBoxFloor: '#473162',                      /* at 0.665 H — box bottom */
              sky70: '#5e3a6b', sky735: '#7f4368', sky775: '#a84f60', sky815: '#d3675a',
              skyBurn: '#f08a55', horizon: '#ffb36e',
              star: '230,226,255', venus: '#fff4d6',
              moonBase: '#f6ddb2', moonRim: '#fff3d4', moonCrater: '#e3c493', moonHalo: '246,221,178',
              cloudLLit: '#ff9a72', cloudLMid: '#6e3a63', cloudLDeep: '#3a2a58',
              cloudHLit: '#c96a83', cloudHMid: '#4a3468', cloudHDeep: '#2c2452',
              cloudEdge: 'rgba(18,13,38,0.5)',
              wispLit: '#3a3166', wispBody: '#292350',     /* budget tones — may cross centre */
              moonWispLit: '#5c3a68', moonWispBody: '#241c44',
              streakLit: '#ff9a5e', streakLit2: '#ffa763', streakDark: '#5a2a4c',
              farA: '#332a5a', farB: '#241d48', farWin: 'rgba(150,120,170,0.4)',
              nearA: '#131028', nearB: '#16122e', roof: '#0f0c22', deck: '#0e0b20',
              winWarm: '#ffcf96', winAmber: '#ffab63', winCool: '#cfe0ff', winPink: '#ffd9e8',
              winFlash: '#fff2d9',
              beacon: '255,96,96',
              wire: '#0d0a1f',
              petal: 'rgba(52,32,60,0.5)',
              trainBody: '#0c0a1e', trainWin: '#ffd9a0', headlight: '#ffffff'
            };

            /* ---------------------------------------------------------------
               THE SKY — one vertical gradient, a warm dome low over the city,
               and cel streak-clouds riding the burn. All of it below 0.684 H
               stays clear of the centre-third box (box floor: 0.667 H).
               --------------------------------------------------------------- */
            const sky = surf(W, H);
            {
              const g = sky.getContext('2d');
              const grad = g.createLinearGradient(0, 0, 0, H);
              grad.addColorStop(0.00, P.skyTop);
              grad.addColorStop(0.18, P.sky18);
              grad.addColorStop(0.34, P.sky34);
              grad.addColorStop(0.50, P.sky50);
              grad.addColorStop(0.60, P.sky60);
              grad.addColorStop(0.665, P.skyBoxFloor);
              grad.addColorStop(0.70, P.sky70);
              grad.addColorStop(0.735, P.sky735);
              grad.addColorStop(0.775, P.sky775);
              grad.addColorStop(0.815, P.sky815);
              grad.addColorStop(0.858, P.skyBurn);
              grad.addColorStop(0.885, P.horizon);
              grad.addColorStop(1.00, P.horizon);
              g.fillStyle = grad;
              g.fillRect(0, 0, W, H);

              const dome = g.createRadialGradient(W * 0.42, H * 0.92, 0, W * 0.42, H * 0.92, H * 0.30);
              dome.addColorStop(0, 'rgba(255,150,90,0.26)');
              dome.addColorStop(1, 'rgba(255,150,90,0)');
              g.fillStyle = dome;
              g.fillRect(0, H * 0.63, W, H * 0.37);

              /* hard-edged lens clouds low over the horizon */
              const lens = (cx, cy, len, th, color) => {
                g.fillStyle = color;
                g.beginPath();
                g.moveTo(cx - len / 2, cy);
                g.quadraticCurveTo(cx, cy - th * 2, cx + len / 2, cy);
                g.quadraticCurveTo(cx, cy + th * 1.1, cx - len / 2, cy);
                g.closePath();
                g.fill();
              };
              lens(W * 0.30, H * 0.700, W * 0.30, H * 0.008, P.streakLit);
              lens(W * 0.63, H * 0.713, W * 0.36, H * 0.007, P.streakLit2);
              lens(W * 0.80, H * 0.703, W * 0.22, H * 0.006, P.streakLit);
              lens(W * 0.47, H * 0.740, W * 0.52, H * 0.006, P.streakDark);
              lens(W * 0.18, H * 0.760, W * 0.30, H * 0.005, P.streakDark);
            }

            /* ---------------------------------------------------------------
               STARS — twinkle by sine, never inside the reading box: high sky
               anywhere, lower sky only in the outer thirds. One first-star.
               --------------------------------------------------------------- */
            const stars = [];
            for (let i = 0; i < 130; i += 1) {
              const x = rnd() * W;
              const y = rnd() * H * 0.52;
              if (y > H * 0.30 && x > W * 0.295 && x < W * 0.705) continue;
              stars.push({
                x, y,
                r: (0.5 + rnd() * 0.9) * R,
                base: (0.2 + rnd() * 0.5) * (1 - y / (H * 0.75)),
                ph: rnd() * TAU,
                rate: 0.008 + rnd() * 0.03
              });
            }
            const venus = { x: W * 0.14, y: H * 0.47, r: 1.7 * R, ph: rnd() * TAU };

            /* ---------------------------------------------------------------
               THE MOON — huge and low on the right, rising behind the skyline.
               Cel: rim-lit disc + flat craters. Halo is clamped so it can
               never reach the centre third.
               --------------------------------------------------------------- */
            const moonR = Math.min(0.155 * minWH, 0.11 * W);
            const moonX = W * 0.84;
            const moonY = H * 0.42;
            const haloR = Math.min(moonR * 1.5, moonX - W * 0.705);
            const moonPad = Math.max(haloR, moonR) + 4 * R;
            const moonC = surf(moonPad * 2, moonPad * 2);
            {
              const g = moonC.getContext('2d');
              const c = moonPad;
              if (haloR > moonR * 1.05) {
                const halo = g.createRadialGradient(c, c, moonR * 0.6, c, c, haloR);
                halo.addColorStop(0, 'rgba(' + P.moonHalo + ',0.28)');
                halo.addColorStop(0.55, 'rgba(' + P.moonHalo + ',0.10)');
                halo.addColorStop(1, 'rgba(' + P.moonHalo + ',0)');
                g.fillStyle = halo;
                g.fillRect(0, 0, moonPad * 2, moonPad * 2);
              }
              g.fillStyle = P.moonRim;
              g.beginPath(); g.arc(c, c, moonR, 0, TAU); g.fill();
              g.save();
              g.beginPath(); g.arc(c, c, moonR, 0, TAU); g.clip();
              g.fillStyle = P.moonBase;
              g.beginPath(); g.arc(c, c - moonR * 0.07, moonR, 0, TAU); g.fill();
              g.fillStyle = P.moonCrater;
              [[-0.32, -0.28, 0.16], [0.18, -0.44, 0.10], [0.34, 0.03, 0.19],
               [-0.12, 0.24, 0.12], [0.04, 0.52, 0.14], [-0.46, 0.16, 0.09],
               [0.55, 0.38, 0.11], [-0.28, 0.58, 0.08]].forEach(k => {
                g.beginPath();
                g.arc(c + k[0] * moonR, c + k[1] * moonR, k[2] * moonR, 0, TAU);
                g.fill();
              });
              /* thin cel ring — the hard edge the halo is not allowed to soften */
              g.restore();
              g.strokeStyle = 'rgba(255,243,212,0.35)';
              g.lineWidth = 1.2 * R;
              g.beginPath(); g.arc(c, c, moonR + 2.2 * R, 0, TAU); g.stroke();
            }

            /* ---------------------------------------------------------------
               CUMULUS — circle-union silhouettes, three hard cel steps: fill
               the whole shape LIT, clip, refill shifted up MID, refill shifted
               further DEEP. Lit from below, like everything at this hour.
               Clouds SWAY on a slow sine instead of streaming so the bright
               rims stay stationed at the frame edges forever.
               --------------------------------------------------------------- */
            const buildCloud = (cw, ch, circles, lit, mid, deep) => {
              const c = surf(cw + 8 * R, ch + 8 * R);
              const g = c.getContext('2d');
              const trace = (dy) => {
                g.beginPath();
                circles.forEach(k => {
                  const rr = k[2] * ch;
                  g.moveTo(k[0] * cw + rr, k[1] * ch + dy + 4 * R);
                  g.arc(k[0] * cw, k[1] * ch + dy + 4 * R, rr, 0, TAU);
                });
              };
              trace(0); g.fillStyle = lit; g.fill();
              g.save();
              trace(0); g.clip();
              trace(-ch * 0.055); g.fillStyle = mid; g.fill();
              trace(-ch * 0.16); g.fillStyle = deep; g.fill();
              g.restore();
              trace(0); g.strokeStyle = P.cloudEdge; g.lineWidth = 1.2 * R; g.stroke();
              return c;
            };
            const buildLens = (len, th, lit, body) => {
              const c = surf(len + 6 * R, th * 3.4);
              const g = c.getContext('2d');
              const cy = th * 1.9;
              const shape = (dy) => {
                g.beginPath();
                g.moveTo(3 * R, cy + dy);
                g.quadraticCurveTo(len / 2, cy - th * 1.9 + dy, len - 3 * R, cy + dy);
                g.quadraticCurveTo(len / 2, cy + th * 1.2 + dy, 3 * R, cy + dy);
                g.closePath();
              };
              shape(0); g.fillStyle = lit; g.fill();
              g.save(); shape(0); g.clip();
              shape(-th * 0.5); g.fillStyle = body; g.fill();
              g.restore();
              return c;
            };

            const clouds = [];
            /* big left stack — sunset catches its whole underside */
            clouds.push({
              c: buildCloud(W * 0.28, H * 0.42, [
                [0.50, 0.16, 0.13], [0.32, 0.28, 0.12], [0.66, 0.30, 0.14],
                [0.22, 0.46, 0.11], [0.50, 0.44, 0.16], [0.74, 0.50, 0.12],
                [0.36, 0.62, 0.14], [0.60, 0.66, 0.15], [0.24, 0.74, 0.12],
                [0.48, 0.80, 0.15], [0.70, 0.80, 0.12], [0.86, 0.66, 0.09]
              ], P.cloudLLit, P.cloudLMid, P.cloudLDeep),
              x: -W * 0.055, y: H * 0.085, A: W * 0.014, om: TAU / 9500, ph: rnd() * TAU
            });
            /* high right bank — cooler, above the moon */
            clouds.push({
              c: buildCloud(W * 0.27, H * 0.20, [
                [0.16, 0.55, 0.30], [0.35, 0.40, 0.34], [0.56, 0.50, 0.36],
                [0.76, 0.42, 0.30], [0.92, 0.58, 0.24], [0.28, 0.72, 0.26],
                [0.62, 0.74, 0.28], [0.86, 0.74, 0.20]
              ], P.cloudHLit, P.cloudHMid, P.cloudHDeep),
              x: W * 0.745, y: H * 0.035, A: W * 0.012, om: TAU / 11000, ph: rnd() * TAU
            });
            /* slender wisp cutting the moon's lower third */
            clouds.push({
              c: buildLens(W * 0.20, H * 0.011, P.moonWispLit, P.moonWispBody),
              x: W * 0.755, y: H * 0.505, A: W * 0.009, om: TAU / 8000, ph: rnd() * TAU
            });
            /* two whisper-wisps allowed through the centre — budget tones only */
            clouds.push({
              c: buildLens(W * 0.15, H * 0.007, P.wispLit, P.wispBody),
              x: W * 0.37, y: H * 0.415, A: W * 0.008, om: TAU / 10500, ph: rnd() * TAU
            });
            clouds.push({
              c: buildLens(W * 0.11, H * 0.006, P.wispLit, P.wispBody),
              x: W * 0.52, y: H * 0.505, A: W * 0.008, om: TAU / 9000, ph: rnd() * TAU
            });

            /* ---------------------------------------------------------------
               THE CITY. Two far haze layers (violet, may rise into the reading
               box — they are inside the budget), then the near black layer
               whose towers are tall only in the outer thirds; every near
               building overlapping the centre band is clamped below the box.
               A rail viaduct spans the left half between two gate towers.
               --------------------------------------------------------------- */
            const farC = surf(W, H);
            const deckY = H * 0.782;
            const spanX0 = W * 0.115, spanX1 = W * 0.565;
            {
              const g = farC.getContext('2d');
              const layer = (topLo, topHi, color) => {
                g.fillStyle = color;
                let x = -W * 0.01;
                while (x < W * 1.01) {
                  const bw = W * (0.018 + rnd() * 0.040);
                  const top = H * (topLo + rnd() * (topHi - topLo));
                  g.fillRect(x, top, bw, H * 0.93 - top);
                  if (rnd() < 0.28) {
                    g.fillRect(x + bw * (0.2 + rnd() * 0.6), top - H * (0.008 + rnd() * 0.022), 1.2 * R, H * 0.03);
                  }
                  x += bw * (0.72 + rnd() * 0.26);
                }
              };
              layer(0.630, 0.720, P.farA);
              layer(0.605, 0.735, P.farB);
              /* dim mauve windows, strictly below the burn line */
              g.fillStyle = P.farWin;
              for (let i = 0; i < 420; i += 1) {
                g.fillRect(rnd() * W, H * (0.695 + rnd() * 0.16), 1.1 * R, 1.4 * R);
              }
              /* warm haze rising off the burn, melting the far layers */
              const haze = g.createLinearGradient(0, H * 0.685, 0, H * 0.87);
              haze.addColorStop(0, 'rgba(255,140,90,0)');
              haze.addColorStop(0.5, 'rgba(255,140,90,0.16)');
              haze.addColorStop(1, 'rgba(255,140,90,0.05)');
              g.fillStyle = haze;
              g.fillRect(0, H * 0.685, W, H * 0.185);
              /* the viaduct — deck, top rail, piers down into the haze */
              g.fillStyle = P.deck;
              g.fillRect(spanX0, deckY, spanX1 - spanX0, 2.6 * R);
              g.fillRect(spanX0, deckY - 2.2 * R, spanX1 - spanX0, 1.1 * R);
              for (let px = spanX0; px < spanX1; px += W * 0.052) {
                g.fillRect(px, deckY, 2 * R, H * 0.865 - deckY);
              }
            }

            const nearC = surf(W, H);
            const twinkle = [];
            const beacons = [];
            {
              const g = nearC.getContext('2d');
              const bldgs = [];
              let x = -W * 0.02;
              while (x < W * 1.02) {
                const bw = W * (0.022 + rnd() * 0.05);
                const cx = x + bw / 2;
                const edge = Math.abs(cx - W * 0.5) / (W * 0.5);
                let top;
                if (edge > 0.62) top = H * (0.47 + rnd() * 0.19);
                else if (edge > 0.42) top = H * (0.60 + rnd() * 0.12);
                else top = H * (0.70 + rnd() * 0.10);
                if (x < W * 0.71 && x + bw > W * 0.29) top = Math.max(top, H * 0.672);
                bldgs.push({ x, w: bw, top });
                x += bw * (0.72 + rnd() * 0.26);
              }
              /* hero spires at the edges + rail gate towers */
              bldgs.push({ x: W * 0.085, w: W * 0.045, top: H * 0.415, hero: true });
              bldgs.push({ x: W * 0.875, w: W * 0.05, top: H * 0.44, hero: true });
              bldgs.push({ x: W * 0.928, w: W * 0.038, top: H * 0.50 });
              bldgs.push({ x: W * 0.050, w: W * 0.062, top: H * 0.615 });
              bldgs.push({ x: W * 0.562, w: W * 0.068, top: H * 0.672 });

              const winColors = [P.winWarm, P.winWarm, P.winWarm, P.winWarm, P.winWarm,
                                 P.winAmber, P.winAmber, P.winCool, P.winCool, P.winPink];
              let winCount = 0;
              bldgs.forEach((b, bi) => {
                const body = bi % 2 ? P.nearB : P.nearA;
                g.fillStyle = body;
                g.fillRect(b.x, b.top, b.w, H - b.top);
                /* rooftop furniture — parapet, water tower, antenna, spire */
                g.fillStyle = P.roof;
                g.fillRect(b.x, b.top - 1.6 * R, b.w * (0.2 + rnd() * 0.3), 1.6 * R);
                if (b.hero) {
                  g.fillStyle = body;
                  const sx = b.x + b.w / 2;
                  g.beginPath();
                  g.moveTo(b.x + b.w * 0.12, b.top);
                  g.lineTo(sx, b.top - H * 0.035);
                  g.lineTo(b.x + b.w * 0.88, b.top);
                  g.closePath(); g.fill();
                  g.fillRect(sx - 0.8 * R, b.top - H * 0.062, 1.6 * R, H * 0.062);
                  beacons.push({ x: sx, y: b.top - H * 0.062, ph: rnd() * TAU, rate: 0.028 + rnd() * 0.014 });
                } else if (rnd() < 0.16 && b.w > W * 0.03 && b.top < H * 0.75) {
                  const wtx = b.x + b.w * (0.2 + rnd() * 0.5);
                  g.fillRect(wtx, b.top - 6.5 * R, 6 * R, 5 * R);
                  g.fillRect(wtx + 1 * R, b.top - 1.5 * R, 1.2 * R, 1.5 * R);
                  g.fillRect(wtx + 3.8 * R, b.top - 1.5 * R, 1.2 * R, 1.5 * R);
                } else if (rnd() < 0.3) {
                  g.fillRect(b.x + b.w * (0.2 + rnd() * 0.6), b.top - H * 0.018, 1.2 * R, H * 0.018);
                }
                if (!b.hero && b.top < H * 0.56 && rnd() < 0.7) {
                  beacons.push({ x: b.x + b.w * 0.5, y: b.top - 2 * R, ph: rnd() * TAU, rate: 0.024 + rnd() * 0.014 });
                }
                /* windows — the thousands of lights, all already on */
                const pX = 4.2 * R, pY = 5.2 * R;
                const occupancy = 0.30 + rnd() * 0.38;
                for (let wy = b.top + 3.4 * R; wy < H * 0.92; wy += pY) {
                  for (let wx = b.x + 1.8 * R; wx < b.x + b.w - 3 * R; wx += pX) {
                    if (rnd() > occupancy) continue;
                    if (wy < H * 0.685 && wx > W * 0.295 && wx < W * 0.705) continue; /* box guard */
                    const col = winColors[Math.floor(rnd() * winColors.length)];
                    g.globalAlpha = 0.7 + rnd() * 0.3;
                    g.fillStyle = col;
                    g.fillRect(wx, wy, 2.0 * R, 2.6 * R);
                    winCount += 1;
                    if (winCount % 41 === 0 && twinkle.length < 120 && (wy > H * 0.69 || wx < W * 0.29 || wx > W * 0.71)) {
                      twinkle.push({ x: wx, y: wy, body, ph: rnd() * TAU, rate: 0.006 + rnd() * 0.022 });
                    }
                  }
                }
                g.globalAlpha = 1;
              });
            }

            /* ---------------------------------------------------------------
               TELEPHONE WIRES — the top-left corner, pole, crossarms, four
               sagging catenaries, three birds settled for the evening.
               --------------------------------------------------------------- */
            const wiresC = surf(W, Math.round(H * 0.36));
            {
              const g = wiresC.getContext('2d');
              const px = W * 0.052;
              g.fillStyle = P.wire;
              g.fillRect(px - 1.6 * R, H * 0.012, 3.2 * R, H * 0.318);
              g.fillRect(px - W * 0.023, H * 0.050, W * 0.046, 2.2 * R);
              g.fillRect(px - W * 0.023, H * 0.088, W * 0.046, 2.2 * R);
              g.fillRect(px - W * 0.019, H * 0.046, 2 * R, 4 * R);
              g.fillRect(px + W * 0.016, H * 0.046, 2 * R, 4 * R);
              g.strokeStyle = P.wire;
              g.lineWidth = 1.4 * R;
              g.lineCap = 'round';
              const wireDefs = [
                [0.030, 0.054, 0.19, 0.076, 0.36, -0.015],
                [0.074, 0.054, 0.24, 0.086, 0.42, -0.010],
                [0.030, 0.092, 0.16, 0.106, 0.30, -0.020],
                [0.074, 0.092, 0.27, 0.112, 0.47, -0.015]
              ];
              wireDefs.forEach(d => {
                g.beginPath();
                g.moveTo(W * d[0], H * d[1]);
                g.quadraticCurveTo(W * d[2], H * d[3], W * d[4], H * d[5]);
                g.stroke();
              });
              /* birds on wire 2 */
              const bez = (t, a, c, b) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
              [0.16, 0.21, 0.30].forEach((t, i) => {
                const bx = bez(t, W * 0.074, W * 0.24, W * 0.42);
                const by = bez(t, H * 0.054, H * 0.086, H * -0.010);
                g.fillStyle = P.wire;
                g.beginPath();
                g.arc(bx, by - 2.4 * R, 2.3 * R, 0, TAU);
                g.fill();
                g.beginPath();
                g.moveTo(bx + (i === 1 ? -1 : 1) * 1.5 * R, by - 2.6 * R);
                g.lineTo(bx + (i === 1 ? -5 : 5) * R, by - 1.2 * R);
                g.lineTo(bx + (i === 1 ? -1 : 1) * 1.5 * R, by - 1.0 * R);
                g.closePath(); g.fill();
              });
            }

            /* ---------------------------------------------------------------
               THE TRAIN — sprite once, then a pure clock: crosses the viaduct
               in ~8 s, returns every 40 s. Absent at frame 1; the picture is
               finished without it.
               --------------------------------------------------------------- */
            const trainH = Math.max(3.2 * R, H * 0.0058);
            const trainL = W * 0.085;
            const trainC = surf(trainL, trainH * 2.2);
            {
              const g = trainC.getContext('2d');
              g.fillStyle = P.trainBody;
              g.fillRect(0, trainH * 0.5, trainL, trainH);
              g.fillStyle = P.trainWin;
              const n = Math.floor(trainL / (6.4 * R));
              for (let i = 0; i < n; i += 1) {
                if (i % 7 === 6) continue;
                g.fillRect(2 * R + i * 6.4 * R, trainH * 0.72, 3.0 * R, trainH * 0.5);
              }
              g.fillStyle = P.headlight;
              g.fillRect(trainL - 1.6 * R, trainH * 0.9, 1.6 * R, 1.8 * R);
            }
            const trainCycle = 1000;
            const trainSpeed = (spanX1 - spanX0 + trainL * 2) / 195;

            /* ---------------------------------------------------------------
               GARNISH — seven dark petals on wrapped linear drift + sway, and
               one plane strobing across the high sky. Pure functions of frame.
               --------------------------------------------------------------- */
            const petals = Array.from({ length: 7 }, () => ({
              x0: rnd() * W, y0: rnd() * H,
              vx: (0.25 + rnd() * 0.45) * R, vy: (0.35 + rnd() * 0.55) * R,
              size: (3.5 + rnd() * 3.5) * R,
              ph: rnd() * TAU, srate: 0.01 + rnd() * 0.02, span: (10 + rnd() * 22) * R,
              sp: rnd() * TAU, srot: (rnd() - 0.5) * 0.05
            }));

            return {
              sky, moonC, moonX, moonY, moonPad, farC, nearC, wiresC, trainC,
              clouds, stars, venus, petals, twinkle, beacons,
              deckY, spanX0, spanX1, trainL, trainH, trainCycle, trainSpeed,
              planeCycle: 2600, planeOff: 1400, trainOff: trainCycle - 300
            };
          },
          draw(context, bits, width, height, ratio, frame) {
            const W = width, H = height, R = ratio, f = frame;
            const TAU = Math.PI * 2;

            context.drawImage(bits.sky, 0, 0);

            /* stars breathe; nothing ever fully off */
            bits.stars.forEach(s => {
              context.globalAlpha = Math.max(0.05, s.base * (0.72 + 0.28 * Math.sin(f * s.rate + s.ph)));
              context.fillStyle = 'rgb(230,226,255)';
              context.fillRect(s.x, s.y, s.r * 2, s.r * 2);
            });
            context.globalAlpha = 0.75 + 0.2 * Math.sin(f * 0.02 + bits.venus.ph);
            context.fillStyle = '#fff4d6';
            context.beginPath();
            context.arc(bits.venus.x, bits.venus.y, bits.venus.r, 0, TAU);
            context.fill();
            context.globalAlpha = 1;

            context.drawImage(bits.moonC, bits.moonX - bits.moonPad, bits.moonY - bits.moonPad);

            /* clouds sway at their stations — drift felt, never seen */
            bits.clouds.forEach(c => {
              context.drawImage(c.c, c.x + Math.sin(f * c.om + c.ph) * c.A, c.y);
            });

            context.drawImage(bits.farC, 0, 0);

            /* the 8:40 to somewhere else */
            const tPos = bits.spanX0 - bits.trainL +
              ((f + bits.trainOff) % bits.trainCycle) * bits.trainSpeed;
            if (tPos < bits.spanX1 + bits.trainL * 0.2) {
              context.drawImage(bits.trainC, tPos, bits.deckY - bits.trainH * 1.55);
            }

            context.drawImage(bits.nearC, 0, 0);

            /* window twinkle — a city living, already fully lit at frame 1 */
            bits.twinkle.forEach(t => {
              const s = Math.sin(f * t.rate + t.ph);
              if (s < -0.55) {
                context.fillStyle = t.body;
                context.fillRect(t.x - 0.5, t.y - 0.5, 2.0 * R + 1, 2.6 * R + 1);
              } else if (s > 0.93) {
                context.fillStyle = '#fff2d9';
                context.fillRect(t.x, t.y, 2.0 * R, 2.6 * R);
              }
            });

            /* aircraft-warning beacons on the tall towers */
            bits.beacons.forEach(b => {
              const p = Math.max(0, Math.sin(f * b.rate + b.ph));
              context.globalAlpha = 0.15 + 0.8 * p * p * p * p;
              context.fillStyle = 'rgb(255,96,96)';
              context.beginPath();
              context.arc(b.x, b.y, 1.7 * R, 0, TAU);
              context.fill();
            });
            context.globalAlpha = 1;

            context.drawImage(bits.wiresC, 0, 0);

            /* petals — dark silhouettes drifting the frame */
            const MX = 80 * R, MY = 80 * R;
            const SW = W + 2 * MX, SH = H + 2 * MY;
            context.fillStyle = 'rgba(52,32,60,0.5)';
            bits.petals.forEach(p => {
              const xx = (((p.x0 + p.vx * f) % SW) + SW) % SW - MX + Math.sin(f * p.srate + p.ph) * p.span;
              const yy = (((p.y0 + p.vy * f) % SH) + SH) % SH - MY;
              context.save();
              context.translate(xx, yy);
              context.rotate(p.sp + f * p.srot);
              context.beginPath();
              context.moveTo(0, -p.size);
              context.quadraticCurveTo(p.size * 0.92, -p.size * 0.3, 0, p.size);
              context.quadraticCurveTo(-p.size * 0.92, -p.size * 0.3, 0, -p.size);
              context.closePath();
              context.fill();
              context.restore();
            });

            /* one plane, high and far, strobing its way across */
            const pt = ((f + bits.planeOff) % bits.planeCycle) / bits.planeCycle;
            const pxx = W * (1.03 - pt * 1.06);
            const pyy = H * (0.065 + pt * 0.12);
            context.globalAlpha = 0.35;
            context.fillStyle = '#ffffff';
            context.fillRect(pxx, pyy, 1.4 * R, 1.4 * R);
            if (f % 24 < 3) {
              context.globalAlpha = 0.9;
              context.fillStyle = 'rgb(255,96,96)';
              context.fillRect(pxx - 1.2 * R, pyy - 0.6 * R, 2.6 * R, 2.6 * R);
            }
            context.globalAlpha = 1;
          }
        },'''


INTRO_HTML = r'''  <div class="theme-intro-overlay anime-intro-overlay" id="animeIntroOverlay" hidden>
    <svg class="anime-intro-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="aiv-sky" x1="0" y1="0" x2="0" y2="900" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#0a0e2a"/>
          <stop offset=".22" stop-color="#1b1a44"/>
          <stop offset=".42" stop-color="#35235c"/>
          <stop offset=".58" stop-color="#59306e"/>
          <stop offset=".68" stop-color="#8f3f72"/>
          <stop offset=".74" stop-color="#cf5a63"/>
          <stop offset=".765" stop-color="#ff8752"/>
          <stop offset=".772" stop-color="#ffb469"/>
          <stop offset=".776" stop-color="#241536"/>
          <stop offset="1" stop-color="#120b22"/>
        </linearGradient>
        <radialGradient id="aiv-hglow">
          <stop offset="0" stop-color="#ffc57a" stop-opacity=".55"/>
          <stop offset=".5" stop-color="#ff9d6a" stop-opacity=".22"/>
          <stop offset="1" stop-color="#ff9d6a" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="aiv-mglow">
          <stop offset="0" stop-color="#ffdca0" stop-opacity=".38"/>
          <stop offset=".55" stop-color="#ffcf92" stop-opacity=".14"/>
          <stop offset="1" stop-color="#ffcf92" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="aiv-tglow">
          <stop offset="0" stop-color="#ffd9a0" stop-opacity=".5"/>
          <stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="aiv-fade" x1="0" y1="730" x2="0" y2="900" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#0b081a" stop-opacity="0"/>
          <stop offset="1" stop-color="#0b081a" stop-opacity=".95"/>
        </linearGradient>
        <pattern id="aiv-wa" width="17" height="26" patternUnits="userSpaceOnUse">
          <rect x="4" y="9" width="3.4" height="5.4" fill="#ffd9a0"/>
        </pattern>
        <pattern id="aiv-wb" width="23" height="31" patternUnits="userSpaceOnUse">
          <rect x="12" y="6" width="2.8" height="4.6" fill="#ffb0c8"/>
        </pattern>
        <g id="aiv-cityN">
          <rect x="0" y="585" width="120" height="315"/>
          <rect x="105" y="630" width="90" height="270"/>
          <rect x="180" y="555" width="140" height="345"/>
          <rect x="305" y="615" width="95" height="285"/>
          <rect x="385" y="640" width="130" height="260"/>
          <rect x="500" y="570" width="85" height="330"/>
          <rect x="570" y="655" width="120" height="245"/>
          <rect x="690" y="668" width="70" height="232"/>
          <rect x="758" y="700" width="174" height="200"/>
          <rect x="930" y="600" width="110" height="300"/>
          <rect x="1030" y="645" width="85" height="255"/>
          <rect x="1100" y="560" width="150" height="340"/>
          <rect x="1240" y="620" width="100" height="280"/>
          <rect x="1330" y="575" width="120" height="325"/>
          <rect x="1440" y="605" width="160" height="295"/>
        </g>
        <g id="aiv-cloudA">
          <circle cx="100" cy="590" r="72"/>
          <circle cx="180" cy="565" r="95"/>
          <circle cx="275" cy="530" r="95"/>
          <circle cx="370" cy="565" r="68"/>
          <circle cx="455" cy="605" r="42"/>
          <circle cx="150" cy="480" r="72"/>
          <circle cx="245" cy="440" r="84"/>
          <circle cx="330" cy="470" r="60"/>
          <circle cx="205" cy="365" r="58"/>
          <circle cx="275" cy="395" r="52"/>
          <circle cx="170" cy="398" r="46"/>
          <circle cx="240" cy="318" r="46"/>
        </g>
        <g id="aiv-cloudB">
          <circle cx="960" cy="618" r="48"/>
          <circle cx="1030" cy="600" r="58"/>
          <circle cx="1098" cy="614" r="46"/>
        </g>
        <g id="aiv-cloudC">
          <circle cx="1500" cy="610" r="54"/>
          <circle cx="1568" cy="620" r="46"/>
          <circle cx="60" cy="632" r="40"/>
          <circle cx="120" cy="640" r="46"/>
        </g>
      </defs>
      <rect x="0" y="0" width="1600" height="900" fill="url(#aiv-sky)"/>
      <ellipse cx="760" cy="690" rx="640" ry="270" fill="url(#aiv-hglow)"/>
      <g fill="#ffffff">
        <circle cx="120" cy="60" r="1.4" opacity=".7"/><circle cx="260" cy="140" r="1.1" opacity=".5"/>
        <circle cx="340" cy="80" r="1.6" opacity=".8"/><circle cx="520" cy="50" r="1.2" opacity=".6"/>
        <circle cx="610" cy="150" r="1" opacity=".45"/><circle cx="700" cy="90" r="1.5" opacity=".7"/>
        <circle cx="860" cy="60" r="1.2" opacity=".55"/><circle cx="940" cy="170" r="1" opacity=".4"/>
        <circle cx="1050" cy="110" r="1.6" opacity=".75"/><circle cx="1180" cy="70" r="1.2" opacity=".55"/>
        <circle cx="1290" cy="150" r="1" opacity=".45"/><circle cx="1380" cy="90" r="1.5" opacity=".7"/>
        <circle cx="1500" cy="140" r="1.2" opacity=".55"/><circle cx="1560" cy="60" r="1" opacity=".5"/>
        <circle cx="80" cy="210" r="1" opacity=".4"/><circle cx="430" cy="230" r="1.1" opacity=".45"/>
        <circle cx="760" cy="220" r="1.2" opacity=".5"/><circle cx="1120" cy="230" r="1" opacity=".4"/>
        <circle cx="1460" cy="240" r="1.1" opacity=".45"/><circle cx="200" cy="300" r=".9" opacity=".3"/>
        <circle cx="980" cy="290" r=".9" opacity=".3"/><circle cx="1540" cy="320" r=".9" opacity=".3"/>
      </g>
      <g>
        <circle cx="452" cy="196" r="9" fill="#ffd0e8" opacity=".25"/>
        <rect x="451.2" y="180" width="1.6" height="32" fill="#ffffff" opacity=".7"/>
        <rect x="436" y="195.2" width="32" height="1.6" fill="#ffffff" opacity=".7"/>
        <circle cx="452" cy="196" r="3" fill="#ffffff" opacity=".95"/>
      </g>
      <rect x="880" y="168" width="430" height="9" rx="4.5" fill="#2c1f4e"/>
      <rect x="940" y="180" width="300" height="5" rx="2.5" fill="#c05a80" opacity=".6"/>
      <rect x="110" y="120" width="360" height="8" rx="4" fill="#2c1f4e"/>
      <rect x="165" y="131" width="240" height="4.5" rx="2.2" fill="#b0507a" opacity=".6"/>
      <circle cx="1215" cy="655" r="210" fill="url(#aiv-mglow)"/>
      <circle cx="1215" cy="655" r="130" fill="#ffe9c4"/>
      <circle cx="1282" cy="600" r="18" fill="#f0d3a0" opacity=".85"/>
      <circle cx="1260" cy="560" r="11" fill="#f0d3a0" opacity=".85"/>
      <g fill="#ffab7e"><use href="#aiv-cloudA"/></g>
      <g fill="#3d2454" transform="translate(0,-18)"><use href="#aiv-cloudA"/></g>
      <g fill="#ff8f9e"><use href="#aiv-cloudB"/></g>
      <g fill="#33204a" transform="translate(0,-15)"><use href="#aiv-cloudB"/></g>
      <g fill="#ff8f9e"><use href="#aiv-cloudC"/></g>
      <g fill="#33204a" transform="translate(0,-15)"><use href="#aiv-cloudC"/></g>
      <g fill="#241b42">
        <rect x="250" y="626" width="80" height="80"/>
        <rect x="470" y="640" width="60" height="66"/>
        <rect x="600" y="632" width="60" height="74"/>
        <rect x="660" y="610" width="80" height="96"/>
        <rect x="745" y="640" width="70" height="66"/>
        <rect x="815" y="618" width="90" height="88"/>
        <rect x="900" y="636" width="70" height="70"/>
        <rect x="1210" y="622" width="90" height="84"/>
      </g>
      <ellipse cx="730" cy="660" rx="95" ry="18" fill="url(#aiv-tglow)" opacity=".6"/>
      <rect x="600" y="662" width="340" height="5" fill="#0e0a1f"/>
      <rect x="636" y="667" width="6" height="38" fill="#0e0a1f"/>
      <rect x="716" y="667" width="6" height="38" fill="#0e0a1f"/>
      <rect x="796" y="667" width="6" height="38" fill="#0e0a1f"/>
      <rect x="876" y="667" width="6" height="38" fill="#0e0a1f"/>
      <rect x="640" y="646" width="170" height="12" rx="3" fill="#16102b"/>
      <g fill="#ffd9a0">
        <rect x="648" y="649" width="10" height="6"/><rect x="670" y="649" width="10" height="6"/>
        <rect x="692" y="649" width="10" height="6"/><rect x="714" y="649" width="10" height="6"/>
        <rect x="736" y="649" width="10" height="6"/><rect x="758" y="649" width="10" height="6"/>
        <rect x="780" y="649" width="10" height="6"/>
      </g>
      <g fill="#0e0a1f"><use href="#aiv-cityN"/></g>
      <g fill="url(#aiv-wa)" opacity=".72"><use href="#aiv-cityN"/></g>
      <g fill="url(#aiv-wb)" opacity=".5"><use href="#aiv-cityN"/></g>
      <rect x="1172" y="505" width="4" height="55" fill="#0e0a1f"/>
      <circle cx="1174" cy="502" r="3.2" fill="#ff5b86"/>
      <rect x="0" y="730" width="1600" height="170" fill="url(#aiv-fade)"/>
    </svg>
    <svg class="anime-intro-wires" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <g fill="#070512">
        <rect x="1358" y="0" width="13" height="330"/>
        <rect x="1306" y="84" width="116" height="7"/>
        <rect x="1316" y="148" width="96" height="6"/>
        <rect x="1310" y="76" width="5" height="9"/>
        <rect x="1417" y="76" width="5" height="9"/>
        <rect x="1320" y="140" width="5" height="9"/>
        <rect x="1407" y="140" width="5" height="9"/>
      </g>
      <g fill="none" stroke="#070512" stroke-width="3" opacity=".92">
        <path d="M 1417 88 Q 680 240 -40 132"/>
        <path d="M 1309 88 Q 620 296 -40 184"/>
        <path d="M 1405 152 Q 740 330 -40 258"/>
        <path d="M 1321 152 Q 580 378 -40 326"/>
      </g>
      <path d="M 1640 60 Q 1100 130 -40 96" fill="none" stroke="#070512" stroke-width="2" opacity=".6"/>
    </svg>
    <div class="anime-intro-vignette" aria-hidden="true"></div>
    <div class="anime-intro-streak" aria-hidden="true"></div>
    <div class="anime-intro-flash" aria-hidden="true"></div>
    <div class="anime-intro-bars" aria-hidden="true"></div>
    <div class="theme-intro-card">
      <div class="theme-intro-kanji anime-intro-mark"><b>&#31532;&#19968;&#35441;&#12300;&#40644;&#26127;&#12301;</b></div>
      <div class="theme-intro-title"><u aria-hidden="true">SIREN // ANIME NEON</u><s aria-hidden="true">SIREN // ANIME NEON</s><b>SIREN // ANIME NEON</b></div>
      <div class="theme-intro-progress"><i></i></div>
    </div>
  </div>'''


INTRO_CSS = r'''/* ---- ANIME intro: episode title card - hard cut to the twilight city, the name slams in on one beat ---- */
    /* Live colours ride the theme tokens (body[data-theme="anime"]) with literal fallbacks. */
    .anime-intro-overlay {
      --ai-pink: var(--primary, #ff6aa9);
      --ai-cyan: var(--focus-ring, #7dd3fc);
      --ai-warm: #ffb46a;
      background: #10122e;
      isolation: isolate;
    }
    /* Hard cut in place of the shared fade-up: opacity 1 on the first frame, same 1.7s
       clock so the shared exit still leaves at ~1.33s and the engine stop at 1750ms matches. */
    .anime-intro-overlay.is-running { animation: anime-cut-in 1.7s linear forwards; }
    @keyframes anime-cut-in { 0% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; } }
    /* The establishing shot: one inline SVG, bottom-anchored cover crop. */
    .anime-intro-scene,
    .anime-intro-wires {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
    }
    .anime-intro-wires { z-index: 2; transform: translateY(-14px); }
    .anime-intro-overlay.is-running .anime-intro-wires { animation: anime-wire-settle .64s cubic-bezier(.2, .82, .3, 1) forwards; }
    @keyframes anime-wire-settle {
      0%   { transform: translateY(-14px); }
      55%  { transform: translateY(3px); }
      100% { transform: translateY(0); }
    }
    /* Frame-edge falloff, under the card. */
    .anime-intro-vignette {
      position: absolute;
      inset: 0;
      z-index: 3;
      background: radial-gradient(120% 92% at 50% 46%, transparent 52%, rgba(5, 3, 14, .34) 82%, rgba(5, 3, 14, .58) 100%);
      pointer-events: none;
    }
    /* Horizontal speed-line wipe that drives the title in - one whoosh, then gone. */
    .anime-intro-streak {
      position: absolute;
      left: -50%;
      top: 29%;
      width: 200%;
      height: 42%;
      z-index: 4;
      background:
        repeating-linear-gradient(180deg, transparent 0 12px, rgba(255, 244, 232, .20) 12px 13.6px, transparent 13.6px 30px),
        repeating-linear-gradient(180deg, transparent 0 21px, rgba(255, 178, 150, .16) 21px 22.4px, transparent 22.4px 47px);
      -webkit-mask-image: linear-gradient(90deg, transparent 6%, #000 30%, #000 70%, transparent 94%);
              mask-image: linear-gradient(90deg, transparent 6%, #000 30%, #000 70%, transparent 94%);
      opacity: 0;
      transform: translateX(-24%);
      pointer-events: none;
    }
    .anime-intro-overlay.is-running .anime-intro-streak { animation: anime-streak-wipe .30s cubic-bezier(.32, .12, .22, 1) .32s forwards; }
    @keyframes anime-streak-wipe {
      0%   { opacity: 0; transform: translateX(-24%); }
      12%  { opacity: 1; }
      85%  { opacity: .85; }
      100% { opacity: 0; transform: translateX(24%); }
    }
    /* One-beat impact flash under the slam. Opacity only - no filter animation. */
    .anime-intro-flash {
      position: absolute;
      inset: 0;
      z-index: 8;
      background: radial-gradient(62% 52% at 50% 48%, rgba(255, 240, 225, .9), rgba(255, 190, 150, .34) 55%, transparent 80%);
      opacity: 0;
      pointer-events: none;
    }
    .anime-intro-overlay.is-running .anime-intro-flash { animation: anime-cut-flash .22s linear .40s forwards; }
    @keyframes anime-cut-flash {
      0%   { opacity: 0; }
      20%  { opacity: .2; }
      100% { opacity: 0; }
    }
    /* Cinema letterbox - present from frame one, like the cut itself. */
    .anime-intro-bars { position: absolute; inset: 0; z-index: 7; pointer-events: none; }
    .anime-intro-bars::before,
    .anime-intro-bars::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: clamp(44px, 7.5vh, 76px);
      background: #030209;
    }
    .anime-intro-bars::before { top: 0; }
    .anime-intro-bars::after { bottom: 0; }
    .anime-intro-overlay .theme-intro-card { position: relative; z-index: 5; gap: 16px; }
    /* Episode marker line: small kanji between hairline rules. */
    .anime-intro-overlay .theme-intro-kanji {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 15px;
      line-height: 1;
      font-weight: 600;
      letter-spacing: .42em;
      text-indent: .42em;
      color: #ffd3a4;
      text-shadow: 0 1px 8px rgba(18, 8, 32, .85);
      opacity: 0;
      transform: translateY(8px);
    }
    .anime-intro-overlay .theme-intro-kanji b { font-weight: 600; }
    .anime-intro-mark::before,
    .anime-intro-mark::after {
      content: '';
      width: 44px;
      height: 1px;
      flex: none;
    }
    .anime-intro-mark::before { background: linear-gradient(90deg, transparent, rgba(255, 211, 164, .75)); }
    .anime-intro-mark::after  { background: linear-gradient(270deg, transparent, rgba(255, 211, 164, .75)); }
    .anime-intro-overlay.is-running .theme-intro-kanji { animation: anime-ep-in .26s ease-out .10s forwards; }
    @keyframes anime-ep-in { to { opacity: 1; transform: none; } }
    /* The title. Three stacked copies: pink and cyan converge for a single beat, white lands. */
    .anime-intro-overlay .theme-intro-title {
      position: relative;
      display: grid;
      font-size: clamp(26px, 4.6vw, 48px);
      line-height: 1.12;
      font-weight: 900;
      letter-spacing: .16em;
      text-indent: .16em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .anime-intro-overlay .theme-intro-title b,
    .anime-intro-overlay .theme-intro-title u,
    .anime-intro-overlay .theme-intro-title s {
      grid-area: 1 / 1;
      display: block;
      font-weight: 900;
      font-style: normal;
      text-decoration: none;
      opacity: 0;
    }
    .anime-intro-overlay .theme-intro-title b {
      color: #fff8ef;
      text-shadow: 0 2px 16px rgba(18, 8, 32, .8), 0 0 34px rgba(255, 150, 96, .3);
    }
    .anime-intro-overlay .theme-intro-title u { color: var(--ai-pink); mix-blend-mode: screen; transform: translate(-14px, 4px) scale(1.36); }
    .anime-intro-overlay .theme-intro-title s { color: var(--ai-cyan); mix-blend-mode: screen; transform: translate(14px, -4px) scale(1.36); }
    .anime-intro-overlay.is-running .theme-intro-title b { animation: anime-title-slam .24s cubic-bezier(.18, .9, .22, 1) .40s forwards; }
    .anime-intro-overlay.is-running .theme-intro-title u { animation: anime-chroma-l .24s cubic-bezier(.18, .9, .22, 1) .40s forwards; }
    .anime-intro-overlay.is-running .theme-intro-title s { animation: anime-chroma-r .24s cubic-bezier(.18, .9, .22, 1) .40s forwards; }
    @keyframes anime-title-slam {
      0%   { opacity: 0; transform: scale(1.36); }
      10%  { opacity: 1; transform: scale(1.32); }
      58%  { opacity: 1; transform: scale(.97); }
      100% { opacity: 1; transform: scale(1); }
    }
    /* The coloured copies ride the same scale curve as the white copy, so the offset
       reads as one glyph splitting and converging - not a second smaller title. */
    @keyframes anime-chroma-l {
      0%   { opacity: 0; transform: translate(-14px, 4px) scale(1.36); }
      10%  { opacity: .95; transform: translate(-11px, 3px) scale(1.32); }
      58%  { opacity: .45; transform: translate(-3px, 1px) scale(.97); }
      80%  { opacity: 0; transform: translate(0, 0) scale(.985); }
      100% { opacity: 0; transform: scale(1); }
    }
    @keyframes anime-chroma-r {
      0%   { opacity: 0; transform: translate(14px, -4px) scale(1.36); }
      10%  { opacity: .95; transform: translate(11px, -3px) scale(1.32); }
      58%  { opacity: .45; transform: translate(3px, -1px) scale(.97); }
      80%  { opacity: 0; transform: translate(0, 0) scale(.985); }
      100% { opacity: 0; transform: scale(1); }
    }
    .anime-intro-overlay .theme-intro-progress { background: rgba(255, 205, 160, .18); }
    .anime-intro-overlay .theme-intro-progress i {
      background: linear-gradient(90deg, var(--ai-pink), var(--ai-warm));
      box-shadow: 0 0 10px rgba(255, 150, 110, .6);
    }
    .anime-intro-overlay.is-running .theme-intro-progress i { animation: kintsugi-intro-progress 1.0s cubic-bezier(.32, .62, .28, 1) .18s forwards; }'''


# ============================ steps ============================

def apply_palette(src, report):
    for label, old, new in PALETTE_EDITS:
        n = src.count(old)
        if n == 1:
            src = src.replace(old, new, 1)
            report.append("palette: %s - applied" % label)
        elif n == 0 and src.count(new) >= 1:
            report.append("palette: %s - already applied, skipped" % label)
        else:
            fail("palette anchor '%s' matched %d times (expected 1, or already-applied)" % (label, n))
    return src

def apply_scene(src, report):
    head = "\n        anime: {\n          settleFrames:"
    if src.count(head) != 1:
        fail("scene: entry head matched %d times" % src.count(head))
    h = src.index(head) + 1  # start of '        anime: {' line
    c = src.rfind("/*", 0, h)
    if c < 0:
        fail("scene: no comment before the anime entry")
    between = src[c:h]
    if between.count("*/") != 1 or not between.rstrip().endswith("*/"):
        fail("scene: comment before entry has unexpected shape")
    if h - c > 4000:
        fail("scene: comment suspiciously far from entry (%d chars)" % (h - c))
    region_start = src.rfind("\n", 0, c) + 1
    m = re.compile(r"\n        \},?(?=\n)").search(src, h)
    if not m:
        fail("scene: entry closer not found")
    region_end = m.end()
    cut = src[region_start:region_end]
    if cut.count("anime: {") != 1:
        fail("scene: region contains %d anime entry heads" % cut.count("anime: {"))
    if len(cut) > 40000:
        fail("scene: region suspiciously large (%d chars)" % len(cut))
    if cut == SCENE_FRAG:
        report.append("scene: already applied, skipped")
        return src
    kaw = src.find("kawaii: {", region_end)
    if kaw < 0 or kaw - region_end > 800:
        fail("scene: kawaii entry not directly after the anime region")
    report.append("scene: replaced %d-char entry with %d-char TWILIGHT CITY" % (len(cut), len(SCENE_FRAG)))
    return src[:region_start] + SCENE_FRAG + src[region_end:]

def apply_intro(src, report):
    mk0 = '<div class="theme-intro-overlay anime-intro-overlay" id="animeIntroOverlay" hidden>'
    mk1 = '<div class="theme-intro-overlay kawaii-intro-overlay" id="kawaiiIntroOverlay" hidden>'
    if src.count(mk0) != 1 or src.count(mk1) != 1:
        fail("intro: overlay markup anchors matched %d/%d times" % (src.count(mk0), src.count(mk1)))
    i0, i1 = src.index(mk0), src.index(mk1)
    if not i0 < i1:
        fail("intro: markup anchors out of order")
    ls = src.rfind("\n", 0, i0) + 1
    ke = src.rfind("\n", 0, i1) + 1
    block = src[ls:ke]
    if block.count("theme-intro-card") != 1:
        fail("intro: unexpected markup block shape")
    if block == INTRO_HTML + "\n":
        report.append("intro markup: already applied, skipped")
    else:
        src = src[:ls] + INTRO_HTML + "\n" + src[ke:]
        report.append("intro markup: replaced %d chars with %d" % (len(block), len(INTRO_HTML)))
    cs0, cs1 = "/* ---- ANIME intro:", "/* ---- KAWAII intro:"
    if src.count(cs0) != 1 or src.count(cs1) != 1:
        fail("intro: css banner anchors matched %d/%d times" % (src.count(cs0), src.count(cs1)))
    j0, j1 = src.index(cs0), src.index(cs1)
    if not j0 < j1:
        fail("intro: css anchors out of order")
    cls = src.rfind("\n", 0, j0) + 1
    cke = src.rfind("\n", 0, j1) + 1
    cblock = src[cls:cke]
    if ".anime-intro-overlay" not in cblock:
        fail("intro: old css block not where expected")
    if cblock == INTRO_CSS + "\n":
        report.append("intro css: already applied, skipped")
    else:
        src = src[:cls] + INTRO_CSS + "\n" + src[cke:]
        report.append("intro css: replaced %d chars with %d" % (len(cblock), len(INTRO_CSS)))
    return src

def node_check(html_text):
    blocks = re.findall(r"<script>(.*?)</script>", html_text, re.S)
    if not blocks:
        fail("node check: no inline <script> blocks found")
    tmpdir = tempfile.mkdtemp(prefix="siren_anime_check_")
    for i, b in enumerate(blocks):
        p = os.path.join(tmpdir, "block_%d.js" % i)
        io.open(p, "w", encoding="utf-8", newline="\n").write(b)
        try:
            r = subprocess.run(["node", "--check", p], capture_output=True, text=True, timeout=120)
        except FileNotFoundError:
            fail("node check: node not found on PATH")
        if r.returncode != 0:
            fail("node --check failed on script block %d:\n%s" % (i, (r.stderr or r.stdout)[:1200]))
    print("node --check: %d inline script blocks OK" % len(blocks))

def main():
    if len(sys.argv) != 2:
        fail("usage: python install_anime.py <target.html>")
    path = sys.argv[1]
    if not os.path.isfile(path):
        fail("no such file: %s" % path)
    with io.open(path, "r", encoding="utf-8") as f:
        orig = f.read()
    report = []
    src = apply_palette(orig, report)
    src = apply_scene(src, report)
    src = apply_intro(src, report)
    if src == orig:
        for line in report:
            print("  " + line)
        print("ALREADY INSTALLED - target byte-identical, nothing written.")
        return
    node_check(src)
    try:
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(src)
        with io.open(path, "r", encoding="utf-8") as f:
            back = f.read()
        if back != src:
            raise IOError("readback mismatch")
    except Exception as exc:
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            f.write(orig)
        fail("write failed (%s) - original restored" % exc)
    for line in report:
        print("  " + line)
    print("INSTALL OK: %s (%d -> %d bytes)" % (path, len(orig), len(src)))

if __name__ == "__main__":
    main()
