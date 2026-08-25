"""Third pass: the Codex section still described round 7. Bring it to rounds 8-11."""
import io, os

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "worklist.html")
s = io.open(P, encoding="utf-8").read()

OLD_A = """      <div class="panel">
        <h3>What round 7 delivered</h3>
        <ul>
          <li><b>Starter type persists</b><span>The strongest item by a distance: 19 of 19 types verified with real mouse gestures, against a base that separates on eleven of them. It also fixed Pie and Swimlane, which nobody had claimed.</span></li>
          <li><b>Eleven families stopped lying about their counts</b><span>&#8220;0 blocks &#183; 0 connections&#8221; was never true for any code-first type. They now say nothing, which is better.</span></li>
          <li><b>Eight menu headings, not the four claimed</b><span>XY chart, Pie chart, C4 context, Timeline &#8212; plus Mindmap, Architecture, Block diagram and Kanban.</span></li>
          <li><b>Type-aware titles</b><span>An untouched title follows the family instead of calling everything a flowchart.</span></li>
        </ul>
      </div>

      <div class="panel">
        <h3>And what it got wrong</h3>
        <ul>
          <li><b>Both failures were one step sideways</b><span>From the fixture each patch was written for. A sequence diagram with no <code>participant</code> lines; a second diagram opened within nine seconds. On the chosen fixtures every number was green.</span></li>
          <li><b>That is now the round 8 instruction</b><span>Test one step sideways from your own fixture, every time &#8212; ordinary input, not hostile input. And a check that finds nothing on both builds has established nothing.</span></li>
          <li><b>The census red was real and pre-existing</b><span>He said so and I verified it: it fails identically on the frozen base. Stale harness expectation, not an app defect.</span></li>
        </ul>
      </div>"""

NEW_A = """      <div class="panel">
        <h3>Where it stands after four rounds</h3>
        <ul>
          <li><b>Round 10 is the first to pass as delivered</b><span>An adversarial pass drove AS, AT and AU with real keyboard and mouse and could not break any of them. Rounds 7, 8 and 9 each failed the same pass: two of four jobs wrong; a way to write a Mermaid node inside a document&#8217;s own front matter; an invisible character stored in every paragraph ending in a space.</span></li>
          <li><b>He corrected the brief, and he was right</b><span>Round 10&#8217;s brief said moving three lines was the whole of job AU. He measured it, found the Present row still clipped at four widths, did the extra work and said the brief had been wrong. He also corrected his own round 9 wording rather than leaving it standing. That is worth more than the patch.</span></li>
          <li><b>Every round replays byte-exact</b><span>Input SHA, output SHA and byte count pinned per script, atomic writes, exact occurrence counts guarded before any replacement. A deliberate attempt to re-apply a patch to its own output exits 1 on the input guard.</span></li>
          <li><b>The split holds</b><span>Two engines on one file, divided by what the change touches rather than by feature. Round 10 was told not to go near the editor mode row; a zero-context diff confirms it did not.</span></li>
        </ul>
      </div>

      <div class="panel">
        <h3>And what the verification still finds</h3>
        <ul>
          <li><b>This time the ship-blocker was mine</b><span>Eight lines below his work, a block written for the old editor tab still painted the new one <code>aria-disabled</code>: it read &#8220;Guided&#8221;, said the visual builder could not help, and worked anyway when clicked. The adversarial pass found it in a merged-only change that no round 10 job covered.</span></li>
          <li><b>Two claims per round survive into the changelog draft</b><span>&#8220;Overflow now shows a scrollbar&#8221; &#8212; the old build already drew one. &#8220;The Present row was clipped at 300px&#8221; &#8212; it overran by two tenths of a pixel. &#8220;Pressing the greyed tab did nothing&#8221; &#8212; it opens a panel that then says it cannot help. Eighteen caught so far; none shipped.</span></li>
          <li><b>Harness numbers are checked too</b><span>Round 10&#8217;s probe library measured the content box where <code>overflow:auto</code> clips at the padding box, so every emitted cut was 5px too large; the prose was right and the artefacts on disk contradicted it. One column of its coordinate matrix landed on the document register rather than on a block.</span></li>
          <li><b>And three of ours were wrong the same day</b><span>The smoke test read its path positionally, so <code>--app</code> became the filename and the server 404&#8217;d every request &#8212; it had been reporting a working app as broken on every build. Check the harness before blaming the build.</span></li>
        </ul>
      </div>"""

assert s.count(OLD_A) == 1
s = s.replace(OLD_A, NEW_A, 1)
print("  applied: the Codex section covers rounds 8-11")

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, P)
print("worklist updated: %d bytes" % len(s.encode("utf-8")))
