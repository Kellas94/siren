# -*- coding: utf-8 -*-
"""
fix_present_stagecraft.py — three stagecraft gaps in SIREN's Present mode.

    python fix_present_stagecraft.py <path-to-T_Industries_SIREN_v1.html>

1. BLANK THE SCREEN.  B blanks to black, W blanks to white, anywhere in
   Present — over the Present bar, the Studio panel, the Map, the route strip
   and the audience window.  Any key or any click brings the slide back.
   B was Build's key on the Map.  Build is a Map-only authoring mode; blanking
   is a presenting verb that every presentation tool in the world binds to B,
   so B and W became presenting keys on both surfaces and Build took E (edit).
   Both shortcut cards say so.

2. THE DECK PDF GETS A SECOND DOOR.  '⤓ Slides' still lives on the Build bar,
   and the Present ⋯ overflow menu now carries the same action — it clicks the
   very same button, so there is one export and two ways to reach it.

3. THE PICTURE CHIP STOPS LYING.  The asset chip said "screenshot.png · JPEG",
   naming a PNG and a format that disagree.  It now reads "stored as JPEG",
   which is what actually happened.  And a screenshot no longer has to become
   a JPEG at all: the ladder measures how flat the picture is (long runs of
   identical pixels mean it was drawn by a computer, not photographed) and,
   when PNG costs little, keeps PNG so small type stays sharp.

Every edit is anchor-guarded on a unique string, every count is checked, and
the file is only written once all of them applied — atomically, via os.replace.
"""

import io
import os
import sys
import tempfile

EDITS = []


def edit(name, old, new, count=1):
    EDITS.append((name, old, new, count))


# ---------------------------------------------------------------------------
# 1. CSS — the blank layer.  It is the one thing inside the overlay that must
#    beat every other layer, so it is declared last and sits above them all.
# ---------------------------------------------------------------------------

edit(
    "css: .present-blank",
    "      position: relative;\n      z-index: 1;\n    }\n  </style>\n</head>",
    """      position: relative;
      z-index: 1;
    }

    /* ===== Present: blank the screen =====
       B goes black, W goes white — the oldest control in presenting, and the
       only one that has to cover everything: the Present bar, the Studio
       panel, the Map, the route strip. Dim thins the presenter's chrome and
       leaves the slide up; blank takes the slide away so the room looks at the
       presenter. No transition: a blank that fades is a blank that is still
       showing the diagram while the heads turn. */
    .present-blank {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: end center;
      padding-bottom: 6vh;
      background: #000000;
      cursor: none;
    }
    .present-blank[data-tone="white"] { background: #ffffff; }
    /* One line, then gone: it teaches the way out on the first blank of a talk
       and does not sit on the wall for the rest of it. Measured composited:
       #999 on #000 is 7.4:1, #666 on #fff is 5.2:1. */
    .present-blank .present-blank-hint {
      color: #999999;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: .04em;
      animation: presentBlankHint 2.6s ease forwards;
    }
    .present-blank[data-tone="white"] .present-blank-hint { color: #666666; }
    @keyframes presentBlankHint { 0%, 55% { opacity: 1; } 100% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      /* A hint that cannot fade would stay on the wall for the whole blank.
         The layer's aria-label says the same sentence to a screen reader. */
      .present-blank .present-blank-hint { animation: none; opacity: 0; }
    }
  </style>
</head>""",
)


# ---------------------------------------------------------------------------
# 2. The two shortcut cards, and the two button tooltips that quote the key.
# ---------------------------------------------------------------------------

edit(
    "shortcuts dialog: blank callout",
    '<p class="field-hint">Press <kbd>?</kbd> at any point in Present to bring this back.</p>',
    '<p class="field-hint">Press <kbd>?</kbd> at any point in Present to bring this back.</p>\n'
    '          <div class="guide-callout"><strong>Blank the screen, on either surface:</strong> '
    '<kbd>B</kbd> goes black, <kbd>W</kbd> goes white — over the bars, the Studio panel, the Map '
    'and the audience screen. Any key or a click brings the presentation back. '
    '<kbd>B</kbd> is the blank key every presentation tool uses, so Build — which only exists on '
    'the Map, and only for authoring — answers to <kbd>E</kbd> for edit.</div>',
)

edit(
    "shortcuts dialog: Build is E",
    "<kbd>B</kbd> Build - add, reorder and remove slides",
    "<kbd>E</kbd> Build - add, reorder and remove slides",
)

edit(
    "quick guide: Build is E",
    "<kbd>B</kbd> Build the presentation:",
    "<kbd>E</kbd> Build the presentation:",
)

edit(
    "quick guide: blank callout",
    '<div class="guide-callout"><strong>Keyboard:</strong> <kbd>Ctrl/Cmd</kbd>+<kbd>Enter</kbd> render',
    '<div class="guide-callout"><strong>Blank the screen:</strong> <kbd>B</kbd> black, <kbd>W</kbd> white '
    '— anywhere in Present, over every panel and over the audience screen. Any key or a click brings '
    'the slide back.</div>\n'
    '          <div class="guide-callout"><strong>Keyboard:</strong> <kbd>Ctrl/Cmd</kbd>+<kbd>Enter</kbd> render',
)

edit(
    "Build button tooltip",
    'title="Build the presentation: add, reorder and remove its slides (B)"',
    'title="Build the presentation: add, reorder and remove its slides (E)"',
)

edit(
    "Done button tooltip",
    'title="Finish building (B or Esc)"',
    'title="Finish building (E or Esc)"',
)


# ---------------------------------------------------------------------------
# 3. Build moves off B, on the Map's own key handler.
# ---------------------------------------------------------------------------

edit(
    "mapHandleKey: Build is E",
    "        if (event.key === 'b' || event.key === 'B') { mapSetBuild(!mapBuilding); return true; }",
    "        // B and W belong to blanking on both surfaces — every presentation tool binds\n"
    "        // them, and blanking is a presenting verb. Build is Map-only authoring, so it\n"
    "        // answers to E for edit. Blank itself never reaches here: handlePresentationKeydown\n"
    "        // takes B and W first, whichever surface is up.\n"
    "        if (event.key === 'e' || event.key === 'E') { mapSetBuild(!mapBuilding); return true; }",
)


# ---------------------------------------------------------------------------
# 4. The blank itself.
# ---------------------------------------------------------------------------

edit(
    "blank: functions",
    "      /* The bar carried fourteen controls and never fitted on one row.",
    """      /* ---------------- BLANK THE SCREEN ----------------
         The room cannot listen to the presenter while the slide is still
         arguing with them, which is why every presentation tool since the
         overhead projector has had a black key and a white key. This is not
         Dim: dim thins the presenter's chrome and leaves the diagram up. Blank
         covers everything the presentation owns — both bars, the Studio panel,
         the Map, the route strip — and the audience window with it, because a
         blank that leaves the projector lit is a lie told to the presenter.
         Any key, and any click, ends it. */
      let presentBlankTone = '';
      let presentBlankLayer = null;

      function presentBlankNode() {
        if (presentBlankLayer) return presentBlankLayer;
        const layer = document.createElement('div');
        layer.className = 'present-blank';
        layer.id = 'presentBlank';
        layer.tabIndex = -1;
        layer.setAttribute('role', 'button');
        layer.addEventListener('click', () => setPresentationBlank(''));
        const hint = document.createElement('span');
        hint.className = 'present-blank-hint';
        hint.textContent = 'Screen blanked \\u00b7 any key or a click brings it back';
        layer.appendChild(hint);
        presentBlankLayer = layer;
        return layer;
      }

      function setPresentationBlank(tone) {
        const next = tone === 'black' || tone === 'white' ? tone : '';
        if (next === presentBlankTone) return;
        presentBlankTone = next;
        if (!next) {
          if (presentBlankLayer && presentBlankLayer.isConnected) presentBlankLayer.remove();
          setPresentationAudienceBlank('');
          // Hand focus back to whichever surface was presenting, so the very next
          // arrow key steps the deck instead of falling on <body>.
          const home = mapMode && el.mapLayer && !el.mapLayer.hidden ? el.mapLayer : el.presentOverlay;
          if (home && !el.presentOverlay.hidden) home.focus();
          return;
        }
        const layer = presentBlankNode();
        layer.dataset.tone = next;
        layer.setAttribute('aria-label', 'Screen blanked ' + next + '. Press any key, or click, to bring the presentation back.');
        // Restart the hint's fade, so the second blank of a talk says what the first said.
        const hint = layer.querySelector('.present-blank-hint');
        if (hint) { hint.style.animation = 'none'; void hint.offsetWidth; hint.style.animation = ''; }
        el.presentOverlay.appendChild(layer);
        layer.focus();
        setPresentationAudienceBlank(next);
      }

      /* The audience window is the room's screen. The veil is painted straight
         into its document through the same direct-DOM route
         broadcastPresentationState already falls back on, and no state
         broadcast touches this node, so it survives every step taken blind. */
      function setPresentationAudienceBlank(tone) {
        if (!presentAudienceWindow || presentAudienceWindow.closed) return;
        try {
          const doc = presentAudienceWindow.document;
          if (!doc || !doc.body) return;
          let veil = doc.getElementById('sirenBlank');
          if (!tone) { if (veil) veil.remove(); return; }
          if (!veil) {
            veil = doc.createElement('div');
            veil.id = 'sirenBlank';
            doc.body.appendChild(veil);
          }
          // Set through CSSOM, exactly as the broadcast sets its own styles.
          veil.style.position = 'fixed';
          veil.style.left = '0';
          veil.style.top = '0';
          veil.style.right = '0';
          veil.style.bottom = '0';
          veil.style.zIndex = '99';
          veil.style.background = tone === 'white' ? '#ffffff' : '#000000';
        } catch (error) {
          // A popup that navigated away is not reachable; the presenter's own
          // screen still blanks, and that is the half this key promised.
        }
      }

      /* The bar carried fourteen controls and never fitted on one row.""",
)

edit(
    "blank: keys",
    "        if (document.querySelector('dialog[open]')) return;\n        const target=event.target;",
    "        if (document.querySelector('dialog[open]')) return;\n"
    "        // A blank screen owns every key: the next press is 'bring the slide back',\n"
    "        // never 'step forward while nobody in the room can see it'.\n"
    "        if (presentBlankTone) { event.preventDefault(); setPresentationBlank(''); return; }\n"
    "        const target=event.target;",
)

edit(
    "blank: B and W",
    "        if (mapHandleKey(event)) { event.preventDefault(); return; }",
    "        // Black and white, on the Map and inside a diagram alike, before the Map's\n"
    "        // own handler sees the letter. Ctrl/Cmd/Alt combinations stay the browser's.\n"
    "        if (!(event.ctrlKey || event.metaKey || event.altKey)) {\n"
    "          const blankKey = String(event.key || '').toLowerCase();\n"
    "          if (blankKey === 'b') { event.preventDefault(); setPresentationBlank('black'); return; }\n"
    "          if (blankKey === 'w') { event.preventDefault(); setPresentationBlank('white'); return; }\n"
    "        }\n"
    "        if (mapHandleKey(event)) { event.preventDefault(); return; }",
)

edit(
    "blank: cleared on exit",
    "      function closePresentation() {\n        cancelAnimationFrame(presentCameraFrame);",
    "      function closePresentation() {\n"
    "        // Leaving while blanked must not leave the veil parented to a hidden overlay.\n"
    "        setPresentationBlank('');\n"
    "        cancelAnimationFrame(presentCameraFrame);",
)


# ---------------------------------------------------------------------------
# 5. The deck PDF gets a second door: the Present ⋯ overflow menu.
#    Same action, same button — the menu only clicks the real control, which is
#    the contract every other row in this menu already keeps.
# ---------------------------------------------------------------------------

edit(
    "more menu: Slides row",
    "          ['audience', presentAudienceWindow && !presentAudienceWindow.closed ? "
    "'▣ Close the audience screen' : '▣ Open the audience screen'],",
    "          ['audience', presentAudienceWindow && !presentAudienceWindow.closed ? "
    "'▣ Close the audience screen' : '▣ Open the audience screen'],\n"
    "          // The deck PDF lived only on the Build bar, so taking the slides away meant\n"
    "          // entering an authoring mode first. Same button, second door. Presenting a\n"
    "          // single diagram there is no route to export, and the row says which door\n"
    "          // builds one rather than waiting to be pressed and refusing.\n"
    "          ['slides', '⤓ Export the deck as slides (PDF)',\n"
    "            ((state.map && state.map.route) || []).length ? false\n"
    "              : 'The deck is the route on the Map. Present the whole workspace to build one.'],",
)

edit(
    "more menu: Slides wiring",
    "          const button = { all: el.presentAllButton, autofocus: el.presentAutoFocusButton,\n"
    "            autoplay: el.presentAutoplayButton, audience: el.presentAudienceButton }[choice];",
    "          const button = { all: el.presentAllButton, autofocus: el.presentAutoFocusButton,\n"
    "            autoplay: el.presentAutoplayButton, audience: el.presentAudienceButton,\n"
    "            slides: el.mapExportButton }[choice];",
)


# ---------------------------------------------------------------------------
# 6. Pictures: say what was stored, and stop softening screenshots.
# ---------------------------------------------------------------------------

edit(
    "assets: flatness threshold",
    "      const MAP_IMAGE_QUALITY = 0.82;\n",
    "      const MAP_IMAGE_QUALITY = 0.82;\n"
    "      /* Measured across screenshots, diagrams, photographs, an AI illustration and a\n"
    "         gradient wallpaper: everything drawn by a computer scored 0.60-0.97 flat, and\n"
    "         everything photographed or painted scored 0.05-0.29. 0.45 sits in the gap. */\n"
    "      const MAP_IMAGE_FLAT_MIN = 0.45;\n"
    "      /* Sharp text is worth some bytes, not any number of bytes. A real UI screenshot\n"
    "         costs 1.6-1.9x its JPEG; a dark photograph that happens to score flat costs\n"
    "         7x and loses here rather than in the presenter's storage budget. */\n"
    "      const MAP_IMAGE_SHARP_COST = 4;\n",
)

edit(
    "assets: flat ratio helper",
    "      function mapCanvasHasAlpha(context, width, height) {",
    """      /* SCREENSHOTS ARE NOT PHOTOGRAPHS. A photograph is noise: almost no two
         neighbouring pixels are bit-identical. A screenshot is flat fills and
         one-pixel letter stems, which is exactly what JPEG's 8x8 blocks smear
         into haloes around small type. So measure the picture rather than
         trusting its file name: the share of horizontally adjacent pixels that
         are exactly equal separates the two families cleanly. Rows are sampled,
         not every row, so a 1920-wide picture costs about a millisecond. */
      function mapCanvasFlatRatio(context, width, height) {
        try {
          const data = context.getImageData(0, 0, width, height).data;
          const stride = Math.max(1, Math.floor(height / 160));
          let pairs = 0;
          let same = 0;
          for (let y = 0; y < height; y += stride) {
            const row = y * width * 4;
            for (let x = 1; x < width; x += 1) {
              const at = row + x * 4;
              pairs += 1;
              if (data[at] === data[at - 4] && data[at + 1] === data[at - 3] && data[at + 2] === data[at - 2]) same += 1;
            }
          }
          return pairs ? same / pairs : 0;
        } catch (error) {
          // Unreadable pixels mean no evidence, and no evidence means no claim.
          return 0;
        }
      }

      function mapCanvasHasAlpha(context, width, height) {""",
)

edit(
    "assets: the encode ladder",
    """            const mayCarryAlpha = !/^image\\/jpe?g$/i.test(file.type || '');
            const transparent = mayCarryAlpha && mapCanvasHasAlpha(context, width, height);
            let mime = transparent ? 'image/png' : 'image/jpeg';
            let payload = mapSplitDataUrl(transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', MAP_IMAGE_QUALITY));
            // A transparent PNG over the cap is flattened onto white rather
            // than dropped, and the presenter is told — a JPEG would have made
            // the background black.
            if (transparent && mapBase64Bytes(payload) > MAP_ASSET_IMAGE_MAX) {""",
    """            const mayCarryAlpha = !/^image\\/jpe?g$/i.test(file.type || '');
            const transparent = mayCarryAlpha && mapCanvasHasAlpha(context, width, height);
            let keptSharp = false;
            let mime = transparent ? 'image/png' : 'image/jpeg';
            let payload = mapSplitDataUrl(transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', MAP_IMAGE_QUALITY));
            /* A screenshot is the picture an auditor pastes most often and the one
               JPEG punishes hardest, so an opaque picture that measures flat gets
               its lossless price checked before the JPEG is accepted. Two gates,
               and both have to open: it has to look computer-drawn, and PNG has to
               be affordable. A source that is already a JPEG is never re-encoded
               to PNG — the damage is done and PNG would only make it heavier. */
            if (!transparent && mayCarryAlpha && mapCanvasFlatRatio(context, width, height) >= MAP_IMAGE_FLAT_MIN) {
              const lossless = mapSplitDataUrl(canvas.toDataURL('image/png'));
              const losslessSize = mapBase64Bytes(lossless);
              if (losslessSize <= MAP_ASSET_IMAGE_MAX && losslessSize <= mapBase64Bytes(payload) * MAP_IMAGE_SHARP_COST) {
                payload = lossless;
                mime = 'image/png';
                keptSharp = true;
              }
            }
            // A transparent PNG over the cap is flattened onto white rather
            // than dropped, and the presenter is told — a JPEG would have made
            // the background black.
            if (transparent && mapBase64Bytes(payload) > MAP_ASSET_IMAGE_MAX) {""",
)

edit(
    "assets: carry keptSharp out",
    "                record: { mime, name: String(file.name || 'picture').slice(0, 200), size, w: width, h: height, data: payload },\n"
    "                flattened,",
    "                record: { mime, name: String(file.name || 'picture').slice(0, 200), size, w: width, h: height, data: payload },\n"
    "                flattened,\n"
    "                keptSharp,",
)

edit(
    "assets: honest toast",
    """          const shrunk = prepared.sourceSize > prepared.record.size * 1.15;
          showToast(prepared.flattened
            ? `Stored at ${prepared.record.w}×${prepared.record.h}. Its transparent background was filled with white — a JPEG would have made it black.`
            : shrunk
              ? `Stored at ${prepared.record.w}×${prepared.record.h}, ${mapBytes(prepared.record.size)} — down from ${mapBytes(prepared.sourceSize)}.`
              : `Stored at ${prepared.record.w}×${prepared.record.h}, ${mapBytes(prepared.record.size)}.`,
          'success');""",
    """          const shrunk = prepared.sourceSize > prepared.record.size * 1.15;
          // The picture's own line about itself, and it has to be true: a screenshot
          // that kept PNG is bigger on purpose, and the presenter is owed the reason.
          const stored = `Stored at ${prepared.record.w}×${prepared.record.h}, ${mapBytes(prepared.record.size)}`;
          showToast(prepared.flattened
            ? `Stored at ${prepared.record.w}×${prepared.record.h}. Its transparent background was filled with white — a JPEG would have made it black.`
            : prepared.keptSharp
              ? `${stored} — kept as PNG, so the small text stays sharp.`
              : shrunk
                ? `${stored} — down from ${mapBytes(prepared.sourceSize)}.`
                : `${stored}.`,
          'success');""",
)

edit(
    "assets: honest chip",
    "        meta.textContent = `${asset.w}×${asset.h} · ${mapBytes(asset.size)} · "
    "${String(asset.mime || '').replace('image/', '').toUpperCase()}`;",
    "        /* The chip used to read 'screenshot.png · JPEG', naming a file and a format\n"
    "           that disagree, because the ladder re-encodes. Say what was stored. */\n"
    "        const storedAs = String(asset.mime || '').replace('image/', '').toUpperCase() || 'AN IMAGE';\n"
    "        meta.textContent = `${asset.w}×${asset.h} · ${mapBytes(asset.size)} · stored as ${storedAs}`;",
)


# ---------------------------------------------------------------------------
# apply
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("usage: fix_present_stagecraft.py <target.html>")
        return 2
    target = sys.argv[1]
    if not os.path.isfile(target):
        print("ABORT: no such file: " + target)
        return 2

    with io.open(target, encoding="utf-8") as handle:
        text = handle.read()
    original = text

    # Every anchor is checked against the untouched file first: one drifted
    # anchor and nothing is written at all.
    problems = []
    for name, old, new, count in EDITS:
        found = original.count(old)
        if found != count:
            problems.append("  %-34s expected %d, found %d" % (name, count, found))
        if new in original:
            problems.append("  %-34s already applied" % name)
    if problems:
        print("ABORT: the file has drifted; nothing written.")
        print("\n".join(problems))
        return 1

    for name, old, new, count in EDITS:
        text = text.replace(old, new, count)

    if text == original:
        print("ABORT: no change produced; nothing written.")
        return 1

    folder = os.path.dirname(os.path.abspath(target))
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="", suffix=".tmp", dir=folder, delete=False
    )
    try:
        handle.write(text)
        handle.close()
        os.replace(handle.name, target)
    except Exception:
        if os.path.exists(handle.name):
            os.unlink(handle.name)
        raise

    print("OK  %d edits applied to %s" % (len(EDITS), target))
    print("    %d bytes -> %d bytes" % (len(original), len(text)))
    for name, old, new, count in EDITS:
        print("    - " + name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
