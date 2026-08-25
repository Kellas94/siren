"""Update the worklist artifact for v1.70.0. Anchor-guarded, same discipline as the app patches."""
import io, os

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worklist.html")
s = io.open(P, encoding="utf-8").read()


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d, found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


# ---------- masthead ----------
patch("1. version stamp",
      "<span>version <b>1.69.0</b></span>\n      <span><b>8,563,119</b> bytes</span>",
      "<span>version <b>1.70.0</b></span>\n      <span><b>8,591,186</b> bytes</span>")

patch("2. the standfirst leads with what verification caught this time",
      "<b>Three rounds of the second engineer landed in a day, and none of them passed verification as "
      "delivered.</b> Round 7 had two of four jobs wrong; round 8 opened a way to write into a "
      "document’s own front matter; round 9 stored an invisible character in every paragraph that "
      "ended in a space. All three were caught before the live file, by driving the build with real "
      "keyboard and mouse rather than reading a diff.",

      "<b>Round 10 is the first round of the second engineer to pass verification as delivered — "
      "and the ship-blocker the same pass found was mine.</b> Eight lines below his work, a block "
      "written for the old editor tab was still painting the new one disabled: it read “Guided”, "
      "told you the visual builder could not help, and worked anyway when you clicked it. A control "
      "that names an action, performs it, and says it cannot. Rounds 7, 8 and 9 each failed the same "
      "pass before it; all four were caught before the live file, by driving the build with real "
      "keyboard and mouse rather than reading a diff.")

# ---------- in flight ----------
patch("3. round 10 shipped, round 11 is the one out",
      '<span class="tally">round 10 out</span>',
      '<span class="tally">round 11 out</span>')

patch("4. the Codex card becomes round 11",
      "        <span class=\"chip run\"><i class=\"dot\"></i>Codex</span>\n"
      "        <h3>Round 10 &#8212; closing the tail</h3>\n"
      "        <p>Three jobs, deliberately small: <code>/</code> then Backspace then <code>/</code> leaves you with\n"
      "        <code>//</code> and no menu; two of the four Docs submenu rows still open ~600px from the click; and one\n"
      "        reordering &#8212; a scrollable flag computed thirteen lines before the width squeeze, so a narrowed menu\n"
      "        hides a row in silence and cuts glyphs out of another.</p>\n"
      "        <footer>Told explicitly not to touch the editor mode row, which is being rewritten at the same time</footer>",

      "        <span class=\"chip run\"><i class=\"dot\"></i>Codex</span>\n"
      "        <h3>Round 11 &#8212; the tour that eats what you type</h3>\n"
      "        <p><b>About 2.3 seconds into a first visit, the welcome tour takes the keyboard.</b> Typing\n"
      "        &#8220;Review request&#8221; into the box the product points you at leaves <b>&#8220;Revie&#8221;</b> &#8212;\n"
      "        nine characters destroyed, focus on the tour&#8217;s Next button, and the tour advanced to 3/6 by the\n"
      "        person&#8217;s own keystrokes. Nothing warns; the status strip still reads &#8220;Syntax looks valid.&#8221;</p>\n"
      "        <p>Then: a 44-block diagram exports to PowerPoint as 6pt text in 4.7pt boxes, clipped and silent;\n"
      "        and following a reference from a document opens the diagram but selects nothing, because a four-line\n"
      "        branch throws away the block it had already resolved.</p>\n"
      "        <footer>It is first-run only &#8212; press F5 to check it and you measure a path where the tour never appears</footer>")

patch("5. the slot card records what verification found in it",
      "        <footer>The app already had the idea; one line named the tab after two of the three builders</footer>",

      "        <p><b>Verification then found the ship-blocker in this very patch.</b> Eight lines below it, a block\n"
      "        written for the old tab still painted the new one <code>aria-disabled</code>: it read Guided, said the\n"
      "        builder does not cover this type, and worked when clicked. Playwright refused the click on\n"
      "        <code>aria-disabled</code> grounds &#8212; a fair proxy for keyboard and screen-reader users, who were\n"
      "        being told a live control was dead.</p>\n"
      "        <footer>The app already had the idea; one line named the tab after two of the three builders</footer>")

# ---------- shipped ----------
patch("6. the shipped tally",
      '<span class="tally">1.44.1 → 1.69.0</span>',
      '<span class="tally">1.44.1 → 1.70.0</span>')

ROW = (
    '      <div class="ship-row">\n'
    '        <div class="what"><b>1.70.0 &#8212; the second editor tab tells the truth, and three menus keep their words</b>\n'
    '          <span><b>The tab beside Code now names the editor it opens, on every kind of diagram.</b> It used to say '
    '&#8220;Visual&#8221; on all twenty types while the visual builder can only edit flowcharts; on the sixteen it cannot '
    'touch it was greyed out, and pressing it anyway opened a panel that promised blocks and then explained it could make '
    'none. It reads Build, Sequence or Guided now, and goes there. The heading above the editor follows it &#8212; '
    '&#8220;Guided lines&#8221; when the Guided rows are what you are looking at. <b>Each tab also has a description of '
    'its own</b>; all three used to describe the visual builder, including on a sequence diagram. '
    '<b>The window and the browser tab use the name you typed</b> rather than the label the app generates, and keep up '
    'while you are still typing it. <b>Two new themes</b> &#8212; Wonders night and day, 39 in all &#8212; and one group '
    'fewer: four instead of five, with &#8220;Japan Collection&#8221; simply called Japan so it matches the pill that '
    'jumps to it, Signature folded into Worlds, and <b>the phone list grouped the same way as the menu, which it was '
    'not</b>. <b>A long name in a right-click menu stays on the screen and wraps</b> &#8212; a name with no spaces and no '
    'hyphens, which is what a workpaper file name is, used to hold the menu wider than a narrow window: on a 412-pixel '
    'screen it hung 75 pixels off the left edge, taking the start of the name and the left edge of every row with it. '
    '<b>A slash you deleted can be typed again</b> &#8212; the second &#8220;/&#8221; used to give you &#8220;//&#8221; and '
    'no menu, so the recovery the app offers could only be used once. <b>&#8220;Turn into&#8221; and &#8220;Mark as&#8221; '
    'open where you clicked</b>, instead of anywhere from a few pixels to 501 away at the block&#8217;s left edge. '
    '<b>And a menu squeezed into a very narrow window keeps its words</b>: between about 240 and 256 pixels the Present '
    'menu&#8217;s PowerPoint row ran past the edge and the end of the sentence was cut. <b>Two release-note sentences were '
    'corrected before this shipped</b>, both by measuring the shipped 1.69.0 rather than trusting the draft &#8212; that '
    'check has now caught eighteen would-be broken promises across four rounds.</span></div>\n'
    '        <div class="ver">1.70.0</div>\n'
    '      </div>\n\n'
)

patch("7. the 1.70.0 row",
      '    <div class="shipped">\n\n      <div class="ship-row">\n        <div class="what"><b>1.69.0 &#8212;',
      '    <div class="shipped">\n\n' + ROW + '      <div class="ship-row">\n        <div class="what"><b>1.69.0 &#8212;')

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, P)
print("worklist updated: %d bytes" % len(s.encode("utf-8")))
