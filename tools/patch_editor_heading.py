"""
The editor heading names the editor that is actually on screen.

ALSO MINE, AND ALSO A CONSEQUENCE OF THE SLOT PATCH. Pressing the second tab on a type the block
builder cannot handle now routes to Guided - applyEditorMode('code') then setStructureMode(true) -
so the Guided rows are what the person is looking at. The heading above them still reads:

    Mermaid source
    Edit Mermaid directly; advanced diagrams stay code-first while preview styling and
    presentation remain available.

Both sentences describe the plain text editor, which at that moment is hidden. The person pressed a
tab marked Guided, landed on the Guided rows, and the heading names something else.

The app already holds the principle that fixes this. setStructureMode carries:

    // The legend under the editor describes the editor that is showing: the Text
    // legend's "Tab indents" and "Esc leaves" are not true of the Guided rows.

The legend was corrected for exactly this reason and the heading two lines above it was not. This
extends the same rule to the heading, and reuses the app's own words for Guided - the ones already
on the Guided button's tooltip - rather than inventing a third description of the same thing.

Structurally: syncEditorPanels is the only writer of the heading, and setStructureMode does not call
it, so the heading is lifted into syncEditorHeading() and both call that. Deliberately NOT done by
calling the whole of syncEditorPanels from setStructureMode - that function also sets the panel
hidden flags, and setStructureMode runs during boot restore before the editor mode is settled.

Anchor-guarded, not SHA-pinned.

Usage: python patch_editor_heading.py <path-to-siren.html>
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


HEAD_OLD = (
    "        el.editorHeading.textContent = visual\n"
    "          ? (sequence ? 'Sequence builder' : 'Visual builder')\n"
    "          : 'Mermaid source';\n"
    "        el.editorSubheading.textContent = visual\n"
    "          ? (sequence\n"
    "            ? 'Add participants, messages and notes; the Mermaid code updates as you go.'\n"
    "            : 'Build with blocks and connectors; code updates automatically.')\n"
    "          : 'Edit Mermaid directly; advanced diagrams stay code-first while preview styling and presentation remain available.';\n"
)

patch("1. one writer for the heading, called from both places that change what is showing",
      HEAD_OLD, "        syncEditorHeading();\n")

patch(
    "2. the heading itself, aware that Guided lives inside the Code panel",
    "      function syncEditorPanels() {\n",

    "      /* The heading names the editor a person is looking at. Guided is a view inside the Code\n"
    "         panel rather than a third tab, so 'Mermaid source' sat above the Guided rows whenever\n"
    "         they were showing. The legend below the editor was corrected for this exact reason;\n"
    "         this is the same rule applied to the two lines above it. */\n"
    "      function syncEditorHeading() {\n"
    "        if (!el.editorHeading || !el.editorSubheading) return;\n"
    "        const visual = state.editorMode !== 'code';\n"
    "        const sequence = isSequenceSource(el.source?.value || '');\n"
    "        const guided = !visual && state.structureMode === true;\n"
    "        el.editorHeading.textContent = visual\n"
    "          ? (sequence ? 'Sequence builder' : 'Visual builder')\n"
    "          : (guided ? 'Guided lines' : 'Mermaid source');\n"
    "        el.editorSubheading.textContent = visual\n"
    "          ? (sequence\n"
    "            ? 'Add participants, messages and notes; the Mermaid code updates as you go.'\n"
    "            : 'Build with blocks and connectors; code updates automatically.')\n"
    "          : (guided\n"
    "            ? 'The same Mermaid code with its parts clickable: rename a block, swap a shape, change a connector.'\n"
    "            : 'Edit Mermaid directly; advanced diagrams stay code-first while preview styling and presentation remain available.');\n"
    "      }\n"
    "\n"
    "      function syncEditorPanels() {\n",
)

patch(
    "3. switching between Text and Guided moves the heading with it",
    "        if (enabled) renderStructureEditor();\n"
    "        scheduleSave();\n",

    "        if (enabled) renderStructureEditor();\n"
    "        syncEditorHeading();\n"
    "        scheduleSave();\n",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
