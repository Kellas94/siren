#!/usr/bin/env python3
"""SIREN - Present mode, finishing pass.  ONE installer for three fixes.

  1. RENDER      arrowheads survive the presentation (marker ids are localised
                 per mounted copy) and the block-number badge steps aside when it
                 would sit on a connector label.
  2. STAGECRAFT  B blanks the screen black, W blanks it white (Build mode moves
                 to E); the deck PDF gains a second door in the Present bar's
                 more-menu; picture assets say honestly how they are stored and
                 keep flat, text-heavy images as PNG.
  3. PRESENTER   a real presenter view: a second same-origin window carrying the
                 current step, the presenter's notes, the next slide and the
                 clock, driven from and driving the same live Present state.

Usage:   python install_presentfinish.py <path-to-SIREN.html>

Guarantees
  - every anchor is counted against the UNTOUCHED file before a byte is written;
    one drifted anchor and the run aborts having written nothing;
  - a file that already carries any part of this work is refused, not
    double-patched (idempotent: run it twice, the second run aborts);
  - the write is atomic - a temp file in the same directory, then os.replace.

The edits below are ordered: RENDER, then STAGECRAFT, then PRESENTER.  That
order matters where two of them touch the same neighbourhood (the Present bar's
more-menu and the presentation key handler), and is the order that was verified.
"""

import io
import os
import sys
import tempfile

# A sentinel per patch family: if any of these strings is already in the file,
# some or all of this work is installed and re-running would corrupt it.
SENTINELS = [
    ("render", "localizeSvgMarkerIds"),
    ("render", "keepBlockNumberClearOfLabels"),
    ("stagecraft", "setPresentationBlank"),
    ("stagecraft", "mapCanvasFlatRatio"),
    ("presenter view", "openPresentationPresenterWindow"),
    ("presenter-view critique", "is-blanked"),
]

# Structural post-checks: things that must exist in the patched text before it
# is allowed to reach the disk.
POST_CHECKS = [
    "function localizeSvgMarkerIds(",
    "function keepBlockNumberClearOfLabels(",
    "function setPresentationBlank(",
    "function mapCanvasFlatRatio(",
    "function openPresentationPresenterWindow(",
    "function renderPresenterWindow(",
    "'⧉ Open the presenter view'",
    "'⤓ Export the deck as slides (PDF)'",
    "id=\"mapPresenterViewButton\"",
    "The room sees ",
    "is-noteless",
]

# (name, anchor, replacement, expected occurrences)
EDITS = [
    (
        'render: defect 1 - helper + workspace preview mount',
        "      function normalizeWorkspaceSvg(svg) {\n        if (!svg) return;\n        svg.removeAttribute('width');",
        '      /* Marker ids are document-global, and one rendered SVG string is mounted in\n         several places at once - the editor preview, the presentation stage, a Map\n         tile. Every copy carries the same <marker id>, so marker-end="url(#id)"\n         resolves to whichever copy the document reaches first. That copy is the\n         editor\'s, and on an ambient theme the editor is visibility:hidden while\n         presenting - marker content inherits that, and the presentation draws its\n         connectors with no arrowheads at all. Renaming per mounted copy keeps every\n         copy painting from its own defs. Only the DOM copy is touched: the stored\n         string still travels into exports and thumbnails with its original names. */\n      let mountedSvgInstanceCount = 0;\n\n      function localizeSvgMarkerIds(svg) {\n        if (!svg || typeof svg.querySelectorAll !== \'function\') return svg;\n        const markers = Array.from(svg.querySelectorAll(\'marker[id]\'));\n        if (!markers.length) return svg;\n        // A marker named from inside the drawing\'s own <style> keeps its name: those\n        // rules are document-wide, so renaming one copy\'s marker would silently\n        // re-aim the other copy\'s rule at it.\n        const styleText = Array.from(svg.querySelectorAll(\'style\'))\n          .map(node => node.textContent || \'\').join(\' \');\n        const suffix = `-m${++mountedSvgInstanceCount}`;\n        const renamed = new Map();\n        markers.forEach(marker => {\n          const from = marker.getAttribute(\'id\');\n          if (!from || renamed.has(from) || styleText.includes(`#${from}`)) return;\n          renamed.set(from, from + suffix);\n          marker.setAttribute(\'id\', from + suffix);\n        });\n        if (!renamed.size) return svg;\n        [\'marker-start\', \'marker-mid\', \'marker-end\'].forEach(attribute => {\n          svg.querySelectorAll(`[${attribute}]`).forEach(node => {\n            const value = node.getAttribute(attribute) || \'\';\n            const match = /url\\(\\s*[\'"]?#([^\'")\\s]+)/.exec(value);\n            const to = match && renamed.get(match[1]);\n            if (to) node.setAttribute(attribute, `url(#${to})`);\n          });\n        });\n        // Some renderers ask for the marker through the style attribute instead.\n        svg.querySelectorAll(\'[style*="marker"]\').forEach(node => {\n          let value = node.getAttribute(\'style\') || \'\';\n          renamed.forEach((to, from) => { value = value.split(`#${from})`).join(`#${to})`); });\n          node.setAttribute(\'style\', value);\n        });\n        return svg;\n      }\n\n      function normalizeWorkspaceSvg(svg) {\n        if (!svg) return;\n        localizeSvgMarkerIds(svg);\n        svg.removeAttribute(\'width\');',
        1,
    ),
    (
        'render: defect 1 - editor preview mount',
        '          el.diagram.innerHTML = lastGoodSvg;\n          prepareSvgForZoom();',
        "          el.diagram.innerHTML = lastGoodSvg;\n          localizeSvgMarkerIds(el.diagram.querySelector('svg'));\n          prepareSvgForZoom();",
        1,
    ),
    (
        'render: defect 1 - presentation stage mount',
        "        presentSvg = el.presentStage.querySelector('svg');\n        if (!presentSvg) return false;\n        presentSvg.removeAttribute('width');",
        "        presentSvg = el.presentStage.querySelector('svg');\n        if (!presentSvg) return false;\n        localizeSvgMarkerIds(presentSvg);\n        presentSvg.removeAttribute('width');",
        1,
    ),
    (
        'render: defect 1 - Map tile mount',
        "        tile.body.innerHTML = svg;\n        const mounted = tile.body.querySelector('svg');\n        if (mounted) {\n          mounted.removeAttribute('width');",
        "        tile.body.innerHTML = svg;\n        const mounted = tile.body.querySelector('svg');\n        if (mounted) {\n          localizeSvgMarkerIds(mounted);\n          mounted.removeAttribute('width');",
        1,
    ),
    (
        'render: defect 2 - label-collision helpers',
        '      function drawNodeAdornments(root, diagram, ids) {',
        "      /* A connector label carries the diagram's meaning; a block number is a\n         cross-reference. The number is anchored to its block's leading corner and\n         drawn after the labels, so where the renderer brings a label up to that\n         corner - the basic offline renderer keeps labels close to their edge - the\n         number lands on top of the words. Nothing moves unless the two actually\n         overlap; then the number steps to another outward corner of the same block,\n         so it is still read as that block's number. */\n      function edgeLabelBoxesInRoot(root) {\n        const boxes = [];\n        root.querySelectorAll('.edgeLabel rect, .fallback-edge-label rect').forEach(shape => {\n          const box = svgShapeBoxInRoot(shape, root);\n          if (box && box.width > 0 && box.height > 0) boxes.push(box);\n        });\n        return boxes;\n      }\n\n      function keepBlockNumberClearOfLabels(position, box, width, height, labelBoxes) {\n        if (!labelBoxes || !labelBoxes.length) return position;\n        const hits = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width\n          && a.y < b.y + b.height && b.y < a.y + a.height;\n        const clear = candidate => !labelBoxes.some(label => hits({ x:candidate.x, y:candidate.y, width, height }, label));\n        if (clear(position)) return position;\n        // The same overhang, mirrored: the number keeps hanging off its block by the\n        // amount it does now, just from a corner the label has left alone.\n        const overhangX = position.x - box.x;\n        const overhangY = position.y - box.y;\n        const candidates = [];\n        const roomX = box.width >= width + 6;\n        const roomY = box.height >= height + 6;\n        if (roomX) candidates.push({ x: box.x + box.width - width - overhangX, y: position.y });\n        if (roomY) candidates.push({ x: position.x, y: box.y + box.height - height - overhangY });\n        if (roomX && roomY) candidates.push({ x: box.x + box.width - width - overhangX, y: box.y + box.height - height - overhangY });\n        // Last resort, the block's own face: opaque in both renderers, and the one\n        // place in the drawing a connector label is never routed through.\n        const inset = box.y + Math.max(3, (box.height - height) / 2);\n        if (roomX) candidates.push({ x: box.x + 4, y: inset }, { x: box.x + box.width - width - 4, y: inset });\n        return candidates.find(clear) || position;\n      }\n\n      function drawNodeAdornments(root, diagram, ids) {",
        1,
    ),
    (
        'render: defect 2 - measure the connector labels once',
        "        const layer = root.ownerDocument.createElementNS(ns, 'g');\n        layer.setAttribute('data-t-adornments', 'true');",
        "        const layer = root.ownerDocument.createElementNS(ns, 'g');\n        layer.setAttribute('data-t-adornments', 'true');\n        const labelBoxes = edgeLabelBoxesInRoot(root);",
        1,
    ),
    (
        'render: defect 2 - place the number clear of them',
        '            const position = blockNumberPosition(diagram, id, box, width, height);',
        '            const position = keepBlockNumberClearOfLabels(\n              blockNumberPosition(diagram, id, box, width, height), box, width, height, labelBoxes);',
        1,
    ),
    (
        'stage: css: .present-blank',
        '      position: relative;\n      z-index: 1;\n    }\n  </style>\n</head>',
        '      position: relative;\n      z-index: 1;\n    }\n\n    /* ===== Present: blank the screen =====\n       B goes black, W goes white — the oldest control in presenting, and the\n       only one that has to cover everything: the Present bar, the Studio\n       panel, the Map, the route strip. Dim thins the presenter\'s chrome and\n       leaves the slide up; blank takes the slide away so the room looks at the\n       presenter. No transition: a blank that fades is a blank that is still\n       showing the diagram while the heads turn. */\n    .present-blank {\n      position: fixed;\n      inset: 0;\n      z-index: 60;\n      display: grid;\n      place-items: end center;\n      padding-bottom: 6vh;\n      background: #000000;\n      cursor: none;\n    }\n    .present-blank[data-tone="white"] { background: #ffffff; }\n    /* One line, then gone: it teaches the way out on the first blank of a talk\n       and does not sit on the wall for the rest of it. Measured composited:\n       #999 on #000 is 7.4:1, #666 on #fff is 5.2:1. */\n    .present-blank .present-blank-hint {\n      color: #999999;\n      font-size: 13px;\n      font-weight: 800;\n      letter-spacing: .04em;\n      animation: presentBlankHint 2.6s ease forwards;\n    }\n    .present-blank[data-tone="white"] .present-blank-hint { color: #666666; }\n    @keyframes presentBlankHint { 0%, 55% { opacity: 1; } 100% { opacity: 0; } }\n    @media (prefers-reduced-motion: reduce) {\n      /* A hint that cannot fade would stay on the wall for the whole blank.\n         The layer\'s aria-label says the same sentence to a screen reader. */\n      .present-blank .present-blank-hint { animation: none; opacity: 0; }\n    }\n  </style>\n</head>',
        1,
    ),
    (
        'stage: shortcuts dialog: blank callout',
        '<p class="field-hint">Press <kbd>?</kbd> at any point in Present to bring this back.</p>',
        '<p class="field-hint">Press <kbd>?</kbd> at any point in Present to bring this back.</p>\n          <div class="guide-callout"><strong>Blank the screen, on either surface:</strong> <kbd>B</kbd> goes black, <kbd>W</kbd> goes white — over the bars, the Studio panel, the Map and the audience screen. Any key or a click brings the presentation back. <kbd>B</kbd> is the blank key every presentation tool uses, so Build — which only exists on the Map, and only for authoring — answers to <kbd>E</kbd> for edit.</div>',
        1,
    ),
    (
        'stage: shortcuts dialog: Build is E',
        '<kbd>B</kbd> Build - add, reorder and remove slides',
        '<kbd>E</kbd> Build - add, reorder and remove slides',
        1,
    ),
    (
        'stage: quick guide: Build is E',
        '<kbd>B</kbd> Build the presentation:',
        '<kbd>E</kbd> Build the presentation:',
        1,
    ),
    (
        'stage: quick guide: blank callout',
        '<div class="guide-callout"><strong>Keyboard:</strong> <kbd>Ctrl/Cmd</kbd>+<kbd>Enter</kbd> render',
        '<div class="guide-callout"><strong>Blank the screen:</strong> <kbd>B</kbd> black, <kbd>W</kbd> white — anywhere in Present, over every panel and over the audience screen. Any key or a click brings the slide back.</div>\n          <div class="guide-callout"><strong>Keyboard:</strong> <kbd>Ctrl/Cmd</kbd>+<kbd>Enter</kbd> render',
        1,
    ),
    (
        'stage: Build button tooltip',
        'title="Build the presentation: add, reorder and remove its slides (B)"',
        'title="Build the presentation: add, reorder and remove its slides (E)"',
        1,
    ),
    (
        'stage: Done button tooltip',
        'title="Finish building (B or Esc)"',
        'title="Finish building (E or Esc)"',
        1,
    ),
    (
        'stage: mapHandleKey: Build is E',
        "        if (event.key === 'b' || event.key === 'B') { mapSetBuild(!mapBuilding); return true; }",
        "        // B and W belong to blanking on both surfaces — every presentation tool binds\n        // them, and blanking is a presenting verb. Build is Map-only authoring, so it\n        // answers to E for edit. Blank itself never reaches here: handlePresentationKeydown\n        // takes B and W first, whichever surface is up.\n        if (event.key === 'e' || event.key === 'E') { mapSetBuild(!mapBuilding); return true; }",
        1,
    ),
    (
        'stage: blank: functions',
        '      /* The bar carried fourteen controls and never fitted on one row.',
        "      /* ---------------- BLANK THE SCREEN ----------------\n         The room cannot listen to the presenter while the slide is still\n         arguing with them, which is why every presentation tool since the\n         overhead projector has had a black key and a white key. This is not\n         Dim: dim thins the presenter's chrome and leaves the diagram up. Blank\n         covers everything the presentation owns — both bars, the Studio panel,\n         the Map, the route strip — and the audience window with it, because a\n         blank that leaves the projector lit is a lie told to the presenter.\n         Any key, and any click, ends it. */\n      let presentBlankTone = '';\n      let presentBlankLayer = null;\n\n      function presentBlankNode() {\n        if (presentBlankLayer) return presentBlankLayer;\n        const layer = document.createElement('div');\n        layer.className = 'present-blank';\n        layer.id = 'presentBlank';\n        layer.tabIndex = -1;\n        layer.setAttribute('role', 'button');\n        layer.addEventListener('click', () => setPresentationBlank(''));\n        const hint = document.createElement('span');\n        hint.className = 'present-blank-hint';\n        hint.textContent = 'Screen blanked \\u00b7 any key or a click brings it back';\n        layer.appendChild(hint);\n        presentBlankLayer = layer;\n        return layer;\n      }\n\n      function setPresentationBlank(tone) {\n        const next = tone === 'black' || tone === 'white' ? tone : '';\n        if (next === presentBlankTone) return;\n        presentBlankTone = next;\n        if (!next) {\n          if (presentBlankLayer && presentBlankLayer.isConnected) presentBlankLayer.remove();\n          setPresentationAudienceBlank('');\n          // Hand focus back to whichever surface was presenting, so the very next\n          // arrow key steps the deck instead of falling on <body>.\n          const home = mapMode && el.mapLayer && !el.mapLayer.hidden ? el.mapLayer : el.presentOverlay;\n          if (home && !el.presentOverlay.hidden) home.focus();\n          return;\n        }\n        const layer = presentBlankNode();\n        layer.dataset.tone = next;\n        layer.setAttribute('aria-label', 'Screen blanked ' + next + '. Press any key, or click, to bring the presentation back.');\n        // Restart the hint's fade, so the second blank of a talk says what the first said.\n        const hint = layer.querySelector('.present-blank-hint');\n        if (hint) { hint.style.animation = 'none'; void hint.offsetWidth; hint.style.animation = ''; }\n        el.presentOverlay.appendChild(layer);\n        layer.focus();\n        setPresentationAudienceBlank(next);\n      }\n\n      /* The audience window is the room's screen. The veil is painted straight\n         into its document through the same direct-DOM route\n         broadcastPresentationState already falls back on, and no state\n         broadcast touches this node, so it survives every step taken blind. */\n      function setPresentationAudienceBlank(tone) {\n        if (!presentAudienceWindow || presentAudienceWindow.closed) return;\n        try {\n          const doc = presentAudienceWindow.document;\n          if (!doc || !doc.body) return;\n          let veil = doc.getElementById('sirenBlank');\n          if (!tone) { if (veil) veil.remove(); return; }\n          if (!veil) {\n            veil = doc.createElement('div');\n            veil.id = 'sirenBlank';\n            doc.body.appendChild(veil);\n          }\n          // Set through CSSOM, exactly as the broadcast sets its own styles.\n          veil.style.position = 'fixed';\n          veil.style.left = '0';\n          veil.style.top = '0';\n          veil.style.right = '0';\n          veil.style.bottom = '0';\n          veil.style.zIndex = '99';\n          veil.style.background = tone === 'white' ? '#ffffff' : '#000000';\n        } catch (error) {\n          // A popup that navigated away is not reachable; the presenter's own\n          // screen still blanks, and that is the half this key promised.\n        }\n      }\n\n      /* The bar carried fourteen controls and never fitted on one row.",
        1,
    ),
    (
        'stage: blank: keys',
        "        if (document.querySelector('dialog[open]')) return;\n        const target=event.target;",
        "        if (document.querySelector('dialog[open]')) return;\n        // A blank screen owns every key: the next press is 'bring the slide back',\n        // never 'step forward while nobody in the room can see it'.\n        if (presentBlankTone) { event.preventDefault(); setPresentationBlank(''); return; }\n        const target=event.target;",
        1,
    ),
    (
        'stage: blank: B and W',
        '        if (mapHandleKey(event)) { event.preventDefault(); return; }',
        "        // Black and white, on the Map and inside a diagram alike, before the Map's\n        // own handler sees the letter. Ctrl/Cmd/Alt combinations stay the browser's.\n        if (!(event.ctrlKey || event.metaKey || event.altKey)) {\n          const blankKey = String(event.key || '').toLowerCase();\n          if (blankKey === 'b') { event.preventDefault(); setPresentationBlank('black'); return; }\n          if (blankKey === 'w') { event.preventDefault(); setPresentationBlank('white'); return; }\n        }\n        if (mapHandleKey(event)) { event.preventDefault(); return; }",
        1,
    ),
    (
        'stage: blank: cleared on exit',
        '      function closePresentation() {\n        cancelAnimationFrame(presentCameraFrame);',
        "      function closePresentation() {\n        // Leaving while blanked must not leave the veil parented to a hidden overlay.\n        setPresentationBlank('');\n        cancelAnimationFrame(presentCameraFrame);",
        1,
    ),
    (
        'stage: more menu: Slides row',
        "          ['audience', presentAudienceWindow && !presentAudienceWindow.closed ? '▣ Close the audience screen' : '▣ Open the audience screen'],",
        "          ['audience', presentAudienceWindow && !presentAudienceWindow.closed ? '▣ Close the audience screen' : '▣ Open the audience screen'],\n          // The deck PDF lived only on the Build bar, so taking the slides away meant\n          // entering an authoring mode first. Same button, second door. Presenting a\n          // single diagram there is no route to export, and the row says which door\n          // builds one rather than waiting to be pressed and refusing.\n          ['slides', '⤓ Export the deck as slides (PDF)',\n            ((state.map && state.map.route) || []).length ? false\n              : 'The deck is the route on the Map. Present the whole workspace to build one.'],",
        1,
    ),
    (
        'stage: more menu: Slides wiring',
        '          const button = { all: el.presentAllButton, autofocus: el.presentAutoFocusButton,\n            autoplay: el.presentAutoplayButton, audience: el.presentAudienceButton }[choice];',
        '          const button = { all: el.presentAllButton, autofocus: el.presentAutoFocusButton,\n            autoplay: el.presentAutoplayButton, audience: el.presentAudienceButton,\n            slides: el.mapExportButton }[choice];',
        1,
    ),
    (
        'stage: assets: flatness threshold',
        '      const MAP_IMAGE_QUALITY = 0.82;\n',
        "      const MAP_IMAGE_QUALITY = 0.82;\n      /* Measured across screenshots, diagrams, photographs, an AI illustration and a\n         gradient wallpaper: everything drawn by a computer scored 0.60-0.97 flat, and\n         everything photographed or painted scored 0.05-0.29. 0.45 sits in the gap. */\n      const MAP_IMAGE_FLAT_MIN = 0.45;\n      /* Sharp text is worth some bytes, not any number of bytes. A real UI screenshot\n         costs 1.6-1.9x its JPEG; a dark photograph that happens to score flat costs\n         7x and loses here rather than in the presenter's storage budget. */\n      const MAP_IMAGE_SHARP_COST = 4;\n",
        1,
    ),
    (
        'stage: assets: flat ratio helper',
        '      function mapCanvasHasAlpha(context, width, height) {',
        "      /* SCREENSHOTS ARE NOT PHOTOGRAPHS. A photograph is noise: almost no two\n         neighbouring pixels are bit-identical. A screenshot is flat fills and\n         one-pixel letter stems, which is exactly what JPEG's 8x8 blocks smear\n         into haloes around small type. So measure the picture rather than\n         trusting its file name: the share of horizontally adjacent pixels that\n         are exactly equal separates the two families cleanly. Rows are sampled,\n         not every row, so a 1920-wide picture costs about a millisecond. */\n      function mapCanvasFlatRatio(context, width, height) {\n        try {\n          const data = context.getImageData(0, 0, width, height).data;\n          const stride = Math.max(1, Math.floor(height / 160));\n          let pairs = 0;\n          let same = 0;\n          for (let y = 0; y < height; y += stride) {\n            const row = y * width * 4;\n            for (let x = 1; x < width; x += 1) {\n              const at = row + x * 4;\n              pairs += 1;\n              if (data[at] === data[at - 4] && data[at + 1] === data[at - 3] && data[at + 2] === data[at - 2]) same += 1;\n            }\n          }\n          return pairs ? same / pairs : 0;\n        } catch (error) {\n          // Unreadable pixels mean no evidence, and no evidence means no claim.\n          return 0;\n        }\n      }\n\n      function mapCanvasHasAlpha(context, width, height) {",
        1,
    ),
    (
        'stage: assets: the encode ladder',
        "            const mayCarryAlpha = !/^image\\/jpe?g$/i.test(file.type || '');\n            const transparent = mayCarryAlpha && mapCanvasHasAlpha(context, width, height);\n            let mime = transparent ? 'image/png' : 'image/jpeg';\n            let payload = mapSplitDataUrl(transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', MAP_IMAGE_QUALITY));\n            // A transparent PNG over the cap is flattened onto white rather\n            // than dropped, and the presenter is told — a JPEG would have made\n            // the background black.\n            if (transparent && mapBase64Bytes(payload) > MAP_ASSET_IMAGE_MAX) {",
        "            const mayCarryAlpha = !/^image\\/jpe?g$/i.test(file.type || '');\n            const transparent = mayCarryAlpha && mapCanvasHasAlpha(context, width, height);\n            let keptSharp = false;\n            let mime = transparent ? 'image/png' : 'image/jpeg';\n            let payload = mapSplitDataUrl(transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', MAP_IMAGE_QUALITY));\n            /* A screenshot is the picture an auditor pastes most often and the one\n               JPEG punishes hardest, so an opaque picture that measures flat gets\n               its lossless price checked before the JPEG is accepted. Two gates,\n               and both have to open: it has to look computer-drawn, and PNG has to\n               be affordable. A source that is already a JPEG is never re-encoded\n               to PNG — the damage is done and PNG would only make it heavier. */\n            if (!transparent && mayCarryAlpha && mapCanvasFlatRatio(context, width, height) >= MAP_IMAGE_FLAT_MIN) {\n              const lossless = mapSplitDataUrl(canvas.toDataURL('image/png'));\n              const losslessSize = mapBase64Bytes(lossless);\n              if (losslessSize <= MAP_ASSET_IMAGE_MAX && losslessSize <= mapBase64Bytes(payload) * MAP_IMAGE_SHARP_COST) {\n                payload = lossless;\n                mime = 'image/png';\n                keptSharp = true;\n              }\n            }\n            // A transparent PNG over the cap is flattened onto white rather\n            // than dropped, and the presenter is told — a JPEG would have made\n            // the background black.\n            if (transparent && mapBase64Bytes(payload) > MAP_ASSET_IMAGE_MAX) {",
        1,
    ),
    (
        'stage: assets: carry keptSharp out',
        "                record: { mime, name: String(file.name || 'picture').slice(0, 200), size, w: width, h: height, data: payload },\n                flattened,",
        "                record: { mime, name: String(file.name || 'picture').slice(0, 200), size, w: width, h: height, data: payload },\n                flattened,\n                keptSharp,",
        1,
    ),
    (
        'stage: assets: honest toast',
        "          const shrunk = prepared.sourceSize > prepared.record.size * 1.15;\n          showToast(prepared.flattened\n            ? `Stored at ${prepared.record.w}×${prepared.record.h}. Its transparent background was filled with white — a JPEG would have made it black.`\n            : shrunk\n              ? `Stored at ${prepared.record.w}×${prepared.record.h}, ${mapBytes(prepared.record.size)} — down from ${mapBytes(prepared.sourceSize)}.`\n              : `Stored at ${prepared.record.w}×${prepared.record.h}, ${mapBytes(prepared.record.size)}.`,\n          'success');",
        "          const shrunk = prepared.sourceSize > prepared.record.size * 1.15;\n          // The picture's own line about itself, and it has to be true: a screenshot\n          // that kept PNG is bigger on purpose, and the presenter is owed the reason.\n          const stored = `Stored at ${prepared.record.w}×${prepared.record.h}, ${mapBytes(prepared.record.size)}`;\n          showToast(prepared.flattened\n            ? `Stored at ${prepared.record.w}×${prepared.record.h}. Its transparent background was filled with white — a JPEG would have made it black.`\n            : prepared.keptSharp\n              ? `${stored} — kept as PNG, so the small text stays sharp.`\n              : shrunk\n                ? `${stored} — down from ${mapBytes(prepared.sourceSize)}.`\n                : `${stored}.`,\n          'success');",
        1,
    ),
    (
        'stage: assets: honest chip',
        "        meta.textContent = `${asset.w}×${asset.h} · ${mapBytes(asset.size)} · ${String(asset.mime || '').replace('image/', '').toUpperCase()}`;",
        "        /* The chip used to read 'screenshot.png · JPEG', naming a file and a format\n           that disagree, because the ladder re-encodes. Say what was stored. */\n        const storedAs = String(asset.mime || '').replace('image/', '').toUpperCase() || 'AN IMAGE';\n        meta.textContent = `${asset.w}×${asset.h} · ${mapBytes(asset.size)} · stored as ${storedAs}`;",
        1,
    ),
    (
        'pv: presenter state variables',
        '      let presentAudienceBroadcastTimer = null;\n',
        '      let presentAudienceBroadcastTimer = null;\n      // Presenter view: the second window this presenter looks at while the\n      // audience window shows the picture. A direct same-origin reference, not a\n      // channel - it is opened by this document, so its DOM is simply written.\n      let presentPresenterWindow = null;\n      let presentPresenterTimer = null;\n      let presentPresenterToken = 0;\n',
        1,
    ),
    (
        'pv: Map bar entry inside the more-menu cluster',
        '<button class="btn ghost compact" id="mapPresenterButton" type="button" aria-pressed="true" title="Presenter notes">▤ Notes</button>',
        '<button class="btn ghost compact" id="mapPresenterButton" type="button" aria-pressed="true" title="Presenter notes">▤ Notes</button>\n              <button class="btn ghost compact" id="mapPresenterViewButton" type="button" aria-pressed="false" title="Open the presenter view: the next slide, this stop’s notes and the clock, on your screen only">⧉ Presenter view</button>',
        1,
    ),
    (
        'pv: element registry',
        "'mapPresenterButton','mapFullscreenButton','mapMoreButton'",
        "'mapPresenterButton','mapPresenterViewButton','mapFullscreenButton','mapMoreButton'",
        1,
    ),
    (
        'pv: Map bar binding',
        "        if (el.mapPresenterButton) el.mapPresenterButton.addEventListener('click', () => {\n          const on = el.mapPanel.hidden;\n          el.mapPanel.hidden = !on;\n          el.mapPresenterButton.setAttribute('aria-pressed', String(on));\n        });\n",
        "        if (el.mapPresenterButton) el.mapPresenterButton.addEventListener('click', () => {\n          const on = el.mapPanel.hidden;\n          el.mapPanel.hidden = !on;\n          el.mapPresenterButton.setAttribute('aria-pressed', String(on));\n        });\n        if (el.mapPresenterViewButton) el.mapPresenterViewButton.addEventListener('click', togglePresentationPresenterWindow);\n",
        1,
    ),
    (
        'pv: Present bar more-menu option',
        "          ['audience', presentAudienceWindow && !presentAudienceWindow.closed ? '▣ Close the audience screen' : '▣ Open the audience screen'],\n",
        "          ['presenter', presenterWindowLive() ? '⧉ Close the presenter view' : '⧉ Open the presenter view'],\n          ['audience', presentAudienceWindow && !presentAudienceWindow.closed ? '▣ Close the audience screen' : '▣ Open the audience screen'],\n",
        1,
    ),
    (
        'pv: Present bar more-menu pick handler',
        "        openStructureMenu(el.presentMoreButton, options, '', choice => {\n          const select = { camera: el.presentCameraMode, motion: el.presentTransition, decision: el.presentDecisionMode }[choice.split(':')[0]];\n",
        "        openStructureMenu(el.presentMoreButton, options, '', choice => {\n          // Presenter view has no stashed button to click through: it is a window,\n          // not a control, so the menu calls it directly.\n          if (choice === 'presenter') { togglePresentationPresenterWindow(); return; }\n          const select = { camera: el.presentCameraMode, motion: el.presentTransition, decision: el.presentDecisionMode }[choice.split(':')[0]];\n",
        1,
    ),
    (
        'pv: presenter view implementation',
        '      function closePresentationAudienceWindow() {',
        '      /* =====================================================================\n         PRESENTER VIEW — the second screen, and the mirror of ▣ Audience.\n\n         ▣ Audience opens a same-origin popup and pushes the stage into it for\n         the room. Presenter view is the SAME live state rendered for the other\n         pair of eyes: what is on screen now (small), WHAT IS NEXT (large — the\n         thing a presenter actually buys a second screen for), the note for this\n         stop at reading size, the clock and the position. It is not a second\n         presentation concept: there is one presentation, and Next in either\n         window moves it.\n\n         Built with document.write like the audience screen, but driven entirely\n         from this document. The popup is same-origin, so its buttons take real\n         addEventListener handlers from here and its text is written with\n         textContent — no inline script in the child, no message protocol, and\n         nothing that depends on \'unsafe-inline\' reaching an about:blank frame.\n\n         "Next" means whatever Next will actually do, which is not always the\n         next stop: on the Map it is route[i+1]; inside a diagram it is the next\n         step, then the next diagram in the deck, then the end. A pending\n         decision is announced rather than guessed at, and the end of the deck\n         says so instead of going blank. */\n\n      /* The stage\'s own presentation classes carry no styling of their own — the\n         overlay\'s stylesheet supplies it, and a data: URL in an <img> has no\n         stylesheet. These rules ride inside the picture so a thumbnail shows the\n         same block lit that the audience is looking at. Stroked rather than\n         glowed: a drop-shadow disappears at preview size. */\n      const PRESENTER_HIGHLIGHT_CSS = \'.t-present-dim{opacity:.14}\'\n        + \'.t-present-previous{opacity:.72}\'\n        + \'.t-present-next{opacity:.8}\'\n        + \'.t-present-active rect,.t-present-active circle,.t-present-active ellipse,.t-present-active polygon,.t-present-active>path{stroke:#7dd3fc!important;stroke-width:3.5px!important}\'\n        + \'.t-present-chapter rect,.t-present-chapter circle,.t-present-chapter ellipse,.t-present-chapter polygon{stroke:#7dd3fc!important;stroke-width:2.5px!important}\'\n        + \'.t-present-path path,path.t-present-path{stroke:#7dd3fc!important;stroke-width:3px!important}\';\n\n      /* The presenter display is always dark, the way Keynote\'s and PowerPoint\'s\n         are: it is a private screen in a dim room, and it must not flare when the\n         app is in a light theme. Fixed hexes rather than theme tokens, so the\n         contrast below is a fact and not a theme\'s opinion:\n           notes  #f4f7fa on #171e26 = 16.1:1\n           muted  #a8b8c7 on #0e1319 =  9.3:1\n           Next   #08131c on #7dd3fc = 11.4:1, hover #57bff0 = 9.1:1 (darker) */\n      const PRESENTER_WINDOW_HTML = \'<!doctype html><html><head><meta charset="utf-8"><title>Siren Presenter</title><style>\'\n        + \':root{--pv-bg:#0e1319;--pv-panel:#171e26;--pv-line:#2b3642;--pv-ink:#f4f7fa;--pv-dim:#a8b8c7;--pv-accent:#7dd3fc;--pv-accent-ink:#08131c}\'\n        + \'*{box-sizing:border-box}\'\n        + \'html,body{margin:0;height:100%;background:var(--pv-bg);color:var(--pv-ink);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;-webkit-font-smoothing:antialiased}\'\n        + \'#pvRoot{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) minmax(0,.78fr) auto;gap:13px;padding:14px 16px 15px}\'\n        + \'.pv-head{display:flex;align-items:baseline;gap:14px;min-width:0}\'\n        + \'.pv-brand{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--pv-dim);white-space:nowrap}\'\n        + \'.pv-title{font-size:16px;font-weight:700;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\'\n        + \'.pv-pos{font-size:13px;color:var(--pv-dim);white-space:nowrap;font-variant-numeric:tabular-nums}\'\n        + \'.pv-clock{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}\'\n        + \'.pv-panes{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1fr);gap:14px;min-height:0}\'\n        + \'.pv-pane{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:8px;min-width:0;min-height:0}\'\n        + \'.pv-cap{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--pv-dim)}\'\n        + \'.pv-pane.is-next .pv-cap{color:var(--pv-accent)}\'\n        + \'.pv-frame{position:relative;min-height:0;border:1px solid var(--pv-line);border-radius:12px;background:var(--pv-panel);overflow:hidden;display:flex;align-items:center;justify-content:center}\'\n        + \'.pv-pane.is-next .pv-frame{border-color:#41586b}\'\n        + \'.pv-frame img{width:100%;height:100%;object-fit:contain;display:block}\'\n        + \'.pv-frame img[hidden]{display:none}\'\n        + \'.pv-plate{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:20px}\'\n        + \'.pv-plate[hidden]{display:none}\'\n        + \'.pv-plate strong{font-size:20px}\'\n        + \'.pv-plate span{font-size:14px;line-height:1.5;color:var(--pv-dim);max-width:36ch}\'\n        + \'.pv-label{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\'\n        + \'.pv-notes{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;min-height:0}\'\n        + \'.pv-notes-body{overflow:auto;border:1px solid var(--pv-line);border-radius:12px;background:var(--pv-panel);padding:16px 18px;font-size:21px;line-height:1.55;white-space:pre-wrap;color:var(--pv-ink)}\'\n        + \'.pv-notes-body.is-empty{font-size:16px;font-style:italic;color:var(--pv-dim)}\'\n        + \'.pv-foot{display:flex;align-items:center;gap:10px}\'\n        + \'.pv-btn{font:inherit;font-size:14px;font-weight:600;padding:10px 17px;border-radius:10px;border:1px solid var(--pv-line);background:transparent;color:var(--pv-ink);cursor:pointer}\'\n        + \'.pv-btn:hover{background:#212b35}\'\n        + \'.pv-btn.is-primary{background:var(--pv-accent);border-color:var(--pv-accent);color:var(--pv-accent-ink)}\'\n        + \'.pv-btn.is-primary:hover{background:#57bff0;border-color:#57bff0}\'\n        + \'.pv-btn:focus-visible{outline:2px solid var(--pv-accent);outline-offset:2px}\'\n        + \'.pv-hint{margin-left:auto;font-size:12px;color:var(--pv-dim)}\'\n        + \'</style></head><body><div id="pvRoot">\'\n        + \'<div class="pv-head"><span class="pv-brand">Presenter</span><span class="pv-title" id="pvTitle">Presentation</span><span class="pv-pos" id="pvPos"></span><span class="pv-clock" id="pvClock">00:00</span></div>\'\n        + \'<div class="pv-panes">\'\n        + \'<section class="pv-pane is-now"><div class="pv-cap">On screen now</div><div class="pv-frame" id="pvNowFrame"><img alt=""><div class="pv-plate" hidden><strong></strong><span></span></div></div><div class="pv-label" id="pvNowLabel"></div></section>\'\n        + \'<section class="pv-pane is-next"><div class="pv-cap">Next</div><div class="pv-frame" id="pvNextFrame"><img alt=""><div class="pv-plate" hidden><strong></strong><span></span></div></div><div class="pv-label" id="pvNextLabel"></div></section>\'\n        + \'</div>\'\n        + \'<section class="pv-notes"><div class="pv-cap" id="pvNotesCap">Notes</div><div class="pv-notes-body" id="pvNotes"></div></section>\'\n        + \'<div class="pv-foot"><button class="pv-btn" id="pvPrev" type="button">&#9664; Previous</button><button class="pv-btn is-primary" id="pvNext" type="button">Next &#9654;</button><span class="pv-hint" id="pvHint"></span></div>\'\n        + \'</div></body></html>\';\n\n      function presenterWindowLive() {\n        try { return Boolean(presentPresenterWindow && !presentPresenterWindow.closed && presentPresenterWindow.document); }\n        catch (error) { return false; }\n      }\n\n      function presenterRoute() {\n        return (state.map && state.map.route) || [];\n      }\n\n      /* A stage SVG carries style="width:100%;height:100%" and no width/height\n         attributes, which leaves an <img> with no intrinsic size to scale\n         against. Give the picture its viewBox back, and append the highlight\n         rules last so they win over mermaid\'s own <style>. */\n      function presenterDressSvg(svgString) {\n        const source = String(svgString || \'\');\n        if (!source) return \'\';\n        let root = null;\n        try {\n          const parsed = new DOMParser().parseFromString(source, \'image/svg+xml\');\n          root = parsed.documentElement;\n          if (!root || root.nodeName === \'parsererror\' || root.querySelector(\'parsererror\')) return source;\n        } catch (error) { return source; }\n        try {\n          const box = getSvgViewBox(root);\n          if (box && box.width && box.height) {\n            root.setAttribute(\'width\', String(Math.round(box.width)));\n            root.setAttribute(\'height\', String(Math.round(box.height)));\n          }\n          root.removeAttribute(\'style\');\n          const style = root.ownerDocument.createElementNS(\'http://www.w3.org/2000/svg\', \'style\');\n          style.textContent = PRESENTER_HIGHLIGHT_CSS;\n          root.appendChild(style);\n          return new XMLSerializer().serializeToString(root);\n        } catch (error) { return source; }\n      }\n\n      /* The same slide the deck export draws, so the preview and the exported\n         PDF cannot disagree about what a stop looks like. */\n      async function presenterSlideSvg(view) {\n        if (!view) return \'\';\n        try { return presenterDressSvg(await mapViewSlideSvg(view)); }\n        catch (error) { return \'\'; }\n      }\n\n      /* The next step inside a diagram is the same picture with another block\n         lit, so it is drawn by re-lighting a clone rather than by rendering a\n         second diagram. */\n      function presenterStepSvg(entry) {\n        if (!presentSvg) return \'\';\n        try {\n          const clone = presentSvg.cloneNode(true);\n          // The stage SVG\'s viewBox is wherever the camera is standing, which is\n          // framed on the CURRENT block — cloning it would preview the next step\n          // through a window the next step is not inside. The preview goes back to\n          // the whole diagram, so the ring shows where the walk is heading.\n          if (presentFullViewBox) {\n            clone.setAttribute(\'viewBox\', presentFullViewBox.x + \' \' + presentFullViewBox.y\n              + \' \' + presentFullViewBox.width + \' \' + presentFullViewBox.height);\n          }\n          clone.querySelectorAll(\'.t-present-dim,.t-present-active,.t-present-previous,.t-present-path,.t-present-next,.t-present-chapter\')\n            .forEach(node => node.classList.remove(\'t-present-dim\',\'t-present-active\',\'t-present-previous\',\'t-present-path\',\'t-present-next\',\'t-present-chapter\'));\n          if (entry && entry.type === \'node\') {\n            findSvgNodeGroups(clone, entry.nodeId).forEach(group => group.classList.add(\'t-present-active\'));\n          } else if (entry && entry.type === \'chapter\') {\n            const chapter = presentModel && presentModel.subgraphs\n              ? presentModel.subgraphs.find(group => group.id === entry.chapterId)\n              : null;\n            (chapter ? chapter.members : []).forEach(id => {\n              findSvgNodeGroups(clone, id).forEach(group => group.classList.add(\'t-present-active\'));\n            });\n          }\n          return presenterDressSvg(new XMLSerializer().serializeToString(clone));\n        } catch (error) { return \'\'; }\n      }\n\n      function presenterDiagramName(diagram) {\n        return diagram ? (diagram.name || diagram.diagramTitle || \'Diagram\') : \'\';\n      }\n\n      /* What pressing Next will actually do — read off the same branches\n         stepPresentation() and mapStepRoute() take, so the second screen cannot\n         promise a slide the presentation will not go to. */\n      async function presenterNextPlan() {\n        const route = presenterRoute();\n        if (mapMode) {\n          const at = mapRouteIndex + 1;\n          if (at < route.length) return { label: mapViewLabel(route[at]), svg: await presenterSlideSvg(route[at]) };\n          if (state.map && state.map.settings && state.map.settings.loop && route.length) {\n            return { label: \'↻ Back to the start · \' + mapViewLabel(route[0]), svg: await presenterSlideSvg(route[0]) };\n          }\n          return { plate: \'End of the deck\', plateNote: \'This is the last stop. There is nothing after it.\' };\n        }\n        const entry = currentPresentationEntry();\n        if (entry && entry.type === \'node\' && presentDecisionMode !== \'continue\') {\n          const branches = outgoingEdges(entry.nodeId);\n          if (branches.length > 1 && !presentBranchSelections.has(entry.nodeId)) {\n            return {\n              plate: \'A decision comes next\',\n              plateNote: branches.length + \' paths leave this block — Next will ask you which one to take.\'\n            };\n          }\n        }\n        if (presentIndex < presentSequence.length - 1) {\n          const nextEntry = presentSequence[presentIndex < 0 ? 0 : presentIndex + 1];\n          return {\n            label: \'Step \' + ((presentIndex < 0 ? 0 : presentIndex + 1) + 1) + \' · \' + presentationEntryLabel(nextEntry),\n            svg: presenterStepSvg(nextEntry)\n          };\n        }\n        if (presentDeckIndex < presentDeckIds.length - 1) {\n          const diagram = state.diagrams.find(item => item.id === presentDeckIds[presentDeckIndex + 1]);\n          let svg = \'\';\n          try { svg = diagram ? presenterDressSvg(await presentationSvgForDiagram(diagram)) : \'\'; }\n          catch (error) { svg = \'\'; }\n          return { label: presenterDiagramName(diagram) + \' · Overview\', svg };\n        }\n        if (el.presentAutoplayLoop && el.presentAutoplayLoop.checked && presentDeckIds.length) {\n          const diagram = state.diagrams.find(item => item.id === presentDeckIds[0]);\n          let svg = \'\';\n          try { svg = diagram ? presenterDressSvg(await presentationSvgForDiagram(diagram)) : \'\'; }\n          catch (error) { svg = \'\'; }\n          return { label: \'↻ Back to the start · \' + presenterDiagramName(diagram), svg };\n        }\n        return { plate: \'End of the deck\', plateNote: \'This is the last step. There is nothing after it.\' };\n      }\n\n      function presenterSetPicture(frame, svgString, plateTitle, plateNote) {\n        if (!frame) return;\n        const image = frame.querySelector(\'img\');\n        const plate = frame.querySelector(\'.pv-plate\');\n        if (!image || !plate) return;\n        if (svgString) {\n          image.src = \'data:image/svg+xml;charset=utf-8,\' + encodeURIComponent(svgString);\n          image.hidden = false;\n          plate.hidden = true;\n          return;\n        }\n        image.removeAttribute(\'src\');\n        image.hidden = true;\n        plate.hidden = false;\n        plate.querySelector(\'strong\').textContent = plateTitle || \'Nothing to show\';\n        plate.querySelector(\'span\').textContent = plateNote || \'\';\n      }\n\n      async function renderPresenterWindow() {\n        if (!presenterWindowLive()) return;\n        const doc = presentPresenterWindow.document;\n        const q = id => doc.getElementById(id);\n        // The skeleton is written synchronously at open; if it is not there the\n        // window is not ours to paint.\n        if (!q(\'pvNext\') || !q(\'pvNotes\')) return;\n        const token = ++presentPresenterToken;\n        const route = presenterRoute();\n        const at = route.length ? clamp(mapRouteIndex, 0, route.length - 1) : -1;\n        const stop = at >= 0 ? route[at] : null;\n\n        // Everything cheap first, so the second screen never lags the room.\n        q(\'pvTitle\').textContent = mapMode\n          ? (state.projectName || \'Presentation\')\n          : (el.presentTitle.textContent || \'Presentation\');\n        q(\'pvPos\').textContent = mapMode\n          ? (route.length ? \'Stop \' + (at + 1) + \' of \' + route.length : \'No stops yet\')\n          : (el.presentDeckPosition.textContent || \'\');\n        q(\'pvClock\').textContent = el.presentElapsed.textContent || \'00:00\';\n        q(\'pvHint\').textContent = presentAudienceWindow && !presentAudienceWindow.closed\n          ? \'Audience screen is live · ← → or Space moves both\'\n          : \'← → or Space moves both screens\';\n\n        let notes = \'\';\n        let notesCaption = \'Notes\';\n        if (mapMode) notes = stop ? String(stop.note || \'\') : \'\';\n        else {\n          notes = String((el.presentNotes && el.presentNotes.value) || \'\');\n          // A step with no note of its own still has the note written against the\n          // stop this diagram was entered from — better than an empty panel, as\n          // long as the caption says whose note it is.\n          if (!notes.trim() && stop && String(stop.note || \'\').trim()) {\n            notes = String(stop.note);\n            notesCaption = \'Notes · written on this stop\';\n          }\n        }\n        q(\'pvNotesCap\').textContent = notesCaption;\n        const notesBody = q(\'pvNotes\');\n        notesBody.classList.toggle(\'is-empty\', !notes.trim());\n        notesBody.textContent = notes.trim() ? notes : \'No notes for this stop.\';\n        notesBody.scrollTop = 0;\n\n        const nowLabel = mapMode\n          ? (stop ? mapViewLabel(stop) : \'The map\')\n          : (el.presentStep.textContent || \'\');\n        q(\'pvNowLabel\').textContent = nowLabel;\n\n        const plan = await presenterNextPlan();\n        if (token !== presentPresenterToken || !presenterWindowLive()) return;\n        q(\'pvNextLabel\').textContent = plan.label || \'\';\n        presenterSetPicture(q(\'pvNextFrame\'), plan.svg || \'\', plan.plate, plan.plateNote);\n\n        let nowSvg = \'\';\n        if (mapMode) nowSvg = stop ? await presenterSlideSvg(stop) : \'\';\n        else nowSvg = presentSvg ? presenterDressSvg(new XMLSerializer().serializeToString(presentSvg)) : \'\';\n        if (token !== presentPresenterToken || !presenterWindowLive()) return;\n        presenterSetPicture(q(\'pvNowFrame\'), nowSvg, \'Nothing on stage\', \'The presentation has not put a picture up yet.\');\n      }\n\n      function schedulePresenterRefresh() {\n        if (!presenterWindowLive()) return;\n        clearTimeout(presentPresenterTimer);\n        presentPresenterTimer = setTimeout(() => {\n          presentPresenterTimer = null;\n          renderPresenterWindow();\n        }, 70);\n      }\n\n      /* One second\'s tick is enough for the clock, and it is also the cheapest\n         place to notice a window the presenter closed by its own titlebar. */\n      function presenterSyncClock() {\n        if (presentPresenterWindow && presentPresenterWindow.closed) {\n          presentPresenterWindow = null;\n          updatePresentationPresenterButtons();\n          return;\n        }\n        if (!presenterWindowLive()) return;\n        try {\n          const clock = presentPresenterWindow.document.getElementById(\'pvClock\');\n          if (clock) clock.textContent = el.presentElapsed.textContent || \'00:00\';\n        } catch (error) { /* the window is on its way out */ }\n      }\n\n      /* One verb for both chromes: the Map steps its route, a diagram steps its\n         walkthrough, and the presenter never has to know which one is up. */\n      function presenterAdvance(delta) {\n        if (!el.presentOverlay || el.presentOverlay.hidden) return;\n        if (mapMode) mapStepRoute(delta);\n        else stepPresentation(delta);\n        schedulePresenterRefresh();\n      }\n\n      function handlePresenterWindowKey(event) {\n        const key = event.key;\n        if (key === \'ArrowRight\' || key === \'PageDown\' || key === \' \' || key === \'Spacebar\') {\n          event.preventDefault();\n          presenterAdvance(1);\n          return;\n        }\n        if (key === \'ArrowLeft\' || key === \'PageUp\') {\n          event.preventDefault();\n          presenterAdvance(-1);\n        }\n      }\n\n      function handlePresenterWindowGone() {\n        // pagehide fires while the document is still alive; the reference is only\n        // safe to drop once the window has actually gone.\n        setTimeout(() => {\n          if (presentPresenterWindow && presentPresenterWindow.closed) {\n            presentPresenterWindow = null;\n            updatePresentationPresenterButtons();\n          }\n        }, 0);\n      }\n\n      function updatePresentationPresenterButtons() {\n        const live = presenterWindowLive();\n        if (el.mapPresenterViewButton) {\n          el.mapPresenterViewButton.setAttribute(\'aria-pressed\', String(live));\n          el.mapPresenterViewButton.textContent = live ? \'⧉ Presenter view on\' : \'⧉ Presenter view\';\n        }\n      }\n\n      function openPresentationPresenterWindow() {\n        if (presenterWindowLive()) {\n          try { presentPresenterWindow.focus(); } catch (error) { /* no-op */ }\n          renderPresenterWindow();\n          return;\n        }\n        let opened = null;\n        try { opened = window.open(\'\', \'sirenPresenter\', \'popup=yes,width=1180,height=780\'); }\n        catch (error) { opened = null; }\n        if (!opened) {\n          showToast(\'The browser blocked the presenter view. Allow pop-ups for this page and try again.\', \'error\');\n          return;\n        }\n        presentPresenterWindow = opened;\n        try {\n          opened.document.open();\n          opened.document.write(PRESENTER_WINDOW_HTML);\n          opened.document.close();\n        } catch (error) {\n          presentPresenterWindow = null;\n          try { opened.close(); } catch (closeError) { /* no-op */ }\n          showToast(\'The presenter view could not be prepared. \' + (error.message || error), \'error\');\n          return;\n        }\n        const doc = opened.document;\n        const previous = doc.getElementById(\'pvPrev\');\n        const next = doc.getElementById(\'pvNext\');\n        if (previous) previous.addEventListener(\'click\', () => presenterAdvance(-1));\n        if (next) next.addEventListener(\'click\', () => presenterAdvance(1));\n        doc.addEventListener(\'keydown\', handlePresenterWindowKey);\n        opened.addEventListener(\'pagehide\', handlePresenterWindowGone);\n        opened.addEventListener(\'unload\', handlePresenterWindowGone);\n        updatePresentationPresenterButtons();\n        renderPresenterWindow();\n        showToast(\'Presenter view opened. Keep it on your screen — the audience screen goes on theirs.\', \'success\');\n      }\n\n      function closePresentationPresenterWindow() {\n        clearTimeout(presentPresenterTimer);\n        presentPresenterTimer = null;\n        if (presentPresenterWindow && !presentPresenterWindow.closed) {\n          try { presentPresenterWindow.close(); } catch (error) { /* no-op */ }\n        }\n        presentPresenterWindow = null;\n        updatePresentationPresenterButtons();\n      }\n\n      function togglePresentationPresenterWindow() {\n        if (presenterWindowLive()) closePresentationPresenterWindow();\n        else openPresentationPresenterWindow();\n      }\n\n      function closePresentationAudienceWindow() {',
        1,
    ),
    (
        'pv: broadcastPresentationState refresh hook',
        '      function broadcastPresentationState(force=false) {\n        if(!presentAudienceWindow||presentAudienceWindow.closed)return;',
        '      function broadcastPresentationState(force=false) {\n        // The presenter window is the other half of this announcement, and it is\n        // live even when no audience screen is open — so it is served before the\n        // audience early-return, not after it.\n        schedulePresenterRefresh();\n        if(!presentAudienceWindow||presentAudienceWindow.closed)return;',
        1,
    ),
    (
        'pv: mapUpdateChrome refresh hook',
        "        if (el.mapNotes) {\n          const view = state.map && state.map.route[mapRouteIndex];\n          el.mapNotes.value = view ? view.note : '';\n        }\n      }\n",
        "        if (el.mapNotes) {\n          const view = state.map && state.map.route[mapRouteIndex];\n          el.mapNotes.value = view ? view.note : '';\n        }\n        // The Map moves its camera without broadcasting a stage, so the second\n        // screen hangs off the Map's own chrome update instead.\n        schedulePresenterRefresh();\n      }\n",
        1,
    ),
    (
        'pv: elapsed clock hook',
        '        if(presentAutoplay&&presentAutoplayDeadline){const left=Math.max(0,Math.ceil((presentAutoplayDeadline-Date.now())/1000));el.presentAutoplayStatus.textContent=`Next step in ${left}s.`;}\n      }\n',
        '        if(presentAutoplay&&presentAutoplayDeadline){const left=Math.max(0,Math.ceil((presentAutoplayDeadline-Date.now())/1000));el.presentAutoplayStatus.textContent=`Next step in ${left}s.`;}\n        presenterSyncClock();\n      }\n',
        1,
    ),
    (
        'pv: Map notes input hook',
        "        if (el.mapNotes) el.mapNotes.addEventListener('input', () => {\n          const view = state.map && state.map.route[mapRouteIndex];\n          if (!view) return;\n          view.note = el.mapNotes.value.slice(0, 5000);\n          scheduleSave();\n        });\n",
        "        if (el.mapNotes) el.mapNotes.addEventListener('input', () => {\n          const view = state.map && state.map.route[mapRouteIndex];\n          if (!view) return;\n          view.note = el.mapNotes.value.slice(0, 5000);\n          scheduleSave();\n          schedulePresenterRefresh();\n        });\n",
        1,
    ),
    (
        'pv: Studio notes input hook',
        "        [el.presentNotes, el.presentNoteOwner, el.presentNoteSource, el.presentNoteDuration, el.presentCheckpointEnabled, el.presentCheckpointText].forEach(control => control.addEventListener(control.type === 'checkbox' ? 'change' : 'input', saveCurrentPresentationNote));\n",
        "        [el.presentNotes, el.presentNoteOwner, el.presentNoteSource, el.presentNoteDuration, el.presentCheckpointEnabled, el.presentCheckpointText].forEach(control => control.addEventListener(control.type === 'checkbox' ? 'change' : 'input', saveCurrentPresentationNote));\n        if (el.presentNotes) el.presentNotes.addEventListener('input', schedulePresenterRefresh);\n",
        1,
    ),
    (
        'pv: closePresentation teardown',
        '        closePresentationAudienceWindow();\n',
        '        closePresentationAudienceWindow();\n        closePresentationPresenterWindow();\n',
        1,
    ),
    (
        'pv: keyboard help',
        '          <div class="guide-callout"><strong>In the Studio step list:</strong>',
        '          <div class="guide-callout"><strong>Two screens:</strong> the ⋯ menu opens <strong>⧉ Presenter view</strong> — the next slide, this stop’s notes, the clock and the position, on your screen only — and <strong>▣ Audience</strong> puts the picture alone on theirs. <kbd>←</kbd>/<kbd>→</kbd> or <kbd>Space</kbd> in either window moves both.</div>\n          <div class="guide-callout"><strong>In the Studio step list:</strong>',
        1,
    ),
    (
        'critique: presenter CSS: quiet notes, loud blank',
        "        + '.pv-hint{margin-left:auto;font-size:12px;color:var(--pv-dim)}'\n",
        "        + '.pv-hint{margin-left:auto;font-size:12px;color:var(--pv-dim)}'\n        + '.pv-clock-cap{margin-left:2px}'\n        + '#pvRoot.is-noteless{grid-template-rows:auto minmax(0,1fr) auto auto}'\n        + '#pvRoot.is-noteless .pv-notes-body{padding:9px 14px;font-size:15px}'\n        + '#pvRoot.is-blanked .pv-pane.is-now .pv-frame{border-color:#f2c94c;background:#0a0d11}'\n        + '#pvRoot.is-blanked .pv-pane.is-now .pv-cap{color:#f2c94c}'\n        + '#pvRoot.is-blanked .pv-pane.is-now .pv-plate strong{color:#f2c94c}'\n",
        1,
    ),
    (
        'critique: presenter head: the clock says what it counts',
        '<span class="pv-clock" id="pvClock">00:00</span>',
        '<span class="pv-cap pv-clock-cap">elapsed</span><span class="pv-clock" id="pvClock">00:00</span>',
        1,
    ),
    (
        'critique: next preview: framed the way the camera will frame it',
        "          if (presentFullViewBox) {\n            clone.setAttribute('viewBox', presentFullViewBox.x + ' ' + presentFullViewBox.y\n              + ' ' + presentFullViewBox.width + ' ' + presentFullViewBox.height);\n          }",
        "          // What Next will actually put in front of the room: the same camera\n          // box the presentation is about to fly to, not the whole diagram. A whole\n          // diagram in a 700px panel is a picture of nothing - the block the walk is\n          // heading for comes out about six pixels tall. A little air is left around\n          // the box so the ring is not cut by the frame.\n          const focusBox = entry && typeof presentationFocusBox === 'function'\n            ? presentationFocusBox(entry) : null;\n          const previewBox = focusBox && focusBox.width && focusBox.height ? focusBox : presentFullViewBox;\n          if (previewBox && previewBox.width && previewBox.height) {\n            const previewWidth = previewBox.width * 1.12;\n            const previewHeight = previewBox.height * 1.12;\n            clone.setAttribute('viewBox',\n              (previewBox.x - (previewWidth - previewBox.width) / 2) + ' '\n              + (previewBox.y - (previewHeight - previewBox.height) / 2) + ' '\n              + previewWidth + ' ' + previewHeight);\n          }",
        1,
    ),
    (
        'critique: notes panel: gives its height back when it has nothing to say',
        "        notesBody.classList.toggle('is-empty', !notes.trim());",
        "        notesBody.classList.toggle('is-empty', !notes.trim());\n        // An empty notes box the size of a slide tells the presenter the notes\n        // matter more than the pictures. With nothing written, it shrinks to a\n        // line and hands its height to the two frames.\n        const pvRoot = q('pvRoot');\n        if (pvRoot) pvRoot.classList.toggle('is-noteless', !notes.trim());",
        1,
    ),
    (
        'critique: presenter view says when the room is blanked',
        "        presenterSetPicture(q('pvNowFrame'), nowSvg, 'Nothing on stage', 'The presentation has not put a picture up yet.');",
        "        // B and W take the slide away from the room. The presenter's own screen\n        // has to say so, or the second screen quietly lies - it keeps showing the\n        // slide the room can no longer see, and the talk carries on into a black\n        // projector.\n        const blankedTone = typeof presentBlankTone === 'string' ? presentBlankTone : '';\n        const blankRoot = q('pvRoot');\n        if (blankRoot) blankRoot.classList.toggle('is-blanked', Boolean(blankedTone));\n        if (blankedTone) {\n          presenterSetPicture(q('pvNowFrame'), '', 'The room sees ' + blankedTone,\n            'The screen is blanked. Any key, or a click on the presentation, brings this slide back.');\n          return;\n        }\n        presenterSetPicture(q('pvNowFrame'), nowSvg, 'Nothing on stage', 'The presentation has not put a picture up yet.');",
        1,
    ),
    (
        'critique: the presenter window must not walk the deck while the room is black',
        '      function presenterAdvance(delta) {\n        if (!el.presentOverlay || el.presentOverlay.hidden) return;',
        '      function presenterAdvance(delta) {\n        if (!el.presentOverlay || el.presentOverlay.hidden) return;\n        // The room is looking at a black screen. The presentation\'s own keyboard\n        // already treats the next press as \'bring the slide back\'; the second\n        // screen has to follow the same rule, or Next from here walks the deck\n        // where nobody can see it - and the blank layer\'s own promise, "any key\n        // or a click brings it back", stops being true.\n        if (presentBlankTone) { setPresentationBlank(\'\'); return; }',
        1,
    ),
    (
        'critique: blank on: tell the second screen at once',
        '        setPresentationAudienceBlank(next);',
        '        setPresentationAudienceBlank(next);\n        schedulePresenterRefresh();',
        1,
    ),
    (
        'critique: blank off: tell the second screen at once',
        "          setPresentationAudienceBlank('');",
        "          setPresentationAudienceBlank('');\n          schedulePresenterRefresh();",
        1,
    ),
]


def main():
    if len(sys.argv) != 2:
        print("usage: python install_presentfinish.py <path-to-SIREN.html>", file=sys.stderr)
        return 2
    target = os.path.abspath(sys.argv[1])
    if not os.path.isfile(target):
        print("ABORT: no such file: %s" % target, file=sys.stderr)
        return 2

    # newline="" both ways: the file's own line endings survive byte for byte.
    with io.open(target, "r", encoding="utf-8", newline="") as handle:
        original = handle.read()

    installed = [name for name, needle in SENTINELS if needle in original]
    if installed:
        print("ABORT: this file already carries: %s. Nothing written."
              % ", ".join(sorted(set(installed))), file=sys.stderr)
        return 3

    # The edits are a chain: later ones anchor on text earlier ones introduce, so
    # each anchor is checked against the text as it stands at that point in the
    # chain rather than against the untouched file. Nothing reaches the disk until
    # the whole chain has applied, so a drifted anchor still writes nothing at all.
    text = original
    for position, (name, anchor, replacement, count) in enumerate(EDITS, 1):
        found = text.count(anchor)
        if found != count:
            print("ABORT: anchor drift at edit %d of %d [%s]: expected %d "
                  "occurrence(s), found %d. Nothing written."
                  % (position, len(EDITS), name, count, found), file=sys.stderr)
            print("       anchor head: %r" % anchor[:110], file=sys.stderr)
            return 4
        text = text.replace(anchor, replacement, count)

    if len(text) <= len(original):
        print("ABORT: the patched text did not grow; nothing written.", file=sys.stderr)
        return 5
    missing = [needle for needle in POST_CHECKS if needle not in text]
    if missing:
        print("ABORT: post-check failed, missing %r; nothing written." % missing,
              file=sys.stderr)
        return 5

    directory = os.path.dirname(target) or "."
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="",
                                         dir=directory, delete=False,
                                         prefix=".siren_presentfinish_", suffix=".tmp")
    try:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
        handle.close()
        os.replace(handle.name, target)
    except BaseException:
        try:
            handle.close()
        except Exception:
            pass
        if os.path.exists(handle.name):
            os.unlink(handle.name)
        raise

    print("OK - Present finishing pass installed into %s" % target)
    print("     %d anchored edits, %d -> %d characters" % (len(EDITS), len(original), len(text)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
