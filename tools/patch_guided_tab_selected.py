"""
The tab you pressed lights up.

REPORTED BY THE OWNER, AND IT IS MINE - shipped this morning in 1.70.0. He says the Guided tab is
not clickable on some diagrams and that if it cannot work it should not be there at all.

It IS clickable. All twenty diagram types were driven through the app's own picker and starter, with
a real mouse press on the tab: every one reaches its destination, 6 to 11 live rows, zero dead. So
"not clickable" is not about nothing happening.

What is happening is worse in a way, because it is a lie rather than a gap. Measured on pie:

    before pressing   Guided selected=false        Code selected=true
    AFTER pressing    Guided selected=FALSE        Code selected=TRUE
    what is showing   "Guided lines", six guided rows
    tab paint         the one you pressed transparent; the other one filled blue

You press Guided, the Guided rows appear, and the app lights up CODE. The tab you touched stays
dark. Of course it reads as a dead button - the only feedback a person gets says the press went
somewhere else.

WHY. Guided is a view inside code mode, so the slot's click handler runs applyEditorMode('code'),
and syncEditorPanels marks the tabs from `visual` alone: `aria-selected = String(visual)` is false
for anything reached through code. That was true when the second tab only ever opened the visual
builder. It stopped being true the moment the same tab started owning Guided as well, and I did not
follow the change through.

THE FIX IS THE RULE THE HEADING ALREADY FOLLOWS. syncEditorHeading exists because "Mermaid source"
sat above the Guided rows; the heading now names the editor that is actually showing. The tab
selection is the same question asked about the same two controls, so it moves into the same function
and answers it the same way: the second tab is selected when ITS destination is on screen - the
visual builder, the sequence builder, or the Guided rows.

The function is renamed to syncEditorChrome, because it no longer only writes a heading, and the
four now-superseded lines in syncEditorPanels are removed rather than left to fight it.

A SECOND DEAD BUTTON, FOUND ONE STEP SIDEWAYS AND OLDER THAN MY PATCH. It reproduces identically on
the shipped build, so it is not a regression - it has simply never worked:

    press Guided   ->  Guided rows appear
    press CODE     ->  the Guided rows STAY. Nothing happens at all.

Code means the plain Mermaid text, and Guided is a view inside code mode, so the tab was asking for
a mode it was already in. The only way back to the text was the INNER Text button, two levels down
inside the panel. Two tabs presented as peers where one of them cannot undo the other. Fixed here
too, because shipping a fix for one dead button while knowingly leaving its sibling would be
indefensible.

NOT FIXED HERE, and worth saying out loud: there are still TWO controls called Guided. The tab, and
the older Text/Guided pair inside the code panel. With the Code tab working, that inner pair is now
a duplicate route rather than the only way out - which is better, and still not right. It belongs to
the interface investigation the owner has asked for, not to a same-day correction.

Anchor-guarded, not SHA-pinned.

Usage: python patch_guided_tab_selected.py <path-to-siren.html>
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
    "1. the function owns the whole of what the two tabs say, not just the heading",

    "      /* The heading names the editor a person is looking at. Guided is a view inside the Code\n"
    "         panel rather than a third tab, so 'Mermaid source' sat above the Guided rows whenever\n"
    "         they were showing. The legend below the editor was corrected for this exact reason;\n"
    "         this is the same rule applied to the two lines above it. */\n"
    "      function syncEditorHeading() {\n"
    "        if (!el.editorHeading || !el.editorSubheading) return;\n"
    "        const visual = state.editorMode !== 'code';\n"
    "        const sequence = isSequenceSource(el.source?.value || '');\n"
    "        const guided = !visual && state.structureMode === true;\n",

    "      /* One question, asked once: which editor is a person actually looking at? The heading, the\n"
    "         subheading and the tab that reads selected all have to answer it the same way.\n"
    "\n"
    "         Guided is a view inside the Code panel rather than a third tab, so two things went wrong\n"
    "         when the second tab started offering it. 'Mermaid source' sat above the Guided rows -\n"
    "         fixed in 1.70.0. And the tab you pressed stayed unselected while Code lit up instead,\n"
    "         because the selection was written from `visual` alone. Measured on pie: press Guided,\n"
    "         get six Guided rows, and the Guided tab reads aria-selected=false with no fill while\n"
    "         Code reads true and is painted blue. The owner reported that as a dead button, which is\n"
    "         exactly what it looks like when the only feedback you get points at the other control. */\n"
    "      function syncEditorChrome() {\n"
    "        if (!el.editorHeading || !el.editorSubheading) return;\n"
    "        const visual = state.editorMode !== 'code';\n"
    "        const sequence = isSequenceSource(el.source?.value || '');\n"
    "        const guided = !visual && state.structureMode === true;\n"
    "        // The second tab is selected when ITS destination is on screen: the visual builder, the\n"
    "        // sequence builder, or the Guided rows it routes to on every other type.\n"
    "        const secondActive = visual || (guided && secondEditorSlot().key === 'guided');\n"
    "        if (el.visualModeButton && el.codeModeButton) {\n"
    "          el.visualModeButton.setAttribute('aria-selected', String(secondActive));\n"
    "          el.codeModeButton.setAttribute('aria-selected', String(!secondActive));\n"
    "          el.visualModeButton.tabIndex = secondActive ? 0 : -1;\n"
    "          el.codeModeButton.tabIndex = secondActive ? -1 : 0;\n"
    "        }\n",
)

patch(
    "2. syncEditorPanels stops writing a selection that would fight it",

    "        el.visualModeButton.setAttribute('aria-selected', String(visual));\n"
    "        el.codeModeButton.setAttribute('aria-selected', String(!visual));\n"
    "        el.visualModeButton.tabIndex = visual ? 0 : -1;\n"
    "        el.codeModeButton.tabIndex = visual ? -1 : 0;\n",

    "        // The tab selection is written by syncEditorChrome, at the foot of this function, so it\n"
    "        // can account for Guided living inside the Code panel. Four lines here used to set it\n"
    "        // from `visual` alone and were the reason the tab you pressed stayed dark.\n",
)

patch(
    "4. the Code tab means the plain text, so it can undo Guided",

    "el.codeModeButton.addEventListener('click', () => applyEditorMode('code', true));",

    "el.codeModeButton.addEventListener('click', () => {\n"
    "          // Code means the plain Mermaid text. Guided is a view INSIDE code mode, so without\n"
    "          // this the tab asked for a mode it was already in and nothing happened at all: the\n"
    "          // Guided rows stayed and the only way back to the text was the inner Text button,\n"
    "          // two levels down. Measured on the shipped build before this line existed.\n"
    "          applyEditorMode('code', true);\n"
    "          setStructureMode(false);\n"
    "        });",
)

# The two call sites: syncEditorPanels and setStructureMode.
assert s.count("syncEditorHeading();") == 2, "expected 2 call sites, found %d" % s.count("syncEditorHeading();")
s = s.replace("syncEditorHeading();", "syncEditorChrome();")
print("  applied: 3. both call sites follow the rename")

assert s.count("syncEditorHeading") == 0, "a reference to the old name survived"

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
