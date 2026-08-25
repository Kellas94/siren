"""
Close the Ideas and Cheap items that later releases actually closed.

Five of them were re-measured on the SHIPPED 1.70.0 today, not read out of a changelog:

  Ideas 04  the universal builder panel   8 code-first types now reach Guided with 2-5 real rows;
                                          the builder panel is not shown on any of them
  Ideas 05  a diagram PDF is a picture    5/5 types fonts=4 images=0, vector (export fidelity gate)
  Ideas 06  three things that lie         no "Style applied" toast on a gantt and the source is
                                          byte-identical; the status names the type instead of
                                          telling you to add a flowchart declaration
  Ideas 08  the honesty pass              "Kanban/Gantt/Pie chart Preview" not "Flowchart Preview";
                                          the picked type persists with New starter enabled; the
                                          chip is visible and its tooltip is per-type honest
  Cheap 12  fit fits the width            fitPageButton takes a 3,208px diagram to 545px and fits
                                          both axes; fitWidthButton is a separate control

Ideas 07 stays: it is a record to protect, not a task. 09 and 10 stay: both are decisions the owner
has not taken. Cheap 11 stays (the icon half; the title half closed in 1.70.0), 13 stays as round 11.

Runs on the worklist artifact source. Anchor-guarded like the app patches.
"""
import io, os, re

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worklist.html")
s = io.open(P, encoding="utf-8").read()

ITEM = re.compile(r'\n      <div class="item" data-sev="\d">\n        <div class="rank">(\d+)</div>.*?\n      </div>', re.S)


def section(name):
    """The [start, end) span of one section, found by its heading."""
    i = s.find(name)
    assert i > 0, "no section %s" % name
    start = s.rfind("<section", 0, i)
    end = s.find("</section>", i) + len("</section>")
    return start, end


def close_items(heading, drop, label):
    """Remove the named ranks from one section and renumber what is left."""
    global s
    start, end = section(heading)
    body = s[start:end]
    kept, removed = [], []
    def take(m):
        if m.group(1) in drop:
            removed.append(m.group(1))
            return ""
        kept.append(m.group(1))
        return m.group(0)
    body = ITEM.sub(take, body)
    assert set(removed) == set(drop), "%s: wanted %s, removed %s" % (label, sorted(drop), sorted(set(removed)))
    s = s[:start] + body + s[end:]
    print("  %-28s closed %s, kept %s" % (label, ",".join(sorted(removed)), ",".join(kept)))
    return kept


close_items("Ideas &#8212; not now", {"04", "05", "06", "08"}, "Ideas")
close_items("Cheap &#8212; when we are passing", {"12"}, "Cheap")


def retally(heading, text):
    global s
    start, end = section(heading)
    body = s[start:end]
    new = re.sub(r'<span class="tally">[^<]*</span>', '<span class="tally">%s</span>' % text, body, count=1)
    assert new != body, "tally not found in " + heading
    s = s[:start] + new + s[end:]


retally("Ideas &#8212; not now", "3 items &#183; 4 closed")
retally("Cheap &#8212; when we are passing", "2 items &#183; 1 closed")

# A short record at the foot of Ideas, so none of the five comes back next time somebody reads
# an old note. Each line carries the number that closed it, not the release note that claimed it.
RECORD = """
      <div class="panel" style="margin-top:6px">
        <h3>Closed since these were written &#8212; re-measured on the shipped 1.70.0</h3>
        <ul>
          <li><b>The universal builder panel</b><span>Thirteen types used to get the same panel, the same promise and 44 dead controls. Measured today across pie, kanban, gantt, class, state, mindmap, timeline and ER: every one reaches Guided with 2&#8211;5 real rows and the builder panel is not shown on any of them. Flowchart keeps the builder; sequence keeps its own. <b>1.70.0</b></span></li>
          <li><b>A diagram exported as PDF was a picture</b><span>Zero extractable text, zero embedded fonts, three times over. The export fidelity gate now reads <code>fonts=4 images=0 &#8594; vector</code> on all five types. The six remaining reds in that gate are pie, gantt and sequence through PowerPoint and Excel, which are pictures and say so on screen before you download. <b>1.67.0</b></span></li>
          <li><b>Three things that broke or claimed work they never did</b><span>On a gantt, pressing the style control now raises no &#8220;Style applied to block&#8221; and leaves the source byte-identical &#8212; it says the type is code-first and that nothing was changed. The kanban status line no longer tells you to add a flowchart declaration; it names your own type back to you. <b>1.67.0</b></span></li>
          <li><b>The honesty pass</b><span>A pie chart is titled &#8220;Pie chart Preview&#8221;, not &#8220;Flowchart Preview&#8221;. Choosing Kanban, Mindmap or Block keeps it, with New starter enabled. The type chip is visible and its tooltip is honest per type &#8212; &#8220;Full visual editing is available&#8221; only where it is. <b>1.67.0&#8211;1.68.0</b></span></li>
          <li><b>Fit fitted only the width</b><span>A 3,208px-tall diagram now comes down to 545px and fits both axes, under a tooltip that says &#8220;Fit the whole diagram in the pane&#8221;. Fitting the width is a separate button with its own wording. <b>1.67.0</b></span></li>
        </ul>
      </div>
"""

start, end = section("Ideas &#8212; not now")
body = s[start:end]
tail = "\n    </div>\n  </section>"
assert body.endswith(tail), repr(body[-60:])
body = body[: -len(tail)] + "\n    </div>\n" + RECORD + "  </section>"
s = s[:start] + body + s[end:]
print("  record panel added to Ideas")

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, P)
print("worklist updated: %d bytes" % len(s.encode("utf-8")))
