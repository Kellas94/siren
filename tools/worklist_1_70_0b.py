"""Second pass on the worklist: close what 1.70.0 closed, move what round 11 took."""
import io, os

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worklist.html")
s = io.open(P, encoding="utf-8").read()


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d, found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


patch("1. working on now: round 10 is shipped, round 11 is what comes back",
      "<div class=\"body\"><b>Integrate round 10, then ship</b>\n"
      "          <p>Four patches already sit on top of round 9: two theme patches, one that stops a trailing\n"
      "          non-breaking space reaching storage, and one that widens a Guided gate. Round 10 lands on the same base,\n"
      "          then the release is cut and the changelog is written from what was measured.</p>\n"
      "          <p><b>Thirteen changelog sentences were caught as broken promises in the last round alone</b> &#8212;\n"
      "          among them &#8220;overflow now shows a scrollbar&#8221; (the old build already drew one), &#8220;the\n"
      "          click point travels through the block builder&#8221; (three rows of four), and &#8220;Guided editing now\n"
      "          works on diagrams with front matter&#8221; (it could write a node above the declaration). That check\n"
      "          stays part of shipping.</p></div>\n"
      "        <div class=\"effort\">next</div>",

      "<div class=\"body\"><b>Integrate round 11, then ship</b>\n"
      "          <p>Round 10 shipped in 1.70.0 together with seven patches of mine, replayed byte-exact from the frozen\n"
      "          base and verified on the shipped bytes rather than on a copy. Round 11 lands on that build: the tour\n"
      "          that eats what a first-time user types, the PowerPoint export that clips its own words, and the last\n"
      "          third of the Docs reference feature.</p>\n"
      "          <p><b>Eighteen changelog sentences have now been caught as broken promises across four rounds.</b> Two\n"
      "          of them were in this release&#8217;s own draft, and both were caught the same way &#8212; by measuring\n"
      "          the <i>shipped</i> build rather than trusting the sentence: &#8220;pressing the greyed tab did\n"
      "          nothing&#8221; (it opens a panel that then says it cannot help), and a menu heading described as cut at\n"
      "          a border when the whole menu was 75 pixels off the left edge of the screen. That check stays part of\n"
      "          shipping.</p></div>\n"
      "        <div class=\"effort\">next</div>")

patch("2. the window title half of item 11 is done; the icon half is not",
      "<div class=\"body\"><b>The window SIREN opens in says nothing about itself</b>\n"
      "          <p>Two things, both measured. <b>The title never changes:</b> <code>document.title</code> is assigned "
      "<b>zero</b> times in the whole file, so every window says &#8220;T-Industries SIREN&#8221; and three open copies "
      "are indistinguishable in the tab strip &#8212; which is exactly how you work. It should carry the workspace or "
      "the diagram you are in. <b>And the icon is the wrong mark:</b>",

      "<div class=\"body\"><b>The tab icon is not the brand mark</b>\n"
      "          <p><b>The title half of this is done</b> &#8212; the window carries the diagram you are in, and since "
      "1.70.0 it prefers the name you typed over the one the app generates, keeping up while you are still typing it. "
      "What is left is the icon.</p>\n"
      "          <p><b>The icon is the wrong mark:</b>")

patch("3. the tour item is round 11's first job now, and it is worse than this said",
      "<div class=\"body\"><b>The welcome tour follows you into Docs and points at nothing</b>\n"
      "          <p>Open Docs while the first-run tour is up and card 1 of 6 stays on screen at 300&#215;163, over the "
      "Docs sidebar, explaining a Visual / Code switch that is no longer there.</p></div>\n"
      "        <div class=\"effort\">next</div>",

      "<div class=\"body\"><b>The welcome tour follows you into Docs &#8212; and it also eats what you type</b>\n"
      "          <p>Open Docs while the first-run tour is up and card 1 of 6 stays on screen at 300&#215;163, over the "
      "Docs sidebar, explaining a Visual / Code switch that is no longer there.</p>\n"
      "          <p><b>Measuring that turned up something far worse, and it is round 11&#8217;s first job.</b> The card "
      "takes the keyboard about 2.3 seconds in: typing &#8220;Review request&#8221; leaves &#8220;Revie&#8221;, focus "
      "lands on the tour&#8217;s Next button, and the person&#8217;s own keystrokes advance the tour to 3/6. It stayed "
      "invisible for a full day of testing because the shared harness dismisses tour cards during settle, so every probe "
      "built on it was blind to it.</p></div>\n"
      "        <div class=\"effort\">round 11</div>")

patch("4. Codex has done eleven rounds, not eight",
      "<h2>Codex &#8212; eight rounds</h2>\n"
      "      <p class=\"sec-note\">Anchor-guarded, SHA-pinned patches against a frozen base. Round 8 is running.</p>\n"
      "      <span class=\"tally\">round 8 in flight</span>",

      "<h2>Codex &#8212; eleven rounds</h2>\n"
      "      <p class=\"sec-note\">Anchor-guarded, SHA-pinned patches against a frozen base. Round 11 is running.</p>\n"
      "      <span class=\"tally\">round 11 in flight</span>")

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, P)
print("worklist updated: %d bytes" % len(s.encode("utf-8")))
