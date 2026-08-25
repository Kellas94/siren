"""
Three dead-UI fixes, from the dead-code audit of 1.66.0.

Deliberately NOT pinned to an input SHA. Codex is patching the same base in parallel for round 5,
and these three anchors are not in any of his twelve jobs, so this must stay re-runnable on top of
whatever build his chain produces. The anchor count assertions are the real guard: if he moves one
of these regions, this refuses to run rather than patching the wrong place.

  1. #diagramTypeChip - un-hide it. Confirmed invisible across 77 states (all 19 types, 4 modes,
     11 panels, 39 themes, phone and tablet). Its click handler revealDiagramTypeControls() jumps
     to the type picker, which is the one thing a beginner cannot find today.
  2. #direction - leave it alone, and say why in the source. A sweep will flag it as an unreachable
     duplicate control. It is not: diagram.direction is READ from this hidden select's value.
  3. #layoutAlignment - disclose which renderer it applies to. Measured: start/center/end leave
     every node at the same pixel under Mermaid, while its sibling nodeSpacing moves them.

Usage: python patch_dead_ui.py <path-to-siren.html>
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


# ---------------------------------------------------------------- 1. the type chip
patch(
    "1. show #diagramTypeChip",
    ' id="diagramTypeChip" data-state="info" role="button" tabindex="0" hidden aria-hidden="true"',
    ' id="diagramTypeChip" data-state="info" role="button" tabindex="0"',
)

# ---------------------------------------------------------------- 2. guard the direction store
patch(
    "2. comment the hidden direction store",
    '                <div hidden>\n'
    '                  <label for="direction">Advanced direction</label>',
    '                <!-- Do not delete this block. #direction is invisible but load-bearing: the\n'
    '                     diagram\'s direction is READ out of this select\'s value (see\n'
    '                     diagram.direction = el.direction.value) and written back into it on every\n'
    '                     load. It is a state store wearing the costume of a control. A dead-code\n'
    '                     sweep will flag it as an unreachable duplicate of the Layout buttons;\n'
    '                     removing it breaks flow direction everywhere. -->\n'
    '                <div hidden>\n'
    '                  <label for="direction">Advanced direction</label>',
)

# ---------------------------------------------------------------- 3. tell the truth about alignment
patch(
    "3a. add #layoutAlignmentHint",
    '<select id="layoutAlignment"><option value="start">Start</option>'
    '<option value="center" selected>Centre</option><option value="end">End</option></select></div>',
    '<select id="layoutAlignment"><option value="start">Start</option>'
    '<option value="center" selected>Centre</option><option value="end">End</option></select>'
    '<div class="field-hint" id="layoutAlignmentHint"></div></div>',
)

patch(
    "3b. register the hint in the el lookup",
    "'layoutRankSpacing','layoutAlignment','layoutRouting',",
    "'layoutRankSpacing','layoutAlignment','layoutAlignmentHint','layoutRouting',",
)

patch(
    "3c. sync the control to the active renderer",
    "        el.layoutAlignment.value = layout.alignment;\n"
    "        el.layoutRouting.value = layout.routing;\n"
    "      }",
    "        el.layoutAlignment.value = layout.alignment;\n"
    "        el.layoutRouting.value = layout.routing;\n"
    "        syncAlignmentAvailability();\n"
    "      }\n"
    "\n"
    "      /* Rank alignment is the one Auto-layout control the Mermaid path ignores:\n"
    "         buildMermaidConfig passes routing, density, nodeSpacing and rankSpacing, and not\n"
    "         alignment. Its only reader is layoutFallbackNodes(). Because the app boots on the\n"
    "         fallback renderer and upgrades to Mermaid in the background, the control genuinely\n"
    "         works for the first seconds of a session and then stops - silently. Measured:\n"
    "         start/center/end leave every node on the same pixel under Mermaid, while nodeSpacing\n"
    "         50 -> 160 moves them. So say which renderer it applies to rather than letting someone\n"
    "         set a value, watch it persist, and see nothing happen. */\n"
    "      function syncAlignmentAvailability() {\n"
    "        if (!el.layoutAlignment) return;\n"
    "        const live = rendererMode !== 'mermaid';\n"
    "        el.layoutAlignment.disabled = !live;\n"
    "        if (el.layoutAlignmentHint) {\n"
    "          el.layoutAlignmentHint.textContent = live\n"
    "            ? 'Applies to the basic offline renderer.'\n"
    "            : 'Not used by the full Mermaid renderer \\u2014 spacing and routing still apply.';\n"
    "        }\n"
    "      }",
)

patch(
    "3d. re-sync when the renderer changes",
    "      function updateRendererStatus() {\n"
    "        if (rendererMode === 'mermaid') {",
    "      function updateRendererStatus() {\n"
    "        syncAlignmentAvailability();\n"
    "        if (rendererMode === 'mermaid') {",
)

# ---------------------------------------------------------------- 4. make the chip's own handler work
# Un-hiding the chip exposed a latent bug in the handler nobody could reach before: measured, the
# handler runs (code mode goes aria-selected false -> true) and then achieves nothing visible.
# #diagramTypeSelect lives inside a collapsed <details> ("Diagram type, templates & tools"), and a
# control inside a closed disclosure can neither be scrolled to nor focused - scrollIntoView left
# the select at top=274 before and after, and calling .focus() on it directly was a no-op.
patch(
    "4. open the disclosure the type picker hides in",
    "      function revealDiagramTypeControls() {\n"
    "        applyEditorMode('code', true);\n"
    "        if (window.innerWidth <= 900) setMobileView('editor');\n"
    "        requestAnimationFrame(() => {",
    "      function revealDiagramTypeControls() {\n"
    "        applyEditorMode('code', true);\n"
    "        if (window.innerWidth <= 900) setMobileView('editor');\n"
    "        // The type select sits inside a collapsed <details>, and a control inside a closed\n"
    "        // disclosure can be neither scrolled to nor focused: scrollIntoView returns with the\n"
    "        // page unmoved and .focus() is a no-op. Without this the chip switches to Code mode\n"
    "        // and appears to do nothing at all.\n"
    "        for (let node = el.diagramTypeSelect; node; node = node.parentElement) {\n"
    "          if (node.tagName === 'DETAILS') { node.open = true; break; }\n"
    "        }\n"
    "        requestAnimationFrame(() => {",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
after = hashlib.sha256(s.encode("utf-8")).hexdigest().upper()
print("output SHA-256 %s" % after)
print("output bytes   %d" % len(s.encode("utf-8")))
