"""
The second editor tab stops calling itself unavailable while it works.

FOUND BY VERIFICATION, IN MY OWN PATCH. patch_second_editor_slot.py made the tab name the builder
it actually opens - Build, Sequence, or Guided - so nobody meets a panel that promises blocks and
then explains it can make none. What it did not notice is that eight lines further down, a block
written for the OLD behaviour still runs, unconditionally:

    const builds = sequence || /^(flowchart|graph)$/i.test(sourceType);
    el.visualModeButton.classList.toggle('is-unavailable', !builds);
    el.visualModeButton.setAttribute('aria-disabled', String(!builds));
    el.visualModeButton.title = builds ? ... : 'The visual builder does not cover ... '

Measured on the merged build, on pie, classDiagram, stateDiagram-v2 and mindmap:

    the tab reads          '≡ Guided'
    it is painted disabled  opacity 0.45, cursor not-allowed, aria-disabled=true
    its tooltip says        'The visual builder does not cover pie diagrams - edit this one in Code.'
    a real mouse click      WORKS - guided rows 0 -> 3

There is no pointer-events:none, so the control names an action, performs that action, and at the
same time tells the person it cannot. A mouse user gets a working control that looks broken. A
keyboard or screen-reader user is told it is unavailable and never tries - Playwright itself refused
the click on aria-disabled grounds, which is a fair proxy for exactly those people.

That is the standing rule broken twice in one control: it promises what it will not deliver
(the disabled paint) and it delivers what it says it will not.

THE FIX IS TO DELETE THE WARNING, NOT TO EXTEND IT. The warning existed because the tab used to
claim the visual builder on all twenty types. It no longer claims that: it names Build only where
blocks work, Sequence where that editor exists, and Guided everywhere else. Guided was measured on
all twenty types before the slot patch was written - rows render on every one, the row count equals
the source line count on every one. So there is no longer any source for which the second slot is a
dead end, and nothing left for a disabled state to mean.

Removing the override also lands the second half: el.visualModeButton.title = slot.title on the line
above was dead code, overwritten in both branches, so the three slot tooltips have never been visible
to anyone on any diagram type. With the override gone they are what a person reads.

Anchor-guarded, not SHA-pinned.

Usage: python patch_slot_honest_tab.py <path-to-siren.html>
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
    "1. the disabled paint written for the old tab goes, and slot.title stops being dead code",

    "        // An honest tab: when the visual builder cannot serve this diagram type it\n"
    "        // says so on the tab itself, instead of glowing and then landing in Code.\n"
    "        const sourceType = detectDiagramType(el.source?.value || '') || '';\n"
    "        const builds = sequence || /^(flowchart|graph)$/i.test(sourceType);\n"
    "        el.visualModeButton.classList.toggle('is-unavailable', !builds);\n"
    "        el.visualModeButton.setAttribute('aria-disabled', String(!builds));\n"
    "        el.visualModeButton.title = builds\n"
    "          ? 'Visual builder: blocks and connectors through forms, no code'\n"
    "          : `The visual builder does not cover ${sourceType || 'this kind of'} diagrams — edit this one in Code.`;\n",

    "        // No source leaves this slot without a destination any more - Build where blocks\n"
    "        // work, Sequence where that editor exists, Guided everywhere else - so the disabled\n"
    "        // paint that used to warn \"the visual builder does not cover this type\" has nothing\n"
    "        // left to warn about. It was also a contradiction while it stood: nothing blocked the\n"
    "        // pointer, so the control performed the very action it told people it could not.\n"
    "        el.visualModeButton.classList.remove('is-unavailable');\n"
    "        el.visualModeButton.removeAttribute('aria-disabled');\n",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
