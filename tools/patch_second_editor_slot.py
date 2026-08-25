"""
The second editor slot becomes whatever the diagram type actually supports.

"Visual" sits at the same rank as "Code", which reads as a choice between two ways of working on the
same thing. Measured on the shipped build, across all twenty diagram types the picker offers:

    3   the builder can genuinely edit      flowchart, swimlane, ishikawa
    1   has an editor of its own            sequence
   16   open a panel that cannot edit       everything else

On those sixteen the panel announces "Build without code - add blocks, choose their shapes, then
connect them", then says "Pie chart is code-first in SIREN. Edit it in Code", and leaves nine
disabled controls on screen. The app is not lying - it retracts the promise in the next sentence -
but it leads with a capability it does not have and leaves the evidence of the retraction on display.

So the slot stops being a fixed promise. It offers Build where the builder works, the sequence editor
where that exists, and Guided everywhere else. Nobody meets a dead panel, and the universal "Visual
Builder" claim disappears by not being made rather than by being explained away.

THE APP ALREADY HAD THIS IDEA. syncEditorPanels carries

    // The tab names itself after the builder it actually opens.
    el.visualModeButton.textContent = sequence ? '⇄ Sequence' : '▦ Visual';

which is exactly the right principle with only two answers available to it. A first draft of this
patch added a second writer for the same label and lost every time, because syncEditorPanels runs
last - so this extends that line instead. One place decides what the tab says.

Guided was verified as a real destination before this was written, not assumed. Across all twenty
types: rows render on every one, the row count equals the source line count on every one, and every
type offers at least one live row action - block-level on the three the builder handles, line-level
on the rest. Replacing one broken promise with a differently worded one was the risk, and it was
measured out first.

The predicate is structureIsFlowchart(), deliberately: it is the same test the Guided row menu
already uses to decide whether to offer block operations. Two surfaces answering "can this be built
from blocks" cannot disagree if they ask the same question.

Anchor-guarded, not SHA-pinned.

Usage: python patch_second_editor_slot.py <path-to-siren.html>
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


patch(
    "1. the slot decides what it is, from the same test the row menu uses",
    "      function structureIsFlowchart() {",

    "      /* What the second editor slot offers for the source in front of it. Three answers, and\n"
    "         the third is the point: on a type the builder cannot touch, the slot offers Guided\n"
    "         rather than a panel that opens, promises blocks, and then explains it can make none.\n"
    "         Measured before this existed: 16 of 20 types got that panel. */\n"
    "      function secondEditorSlot() {\n"
    "        if (isSequenceSource(el.source ? el.source.value : '')) {\n"
    "          return { key: 'sequence', label: '\\u21c4 Sequence',\n"
    "            title: 'Sequence builder: participants and messages through forms, no code' };\n"
    "        }\n"
    "        if (structureIsFlowchart()) {\n"
    "          return { key: 'build', label: '\\u25a6 Build',\n"
    "            title: 'Build: blocks and connectors through forms, no code' };\n"
    "        }\n"
    "        return { key: 'guided', label: '\\u2261 Guided',\n"
    "          title: 'Guided: the same Mermaid source, line by line, with reorder and delete' };\n"
    "      }\n"
    "\n"
    "      function structureIsFlowchart() {",
)

patch(
    "2. the line that already named the tab learns the third answer",
    "        el.visualModeButton.textContent = sequence ? '⇄ Sequence' : '▦ Visual';",

    "        // Was `sequence ? 'Sequence' : 'Visual'`, which is the right principle with one answer\n"
    "        // missing: on the sixteen types the builder cannot touch, 'Visual' named a builder that\n"
    "        // opens and then explains it can do nothing here.\n"
    "        const slot = secondEditorSlot();\n"
    "        el.visualModeButton.textContent = slot.label;\n"
    "        el.visualModeButton.title = slot.title;\n"
    "        el.visualModeButton.dataset.slot = slot.key;",
)

patch(
    "3. pressing it goes where the label says",
    "el.visualModeButton.addEventListener('click', () => applyEditorMode('visual', true));",

    "el.visualModeButton.addEventListener('click', () => {\n"
    "          // Guided is a view inside Code, so the slot routes there rather than opening a\n"
    "          // builder panel that would have nothing to offer this diagram type.\n"
    "          if (secondEditorSlot().key === 'guided') {\n"
    "            applyEditorMode('code', true);\n"
    "            setStructureMode(true);\n"
    "            return;\n"
    "          }\n"
    "          applyEditorMode('visual', true);\n"
    "        });",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
