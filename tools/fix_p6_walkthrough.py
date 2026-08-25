#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
DEFECT 5 - THE DECK DOES NOT CONTAIN THE WALKTHROUGH.

A diagram stop exported as exactly ONE slide: a picture of the whole diagram.
The ten steps walked over that picture, and every presenter note written against
a step in the Studio, reached neither the PDF nor the .pptx.  Only the ROUTE
note - the note on the stop itself - ever landed in a notesSlide.

This patch expands a diagram stop into one slide per walkthrough step:

  * WHICH STEPS.  Every step the walkthrough actually stops at.  The author
    already controls that list - it IS the Studio's sequence panel, where steps
    are reordered, repeated and removed - so no second list is invented.  What
    IS new is one switch, in the deck-export menu that already asks a question
    at that moment, saying whether the diagrams are walked at all, with the
    resulting slide count printed beside it.  Default: walked.
  * THE CAMERA.  A step's frame is expressed as the `nodes` view the Map already
    flies to, and handed to mapViewSlideSvg - the deck's own crop.  No second
    camera and no second renderer.
  * THE NOTES.  diagram.presentation.notes['node:X'].text (and the checkpoint
    prompt, which is a question the presenter asked out loud) goes into that
    slide's notesSlide.
  * REVEALS ARE FLATTENED.  See the comment on mapStepNodeIds: a reveal's parts
    are the block's outgoing connectors and the blocks they reach, and those
    blocks are steps of their own further down the sequence.  One slide per
    press would print the same block three times and then print it again; a
    PowerPoint Appear animation cannot be authored at all, because the diagram
    slide is one rasterised picture with nothing on it to animate.  So a step
    exports at its FINISHED state - what the room was left looking at - framed
    on the union of the block and what the presses revealed.

Usage:  python fix_p6_walkthrough.py <target.html>
Anchor-guarded: every anchor must appear exactly once, or nothing is written.
"""
import io
import os
import sys
import tempfile

# --------------------------------------------------------------------------
# guarded edit helpers
# --------------------------------------------------------------------------


class Drift(Exception):
    pass


def expect_once(src, needle, what):
    n = src.count(needle)
    if n != 1:
        raise Drift("anchor %r found %d times (expected 1): %s" % (what, n, needle[:90]))
    return n


def replace_once(src, old, new, what):
    expect_once(src, old, what)
    return src.replace(old, new, 1)


def replace_function(src, header, new_body, what):
    """Replace a top-level function of this file, matched from its header line
    down to the first line that is exactly six spaces and a closing brace."""
    expect_once(src, header, what)
    start = src.index(header)
    end = src.find("\n      }\n", start)
    if end < 0:
        raise Drift("no closing brace found for %s" % what)
    end += len("\n      }\n")
    return src[:start] + new_body + src[end:]


def replace_comment_and_function(src, comment_head, header, new_block, what):
    """Same, but the replacement also swallows the doc comment above it."""
    expect_once(src, comment_head, what + " (comment)")
    expect_once(src, header, what)
    start = src.index(comment_head)
    if src.index(header) < start:
        raise Drift("%s: header appears before its comment" % what)
    end = src.find("\n      }\n", src.index(header))
    if end < 0:
        raise Drift("no closing brace found for %s" % what)
    end += len("\n      }\n")
    return src[:start] + new_block + src[end:]


# --------------------------------------------------------------------------
# 1.  state.map.settings.walk - the author's answer, kept where the deck's
#     other choices are kept, so it survives a reload and a .siren round trip.
# --------------------------------------------------------------------------

OLD_DEFAULT_MAP = (
    "        return { tiles: {}, cards: [], route: [], curated: false, placed: false, "
    "settings: { speed: 'smooth', arc: true, loop: false, hold: 8, routeView: 'strip' } };"
)
NEW_DEFAULT_MAP = (
    "        return { tiles: {}, cards: [], route: [], curated: false, placed: false, "
    "settings: { speed: 'smooth', arc: true, loop: false, hold: 8, routeView: 'strip', walk: true } };"
)

OLD_SETTINGS = "            routeView: settings.routeView === 'list' ? 'list' : 'strip'\n          }"
NEW_SETTINGS = (
    "            routeView: settings.routeView === 'list' ? 'list' : 'strip',\n"
    "            // Does the exported deck walk each diagram's steps, or stand at the\n"
    "            // whole picture the way it always did? Absent means walked: the deck\n"
    "            // is what the room saw, and the room saw the steps.\n"
    "            walk: settings.walk !== false\n"
    "          }"
)

# --------------------------------------------------------------------------
# 2.  The expander, shared by both files.
# --------------------------------------------------------------------------

NEW_MAP_STOP_SLIDES = r'''      /* Does the exported deck walk the steps? The author's answer lives in
         state.map.settings beside the deck's other choices, and is asked exactly
         where the deck is exported - not as a switch the resting Build bar has to
         carry. Absent means yes. */
      function mapRouteWalksSteps() {
        return !(state.map && state.map.settings && state.map.settings.walk === false);
      }

      /* The walkthrough a diagram stop expands into, read the way the deck already
         reads it. Answers [] for every stop that is not a diagram. */
      function mapStopStepEntries(view) {
        const target = (view && view.target) || {};
        if (target.kind !== 'diagram' && target.kind !== 'nodes') return [];
        const diagram = (state.diagrams || []).find(entry => entry.id === target.diagramId);
        if (!diagram) return [];
        try { return speakerSequenceForDiagram(diagram) || []; }
        catch (error) { return []; }
      }

      /* How many slides this stop is about to become, without rendering one. The
         export menu prints it, because turning a five-page deck into a
         twenty-seven-page one is a decision, and a decision needs its number. */
      function mapStopSlideCount(view) {
        const entries = mapStopStepEntries(view);
        if (!entries.length) return 1;
        const cards = entries.filter(entry => entry && entry.type === 'card' && entry.card).length;
        if (!mapRouteWalksSteps()) return cards + 1;
        // The diagram's own picture stands where the first block step stands and IS
        // the walkthrough's overview, so an overview step in exactly that position
        // does not get a second slide. Anywhere else it is a step like any other -
        // an author who drops 'Show the whole diagram' half way through means it.
        const steps = entries.filter(entry => !(entry && entry.type === 'card' && entry.card));
        const collapsed = steps.length && steps[0] && steps[0].type === 'overview' ? 1 : 0;
        return cards + 1 + steps.length - collapsed;
      }

      function mapDeckSlideCount() {
        return ((state.map && state.map.route) || []).reduce((total, view) => total + mapStopSlideCount(view), 0);
      }

      /* Node frames are measured off the tile mounted on the plane, so a stop whose
         tile is still at 'far' detail has no SVG to measure and every step would
         export the whole picture again. mapGoToView already does exactly this before
         it flies a node target; the deck has to do it before it prints one. */
      function mapReadyStopTile(view) {
        const target = (view && view.target) || {};
        if (target.kind !== 'diagram' && target.kind !== 'nodes') return;
        const diagram = (state.diagrams || []).find(entry => entry.id === target.diagramId);
        if (!diagram) return;
        const tile = mapEnsureTile(diagram);
        if (tile) mapSetTileDetail(diagram, tile, 'near');
      }

      /* WHAT A STEP'S CAMERA IS. A node step frames its block. A chapter step frames
         its members - the same union the walkthrough's own camera takes.

         A REVEAL IS NOT A BUILD HERE. The parts of a revealing step are its outgoing
         connectors and the blocks they reach, and those blocks are steps of their own
         further down the sequence: a slide per press would print the same block three
         times over and then print it again. A PowerPoint Appear animation is not
         available either - the diagram slide is one rasterised picture, so there is
         nothing on it to animate, and splitting the raster into stacked transparent
         overlays would hand the recipient a slide they cannot edit or understand. So
         the step exports at its FINISHED state, which is what the room was left
         looking at, framed on the union presentationFocusBox honours while the reveal
         runs. The card editor flattens a card's reveal for exactly this reason. */
      function mapStepNodeIds(diagram, entry) {
        if (!entry) return [];
        if (entry.type === 'node') {
          const ids = [entry.nodeId];
          if (entry.reveal === true) {
            try {
              ((parseFallbackFlowchart(diagram.source) || {}).edges || []).forEach(edge => {
                if (edge.from === entry.nodeId && !ids.includes(edge.to)) ids.push(edge.to);
              });
            } catch (error) { /* the block on its own is still an honest frame */ }
          }
          return ids.slice(0, 40);
        }
        if (entry.type === 'chapter') {
          try {
            const group = ((parseFallbackFlowchart(diagram.source) || {}).subgraphs || [])
              .find(item => item.id === entry.chapterId);
            return ((group && group.members) || []).slice(0, 40);
          } catch (error) { return []; }
        }
        return [];
      }

      /* A step's picture is the diagram's picture with the step's camera on it. There
         is no second renderer and no second camera: the frame is expressed as the
         `nodes` view the Map already flies to and hands to mapViewSlideSvg, so
         whatever that primitive does to a node stop it does to a step slide too. */
      async function mapStepSlideSvg(diagram, entry) {
        if (!entry) return '';
        if (entry.type === 'section') {
          try { return mapCardSlideSvg({ kind: 'title', eyebrow: 'Section', title: entry.title || 'Section' }, 1920, 1080); }
          catch (error) { return ''; }
        }
        const nodeIds = mapStepNodeIds(diagram, entry);
        return mapViewSlideSvg(nodeIds.length
          ? { target: { kind: 'nodes', diagramId: diagram.id, nodeIds } }
          : { target: { kind: 'diagram', diagramId: diagram.id } });
      }

      function mapJoinNotes(...parts) {
        return parts.map(part => String(part == null ? '' : part).trim()).filter(Boolean).join('\n\n').slice(0, 5000);
      }

      /* What the presenter had in front of them for this step: the note they wrote,
         and - because a checkpoint is a question asked out loud - the prompt they
         paused on. Keyed through presentationNoteKey, so the deck reads the notes
         from the same key the Studio writes them to. A null entry is the
         walkthrough's Overview, which is the key the Studio uses there. */
      function mapStepNoteText(diagram, entry) {
        const notes = (diagram && diagram.presentation && diagram.presentation.notes) || {};
        const note = notes[presentationNoteKey(entry)] || {};
        return mapJoinNotes(note.text,
          note.checkpointEnabled ? `Checkpoint: ${String(note.checkpointText || 'Pause and confirm')}` : '');
      }

      /* THE DECK IS WHAT THE ROOM SAW. A diagram stop used to be exactly one slide -
         the whole picture - while any content slide an author placed between the steps
         of that diagram's walkthrough lived on screen and nowhere else. So a stop
         EXPANDS: the walkthrough is walked in its own order, each content slide becomes
         a slide, and the diagram's own picture stands where its first block step
         stands, which is where the room first sees it.

         AND THE WALKTHROUGH IS THE PRESENTATION. The picture alone said nothing about
         the ten steps walked over it, and every note written against a step reached
         neither file. So when the deck walks the steps, each step becomes its own
         slide, framed by the camera a node stop already uses and carrying that step's
         own presenter note. A stop whose walkthrough is not walked expands to exactly
         the slides it always produced. */
      async function mapStopSlides(view) {
        const target = (view && view.target) || { kind: 'map' };
        const note = String((view && view.note) || '');
        if (target.kind !== 'diagram' && target.kind !== 'nodes') {
          const only = await mapViewSlideSvg(view);
          return only ? [{ svg: only, note, label: mapViewLabel(view) }] : [];
        }
        const diagram = state.diagrams.find(entry => entry.id === target.diagramId);
        if (!diagram) return [];
        const walking = mapRouteWalksSteps();
        if (walking) mapReadyStopTile(view);
        const base = await mapViewSlideSvg(view);
        const sequence = speakerSequenceForDiagram(diagram);
        const cards = sequence.filter(entry => entry && entry.type === 'card' && entry.card);
        if (!cards.length && !walking) return base ? [{ svg: base, note, label: mapViewLabel(view) }] : [];
        const notes = (diagram.presentation && diagram.presentation.notes) || {};
        const out = [];
        let placed = false;
        for (const entry of sequence) {
          if (entry && entry.type === 'card' && entry.card) {
            let svg = '';
            try { svg = mapCardSlideSvg(entry.card, 1920, 1080); }
            catch (error) { svg = ''; }
            if (svg) {
              out.push({
                svg,
                note: String((notes['card:' + entry.id] || {}).text || ''),
                label: entry.card.title || entry.card.eyebrow || 'Slide'
              });
            }
            continue;
          }
          if (!placed) {
            placed = true;
            // The stop's own note and the note written against the walkthrough's
            // Overview are notes about this one picture, so they travel together.
            if (base) {
              out.push({
                svg: base,
                note: entry && entry.type === 'overview'
                  ? mapJoinNotes(note, mapStepNoteText(diagram, null), mapStepNoteText(diagram, entry))
                  : mapJoinNotes(note, mapStepNoteText(diagram, null)),
                label: mapViewLabel(view)
              });
            }
            if (entry && entry.type === 'overview') continue;
          }
          if (!walking) continue;
          let stepSvg = '';
          try { stepSvg = await mapStepSlideSvg(diagram, entry); }
          catch (error) { stepSvg = ''; }
          if (stepSvg) out.push({ svg: stepSvg, note: mapStepNoteText(diagram, entry), label: speakerEntryLabel(diagram, entry) });
        }
        if (!placed && base) out.push({ svg: base, note, label: mapViewLabel(view) });
        return out;
      }
'''

# --------------------------------------------------------------------------
# 3.  The PowerPoint side: the same walk, one part per slide.
# --------------------------------------------------------------------------

NEW_PPTX_STOP_PARTS = r'''      /* One deck stop can be more than one slide: where a diagram's walkthrough
         carries content slides of its own, the deck PDF already expands the stop
         and walks them. PowerPoint has to produce the same slides in the same
         order - and it has to keep those cards as TEXT rather than take the PDF's
         rendered picture - so it walks the same sequence itself, through the same
         speakerSequenceForDiagram.

         When the deck walks the steps it answers with one part per step as well. A
         step part carries the synthetic `nodes` view that IS its camera and the label
         the Studio shows for it, so PowerPoint rasterises exactly the picture the PDF
         page shows and the notesSlide carries that step's own note. A section step is
         words, so it goes in as a card and stays editable. */
      async function mapPptxStopParts(view) {
        const target = (view && view.target) || { kind: 'map' };
        const base = { card: null, note: String((view && view.note) || '') };
        if (target.kind !== 'diagram' && target.kind !== 'nodes') return [base];
        const diagram = (state.diagrams || []).find(entry => entry.id === target.diagramId);
        if (!diagram) return [base];
        let sequence = [];
        try { sequence = speakerSequenceForDiagram(diagram) || []; }
        catch (error) { return [base]; }
        const walking = mapRouteWalksSteps();
        if (!walking && !sequence.some(entry => entry && entry.type === 'card' && entry.card)) return [base];
        if (walking) mapReadyStopTile(view);
        const notes = (diagram.presentation && diagram.presentation.notes) || {};
        const parts = [];
        let placed = false;
        sequence.forEach(entry => {
          if (entry && entry.type === 'card' && entry.card) {
            parts.push({ card: entry.card, note: String((notes['card:' + entry.id] || {}).text || '') });
            return;
          }
          // The diagram's own picture stands where its first block step stands.
          if (!placed) {
            placed = true;
            parts.push({
              card: null,
              note: entry && entry.type === 'overview'
                ? mapJoinNotes(base.note, mapStepNoteText(diagram, null), mapStepNoteText(diagram, entry))
                : mapJoinNotes(base.note, mapStepNoteText(diagram, null))
            });
            if (entry && entry.type === 'overview') return;
          }
          if (!walking) return;
          if (entry && entry.type === 'section') {
            parts.push({
              card: { kind: 'title', eyebrow: 'Section', title: entry.title || 'Section' },
              note: mapStepNoteText(diagram, entry)
            });
            return;
          }
          const nodeIds = mapStepNodeIds(diagram, entry);
          parts.push({
            card: null,
            note: mapStepNoteText(diagram, entry),
            view: nodeIds.length
              ? { target: { kind: 'nodes', diagramId: diagram.id, nodeIds } }
              : { target: { kind: 'diagram', diagramId: diagram.id } },
            label: speakerEntryLabel(diagram, entry)
          });
        });
        if (!placed) parts.push(base);
        return parts;
      }
'''

# --------------------------------------------------------------------------
# 4.  Two one-line edits inside mapExportRoutePptx.
#     *** These two lines are the ONLY places this patch touches the PowerPoint
#     *** picture path.  A parallel fit-to-box change lives in the same function.
# --------------------------------------------------------------------------

OLD_PARTS_CALL = "          const parts = mapPptxStopParts(view);"
NEW_PARTS_CALL = "          const parts = await mapPptxStopParts(view);"

OLD_RASTER_CALL = (
    "                built = await mapPptxRasterSlide(await mapViewSlideSvg(view), "
    "palette, media, mapViewLabel(view));"
)
NEW_RASTER_CALL = (
    "                // A step part brings its own view - the camera for that step - and its\n"
    "                // own label; a plain stop is the whole picture, exactly as before.\n"
    "                built = await mapPptxRasterSlide(await mapViewSlideSvg(piece.view || view), "
    "palette, media, piece.label || mapViewLabel(view));"
)

# --------------------------------------------------------------------------
# 4b. THE CROP WAS MEASURING THE WRONG SPACE.  mapViewSlideSvg framed a node
#     view from `node.getBBox()`, which is the block's box in the BLOCK's own
#     coordinates - a Mermaid block carries its position on its own transform,
#     so D at translate(302, 545) measures (-108, -108, 216, 216) and the crop
#     landed off the top-left corner of a 692 x 1374 picture.  Every `nodes`
#     route stop therefore exported a blank plate, and so did every step slide
#     until this was fixed.  presentationElementBox already converts a box
#     through rootMatrix.inverse() x elementMatrix - that is why the live
#     presentation camera lands correctly - so the deck uses the same
#     conversion instead of a second one.
#
#     presentationElementBox is passed by reference to .map() in the Present
#     code (`.map(presentationElementBox)`), so the second argument arrives as
#     an ARRAY INDEX there.  The root is therefore duck-checked, never trusted
#     positionally.
# --------------------------------------------------------------------------

OLD_ELEMENT_BOX_HEAD = (
    "      function presentationElementBox(element) {\n"
    "        if (!presentSvg || !element) return null;\n"
    "        try {\n"
    "          const box = element.getBBox();\n"
    "          const elementMatrix = element.getScreenCTM();\n"
    "          const rootMatrix = presentSvg.getScreenCTM();\n"
)
NEW_ELEMENT_BOX_HEAD = (
    "      /* The second argument is the SVG the box should be expressed in, and it\n"
    "         defaults to the presentation stage. It is duck-checked rather than trusted\n"
    "         by position because the Present code passes this function straight to\n"
    "         .map(), where the second argument is the array index. */\n"
    "      function presentationElementBox(element, root) {\n"
    "        const host = root && typeof root.getScreenCTM === 'function' ? root : presentSvg;\n"
    "        if (!host || !element) return null;\n"
    "        try {\n"
    "          const box = element.getBBox();\n"
    "          const elementMatrix = element.getScreenCTM();\n"
    "          const rootMatrix = host.getScreenCTM();\n"
)

OLD_ELEMENT_BOX_TAIL = (
    "          const rect = element.getBoundingClientRect();\n"
    "          const rootMatrix = presentSvg.getScreenCTM();\n"
)
NEW_ELEMENT_BOX_TAIL = (
    "          const rect = element.getBoundingClientRect();\n"
    "          const rootMatrix = host.getScreenCTM();\n"
)

OLD_CROP_LOOP = """          (target.nodeIds || []).forEach(id => {
            const node = mapFindNode(live, id);
            if (!node) return;
            let rect = null;
            try { rect = node.getBBox(); } catch (error) { rect = null; }
            if (!rect || !rect.width) return;
            found += 1;
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
          });
"""
NEW_CROP_LOOP = """          (target.nodeIds || []).forEach(id => {
            const node = mapFindNode(live, id);
            if (!node) return;
            // A block's own getBBox is in the BLOCK's coordinates, not the picture's:
            // a Mermaid block carries its position on its own transform, so the raw
            // box sits around the origin and the crop landed on empty canvas. The
            // presentation camera already converts it properly; use that.
            const rect = presentationElementBox(node, live);
            if (!rect || !rect.width) return;
            found += 1;
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
          });
"""

# --------------------------------------------------------------------------
# 5.  The export menu: the same door, now saying what is behind it.
# --------------------------------------------------------------------------

NEW_CHOOSE_EXPORT = r'''      /* One door for the deck, two files behind it - so the Build bar keeps the
         five controls it rests at and the choice is made where it is needed. The
         door now also says how many slides are behind it, and holds the one switch
         that changes that number: whether the deck walks each diagram's steps or
         stands at the whole picture. It is asked here, once, at the moment it
         matters, rather than added to a bar that has to rest quietly. */
      function mapChooseDeckExport(anchor) {
        if (!(((state.map && state.map.route) || []).length)) {
          showToast('There is nothing on the route yet.', 'error');
          return;
        }
        const walking = mapRouteWalksSteps();
        const count = mapDeckSlideCount();
        openStructureMenu(anchor || el.mapExportButton, [
          ['', `The deck · ${count} slide${count === 1 ? '' : 's'}`, 'heading'],
          ['walk', `${walking ? '☑' : '☐'}  Walk every step of each diagram`],
          ['', 'Export', 'heading'],
          ['pdf', '⤓ PDF · a picture of every slide'],
          ['pptx', '⤓ PowerPoint (.pptx) · text you can edit']
        ], '', choice => {
          if (choice === 'walk') {
            if (!state.map.settings || typeof state.map.settings !== 'object') state.map.settings = {};
            state.map.settings.walk = !walking;
            scheduleSave();
            // Re-open on the same anchor so the new count is read, not guessed.
            mapChooseDeckExport(anchor);
            return;
          }
          mapExportRoute(choice === 'pptx' ? 'pptx' : 'pdf');
        });
      }
'''


def main():
    if len(sys.argv) < 2:
        print("usage: python fix_p6_walkthrough.py <target.html>")
        return 2
    target = sys.argv[1]
    with io.open(target, encoding="utf-8") as handle:
        src = handle.read()
    before = len(src)

    try:
        # Guard: this patch must not be applied twice.
        for marker in ("function mapRouteWalksSteps(", "function mapStepNodeIds(", "mapStopSlideCount("):
            if marker in src:
                raise Drift("already patched: %s is present" % marker)

        src = replace_once(src, OLD_DEFAULT_MAP, NEW_DEFAULT_MAP, "makeDefaultMapState")
        src = replace_once(src, OLD_SETTINGS, NEW_SETTINGS, "sanitizeMap settings")

        src = replace_comment_and_function(
            src,
            "      /* THE DECK IS WHAT THE ROOM SAW. A diagram stop used to be exactly one slide",
            "      async function mapStopSlides(view) {",
            NEW_MAP_STOP_SLIDES,
            "mapStopSlides")

        src = replace_comment_and_function(
            src,
            "      /* One deck stop can be more than one slide: where a diagram's walkthrough",
            "      function mapPptxStopParts(view) {",
            NEW_PPTX_STOP_PARTS,
            "mapPptxStopParts")

        src = replace_once(src, OLD_PARTS_CALL, NEW_PARTS_CALL, "await mapPptxStopParts")
        src = replace_once(src, OLD_RASTER_CALL, NEW_RASTER_CALL, "pptx raster call")

        src = replace_once(src, OLD_ELEMENT_BOX_HEAD, NEW_ELEMENT_BOX_HEAD, "presentationElementBox head")
        src = replace_once(src, OLD_ELEMENT_BOX_TAIL, NEW_ELEMENT_BOX_TAIL, "presentationElementBox tail")
        src = replace_once(src, OLD_CROP_LOOP, NEW_CROP_LOOP, "mapViewSlideSvg node crop")

        src = replace_comment_and_function(
            src,
            "      /* One door for the deck, two files behind it - so the Build bar keeps the",
            "      function mapChooseDeckExport(anchor) {",
            NEW_CHOOSE_EXPORT,
            "mapChooseDeckExport")

    except Drift as error:
        sys.stderr.write("ABORTED, nothing written: %s\n" % error)
        return 1

    folder = os.path.dirname(os.path.abspath(target))
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="",
                                         dir=folder, suffix=".tmp", delete=False)
    try:
        handle.write(src)
        handle.flush()
        os.fsync(handle.fileno())
    finally:
        handle.close()
    os.replace(handle.name, target)
    print("patched %s: %d -> %d bytes (+%d)" % (target, before, len(src), len(src) - before))
    return 0


if __name__ == "__main__":
    sys.exit(main())
