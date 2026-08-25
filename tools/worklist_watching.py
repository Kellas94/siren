"""
Two of the three "small things" closed; the third turns out to be a well-specified job.

Re-measured on the shipped 1.70.0, at the exact 1100x620 the complaint named:

  the Docs block menu scrolls    CLOSED. 382x499, hiddenBelow 0, twelve rows, nothing under the
                                 fold. Round 9's containment work plus 1.69.0's "Delete block is
                                 drawn again on a short window".
  "Document type..." at the      CLOSED. The submenu opens 6px from the row it came from, not at
  page's left edge               the page edge. Round 10's AT reaching the surface the complaint
                                 was actually written about.
  a red button when nothing      OPEN, and sharper than it looked. The app already separates a
  is lost                        NOTICE (no Cancel, no red) from a confirmation. What it does not
                                 have is a non-destructive confirmation: requestConfirmation()
                                 leaves .danger on for all 46 callers, and several of them lose
                                 nothing by their OWN message - "A snapshot of the current diagram
                                 is saved first", "No diagram will be deleted", "Undo restores it".

One measurement trap worth recording: right-clicking inside a paragraph opens the browser's own
menu, not the app's, so a probe aimed at the block text reads "no menu" on a build where the menu
works perfectly. Aim at the block chrome.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worklist.html")
s = io.open(P, encoding="utf-8").read()


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d, found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


patch(
    "1. the three smalls become the one that is left, with its shape",

    "        <div class=\"body\"><b>Small things the agents disclosed rather than hid</b>\n"
    "          <p>The Docs block menu scrolls on a short screen (1100&#215;620). &#8220;Document "
    "type&#8230;&#8221; opens at the page&#8217;s left edge. The confirm button is red even when the "
    "choice loses nothing.</p></div>\n"
    "        <div class=\"effort\">watch</div>",

    "        <div class=\"body\"><b>A red button on a choice that loses nothing</b>\n"
    "          <p><b>Two of the three small things here are closed</b>, re-measured at the same "
    "1100&#215;620 the complaint named: the Docs block menu is 382&#215;499 with nothing under the "
    "fold, and &#8220;Document type&#8230;&#8221; now opens 6px from the row it came from rather than "
    "at the page&#8217;s edge. The third is real, and turned out to be sharper than it looked.</p>\n"
    "          <p>The app already separates a <i>notice</i> &#8212; a gesture that must refuse, with "
    "no Cancel and no red &#8212; from a confirmation. What it has no shape for is a confirmation "
    "that destroys nothing. <code>requestConfirmation()</code> leaves the red on for all <b>46</b> "
    "callers, and several of them say in their own message that nothing is lost: &#8220;A snapshot of "
    "the current diagram is saved first&#8221;, &#8220;No diagram will be deleted&#8221;, &#8220;Undo "
    "restores it&#8221;. A red button is a promise that something will be destroyed, so this is the "
    "standing rule with a colour instead of a sentence.</p></div>\n"
    "        <div class=\"effort\">round 12</div>",
)

patch("2. the section note follows",
      '<h2>Watching</h2>',
      '<h2>Watching</h2>')

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, P)
print("worklist updated: %d bytes" % len(s.encode("utf-8")))
