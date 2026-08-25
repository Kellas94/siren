#!/usr/bin/env python3
"""Two pre-existing rendering defects in SIREN's Present mode.

DEFECT 1 - arrowheads vanish in the presentation.
    Mermaid names its arrowhead markers after the render id, and the app mounts
    ONE rendered SVG string in several places at once: the editor preview, the
    presentation stage and the Map tile all carry <marker id="t_flow_...-pointEnd">.
    Ids are document-global, so marker-end="url(#id)" resolves to whichever copy
    comes first in the document - the editor's. Under any ambient theme
    (body[data-ambient="on"] .app { visibility: hidden } while presenting) that
    copy is hidden, marker content inherits visibility:hidden, and the
    presentation loses every arrowhead. Measured on v1.35.0: 12 duplicate marker
    ids, all 6 of the stage's marker-end references resolving into the editor's
    SVG. The fix gives each MOUNTED copy its own marker ids. The stored string is
    left untouched, so exports, Map thumbnails and the mini-map - each a document
    of its own - keep working exactly as before.

DEFECT 2 - the block-number badge covers a connector label.
    The number badge is anchored to the block's leading corner and drawn after
    the edge labels, so where a label reaches that corner the badge sits on top
    of the words. Reproduced in the basic offline renderer (the mode this app
    runs in with no network), where labels are kept close to their edge: badge 3
    over "second branch label" by 29 x 18 px. The fix moves the number - and only
    when it actually collides - to another outward corner of its own block.

Usage:  python fix_present_render.py <path-to-SIREN.html>

Anchor-guarded: every anchor must be found exactly once, or nothing is written.
Atomic: the file is replaced in one os.replace once every edit has applied.
Idempotent: a file that already carries the fix is refused, not double-patched.
"""

import os
import sys
import tempfile

MARKER_HELPER = """      /* Marker ids are document-global, and one rendered SVG string is mounted in
         several places at once - the editor preview, the presentation stage, a Map
         tile. Every copy carries the same <marker id>, so marker-end="url(#id)"
         resolves to whichever copy the document reaches first. That copy is the
         editor's, and on an ambient theme the editor is visibility:hidden while
         presenting - marker content inherits that, and the presentation draws its
         connectors with no arrowheads at all. Renaming per mounted copy keeps every
         copy painting from its own defs. Only the DOM copy is touched: the stored
         string still travels into exports and thumbnails with its original names. */
      let mountedSvgInstanceCount = 0;

      function localizeSvgMarkerIds(svg) {
        if (!svg || typeof svg.querySelectorAll !== 'function') return svg;
        const markers = Array.from(svg.querySelectorAll('marker[id]'));
        if (!markers.length) return svg;
        // A marker named from inside the drawing's own <style> keeps its name: those
        // rules are document-wide, so renaming one copy's marker would silently
        // re-aim the other copy's rule at it.
        const styleText = Array.from(svg.querySelectorAll('style'))
          .map(node => node.textContent || '').join(' ');
        const suffix = `-m${++mountedSvgInstanceCount}`;
        const renamed = new Map();
        markers.forEach(marker => {
          const from = marker.getAttribute('id');
          if (!from || renamed.has(from) || styleText.includes(`#${from}`)) return;
          renamed.set(from, from + suffix);
          marker.setAttribute('id', from + suffix);
        });
        if (!renamed.size) return svg;
        ['marker-start', 'marker-mid', 'marker-end'].forEach(attribute => {
          svg.querySelectorAll(`[${attribute}]`).forEach(node => {
            const value = node.getAttribute(attribute) || '';
            const match = /url\\(\\s*['"]?#([^'")\\s]+)/.exec(value);
            const to = match && renamed.get(match[1]);
            if (to) node.setAttribute(attribute, `url(#${to})`);
          });
        });
        // Some renderers ask for the marker through the style attribute instead.
        svg.querySelectorAll('[style*="marker"]').forEach(node => {
          let value = node.getAttribute('style') || '';
          renamed.forEach((to, from) => { value = value.split(`#${from})`).join(`#${to})`); });
          node.setAttribute('style', value);
        });
        return svg;
      }

"""

LABEL_HELPER = """      /* A connector label carries the diagram's meaning; a block number is a
         cross-reference. The number is anchored to its block's leading corner and
         drawn after the labels, so where the renderer brings a label up to that
         corner - the basic offline renderer keeps labels close to their edge - the
         number lands on top of the words. Nothing moves unless the two actually
         overlap; then the number steps to another outward corner of the same block,
         so it is still read as that block's number. */
      function edgeLabelBoxesInRoot(root) {
        const boxes = [];
        root.querySelectorAll('.edgeLabel rect, .fallback-edge-label rect').forEach(shape => {
          const box = svgShapeBoxInRoot(shape, root);
          if (box && box.width > 0 && box.height > 0) boxes.push(box);
        });
        return boxes;
      }

      function keepBlockNumberClearOfLabels(position, box, width, height, labelBoxes) {
        if (!labelBoxes || !labelBoxes.length) return position;
        const hits = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width
          && a.y < b.y + b.height && b.y < a.y + a.height;
        const clear = candidate => !labelBoxes.some(label => hits({ x:candidate.x, y:candidate.y, width, height }, label));
        if (clear(position)) return position;
        // The same overhang, mirrored: the number keeps hanging off its block by the
        // amount it does now, just from a corner the label has left alone.
        const overhangX = position.x - box.x;
        const overhangY = position.y - box.y;
        const candidates = [];
        const roomX = box.width >= width + 6;
        const roomY = box.height >= height + 6;
        if (roomX) candidates.push({ x: box.x + box.width - width - overhangX, y: position.y });
        if (roomY) candidates.push({ x: position.x, y: box.y + box.height - height - overhangY });
        if (roomX && roomY) candidates.push({ x: box.x + box.width - width - overhangX, y: box.y + box.height - height - overhangY });
        // Last resort, the block's own face: opaque in both renderers, and the one
        // place in the drawing a connector label is never routed through.
        const inset = box.y + Math.max(3, (box.height - height) / 2);
        if (roomX) candidates.push({ x: box.x + 4, y: inset }, { x: box.x + box.width - width - 4, y: inset });
        return candidates.find(clear) || position;
      }

"""

EDITS = [
    (
        "defect 1 - helper + workspace preview mount",
        """      function normalizeWorkspaceSvg(svg) {
        if (!svg) return;
        svg.removeAttribute('width');""",
        MARKER_HELPER + """      function normalizeWorkspaceSvg(svg) {
        if (!svg) return;
        localizeSvgMarkerIds(svg);
        svg.removeAttribute('width');""",
    ),
    (
        "defect 1 - editor preview mount",
        """          el.diagram.innerHTML = lastGoodSvg;
          prepareSvgForZoom();""",
        """          el.diagram.innerHTML = lastGoodSvg;
          localizeSvgMarkerIds(el.diagram.querySelector('svg'));
          prepareSvgForZoom();""",
    ),
    (
        "defect 1 - presentation stage mount",
        """        presentSvg = el.presentStage.querySelector('svg');
        if (!presentSvg) return false;
        presentSvg.removeAttribute('width');""",
        """        presentSvg = el.presentStage.querySelector('svg');
        if (!presentSvg) return false;
        localizeSvgMarkerIds(presentSvg);
        presentSvg.removeAttribute('width');""",
    ),
    (
        "defect 1 - Map tile mount",
        """        tile.body.innerHTML = svg;
        const mounted = tile.body.querySelector('svg');
        if (mounted) {
          mounted.removeAttribute('width');""",
        """        tile.body.innerHTML = svg;
        const mounted = tile.body.querySelector('svg');
        if (mounted) {
          localizeSvgMarkerIds(mounted);
          mounted.removeAttribute('width');""",
    ),
    (
        "defect 2 - label-collision helpers",
        """      function drawNodeAdornments(root, diagram, ids) {""",
        LABEL_HELPER + """      function drawNodeAdornments(root, diagram, ids) {""",
    ),
    (
        "defect 2 - measure the connector labels once",
        """        const layer = root.ownerDocument.createElementNS(ns, 'g');
        layer.setAttribute('data-t-adornments', 'true');""",
        """        const layer = root.ownerDocument.createElementNS(ns, 'g');
        layer.setAttribute('data-t-adornments', 'true');
        const labelBoxes = edgeLabelBoxesInRoot(root);""",
    ),
    (
        "defect 2 - place the number clear of them",
        """            const position = blockNumberPosition(diagram, id, box, width, height);""",
        """            const position = keepBlockNumberClearOfLabels(
              blockNumberPosition(diagram, id, box, width, height), box, width, height, labelBoxes);""",
    ),
]

ALREADY_APPLIED = "localizeSvgMarkerIds"


def main():
    if len(sys.argv) != 2:
        print("usage: python fix_present_render.py <path-to-SIREN.html>", file=sys.stderr)
        return 2
    target = os.path.abspath(sys.argv[1])
    if not os.path.isfile(target):
        print(f"ABORT: no such file: {target}", file=sys.stderr)
        return 2

    # newline="" both ways: the file's own line endings survive the patch byte for byte.
    with open(target, "r", encoding="utf-8", newline="") as handle:
        original = handle.read()

    if ALREADY_APPLIED in original:
        print("ABORT: this file already carries the fix; nothing written.", file=sys.stderr)
        return 3

    text = original
    for name, anchor, replacement in EDITS:
        found = text.count(anchor)
        if found != 1:
            print(f"ABORT: anchor for [{name}] found {found} times, expected exactly 1. "
                  "Nothing written.", file=sys.stderr)
            return 4
        text = text.replace(anchor, replacement, 1)

    if text == original:
        print("ABORT: the patch produced no change. Nothing written.", file=sys.stderr)
        return 5

    directory = os.path.dirname(target)
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="",
                                         dir=directory, delete=False, suffix=".tmp")
    try:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
        handle.close()
        os.replace(handle.name, target)
    except BaseException:
        handle.close()
        if os.path.exists(handle.name):
            os.unlink(handle.name)
        raise

    print(f"patched {target}")
    print(f"  {len(EDITS)} anchored edits applied")
    print(f"  {len(original)} -> {len(text)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
