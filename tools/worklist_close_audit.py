"""
Close the two outside-audit items that are actually done, and bring the third's numbers up to date.

  02  Cap the theme menu                already carried "(shipped)" and "done, 1.68.0" - a closed
                                        item sitting in an open list
  04  The theme the owner asked for     Wonders shipped in 1.70.0. Confirmed it is THAT theme and
                                        not merely a nice palette: the scene's own comment reads
                                        "a horizon of the human record drifting past, the era
                                        changing as it goes. Ten silhouettes in order, from before
                                        the common era to the rack that runs the model reading
                                        this." Antiquity to AI, which is what the item asked for.
                                        verify_wonders 14/14 on the shipped bytes.
  05  The central surface               STAYS OPEN - the three-workspace restructure is a design
                                        decision nobody has taken. But its numbers were from
                                        1.66.0, and the region it called the only one over budget
                                        is not over budget any more. Measured today on the shipped
                                        build: the preview toolbar holds six named actions plus the
                                        zoom cluster, against the review's threshold of seven.

The 43-control census is NOT restated. Re-counting it today gave 127 controls in the editor pane
alone, which means my selector counts content the original census excluded - a different definition,
not a changed app. A number I cannot reproduce the methodology for does not go on the page.
"""
import io, os, re

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worklist.html")
s = io.open(P, encoding="utf-8").read()

ITEM = re.compile(r'\n      <div class="item" data-sev="\d">\n        <div class="rank">(\d+)</div>.*?\n      </div>', re.S)


def section(name):
    i = s.find(name)
    assert i > 0, "no section %s" % name
    return s.rfind("<section", 0, i), s.find("</section>", i) + len("</section>")


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d, found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


# ---- 05 first, while its rank is still 05 ----
patch(
    "1. item 05 states today's toolbar rather than 1.66.0's",

    "<p>The review&#8217;s largest recommendation, and the one that sounded biggest until it was "
    "measured. At 1440&#215;900 with nothing open the app shows <b>43 controls of chrome</b> (plus 13 "
    "clickable drawing elements, which are content and belong there): header 5, workspace bar 5, "
    "editor pane 21, <b>preview toolbar 12</b>. The review&#8217;s threshold is seven permanent "
    "actions in the active toolbar, so <b>the preview toolbar is the only region measurably over "
    "budget</b> &#8212; and it is the same bar with 585px of empty space that has been an open design "
    "decision here for two days.</p>",

    "<p>The review&#8217;s largest recommendation, and the one that sounded biggest until it was "
    "measured. Its one measurably over-budget region was the preview toolbar, at 12 permanent "
    "controls against a threshold of seven. <b>That part is closed.</b> Re-measured on the shipped "
    "1.70.0: the bar holds <b>six named actions</b> &#8212; Filters, Flow, Inspect, Present, Hide "
    "panel and the walk-through hint &#8212; plus the zoom cluster, which came back onto the bar in "
    "1.69.0 at your request because folding it into a menu cost both a press and the readout.</p>\n"
    "          <p>The 1.66.0 census of <b>43 controls of chrome</b> is deliberately not restated. "
    "Counting it again today gave 127 in the editor pane alone, which means the selector I used "
    "counts content the original census excluded &#8212; a different definition, not a changed app. "
    "A number whose method cannot be reproduced does not belong on this page.</p>",
)


def close_items(heading, drop, label):
    global s
    start, end = section(heading)
    body = s[start:end]
    kept, removed = [], []
    def take(m):
        if m.group(1) in drop:
            removed.append(m.group(1)); return ""
        kept.append(m.group(1)); return m.group(0)
    body = ITEM.sub(take, body)
    assert set(removed) == set(drop), "%s: wanted %s, got %s" % (label, sorted(drop), sorted(set(removed)))
    s = s[:start] + body + s[end:]
    print("  %-24s closed %s, kept %s" % (label, ",".join(sorted(removed)), ",".join(kept)))


close_items("A UI/UX and product review of 1.66.0", {"02", "04"}, "outside audit")

# renumber that section on its own - it starts its own 01
start, end = section("A UI/UX and product review of 1.66.0")
n = [0]
def bump(m):
    n[0] += 1
    return '<div class="rank">%02d</div>' % n[0]
s = s[:start] + re.sub(r'<div class="rank">\d+</div>', bump, s[start:end]) + s[end:]
print("  outside audit renumbered to 01-%02d" % n[0])

patch("2. the audit tally",
      '<span class="tally">4 kept &#183; 4 rejected</span>',
      '<span class="tally">3 open &#183; 2 closed &#183; 4 rejected</span>')

RECORD = """
      <div class="panel" style="margin-top:6px">
        <h3>Closed since the review &#8212; measured, not assumed</h3>
        <ul>
          <li><b>The theme menu is capped</b><span>It opened 520&#215;800 with 263px permanently below the fold at every desktop size. Eight are shown now, the rest one press away, and it opens on the theme you are using &#8212; 39 themes, nothing hidden, nothing lost. <b>1.68.0</b></span></li>
          <li><b>The theme you asked for is in the app</b><span>Wonders, night and day. Its own scene is &#8220;a horizon of the human record drifting past, the era changing as it goes &#8212; ten silhouettes in order, from before the common era to the rack that runs the model reading this.&#8221; Antiquity to AI, which is what you asked for. <b>1.70.0</b></span></li>
        </ul>
      </div>
"""

start, end = section("A UI/UX and product review of 1.66.0")
body = s[start:end]
tail = "\n    </div>\n  </section>"
assert body.endswith(tail), repr(body[-70:])
s = s[:start] + body[: -len(tail)] + "\n    </div>\n" + RECORD + "  </section>" + s[end:]
print("  record panel added to the audit section")

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, P)
print("worklist updated: %d bytes" % len(s.encode("utf-8")))
