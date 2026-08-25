r"""Guided editor: the "+ Block" / "+ Connection" footer goes.

Both verbs are on the line's right-click menu ("Insert block below", "Connect from here"),
which shipped with 1.63.0, and the hint above the rows already names that route. Measured:
the rows list is never empty - an empty source still renders line 1 - so there is always a
line to right-click, in every state. That makes the two buttons a duplicate route holding a
permanent 32px bar at the foot of the pane.

What replaces them: nothing, in the ordinary case. The block count moves up beside the hint,
so the whole footer row disappears. And because a first-timer with an empty diagram should
never be stuck hunting for a gesture, one quiet line - "+ Add the first block" - appears in
the rows area while the diagram has no blocks yet, and goes as soon as there is one.
"""
import io, os, sys

APP = sys.argv[1] if len(sys.argv) > 1 else None
if not APP:
    print(__doc__); sys.exit(2)
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- markup: hint row carries the count; footer gone
rep("""              <p class="struct-guide-hint">Click a chip to edit it in place. Drag a line number to reorder; right-click a line to add, move or delete it.</p>
              <div class="structure-rows" id="structureRows" role="list" aria-label="Diagram lines"></div>
              <div class="structure-footer">
                <button class="btn secondary compact" id="structureAddBlockButton" type="button">+ Block</button>
                <button class="btn ghost compact" id="structureAddLinkButton" type="button">+ Connection</button>
                <span class="structure-count" id="structureCount"></span>
              </div>""",
    """              <p class="struct-guide-hint"><span>Click a chip to edit it in place. Drag a line number to reorder; right-click a line to add, move or delete it.</span><span class="structure-count" id="structureCount"></span></p>
              <div class="structure-rows" id="structureRows" role="list" aria-label="Diagram lines"></div>""")

# ---------------------------------------------------------------- CSS
rep("""    .struct-guide-hint { margin: 0 0 7px; padding: 0 2px; color: var(--muted); font-size: 11px; line-height: 1.4; }""",
    """    .struct-guide-hint { display: flex; align-items: baseline; gap: 12px; margin: 0 0 7px; padding: 0 2px; color: var(--muted); font-size: 11px; line-height: 1.4; }
    .struct-guide-hint > span:first-child { min-width: 0; }
    .struct-guide-hint .structure-count { margin-left: auto; white-space: nowrap; font-variant-numeric: tabular-nums; }
    /* The one way in while the diagram is still empty; it goes as soon as a block exists. */
    .struct-first-block {
      display: block;
      width: 100%;
      margin-top: 4px;
      padding: 7px 10px;
      border: 1px dashed var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      text-align: left;
      cursor: pointer;
    }
    .struct-first-block:hover { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); color: var(--text); }
    .struct-first-block:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }""")

# ---------------------------------------------------------------- the empty-state line
rep(u"""        el.structureCount.textContent = namedBlocks.size + (namedBlocks.size === 1 ? ' block · ' : ' blocks · ')
          + linkCount + (linkCount === 1 ? ' connection' : ' connections');""",
    u"""        el.structureCount.textContent = namedBlocks.size + (namedBlocks.size === 1 ? ' block · ' : ' blocks · ')
          + linkCount + (linkCount === 1 ? ' connection' : ' connections');
        // Nothing to right-click a block into yet: offer the first one outright, once.
        // Only where a block is even the right thing - a flowchart, or a blank page that
        // is about to become one.
        const blankPage = !String(el.source.value || '').trim();
        if (!namedBlocks.size && !readOnlyMode && (blankPage || structureIsFlowchart())) {
          const first = document.createElement('button');
          first.type = 'button';
          first.className = 'struct-first-block';
          first.textContent = '+ Add the first block';
          first.addEventListener('mousedown', event => event.preventDefault());
          first.addEventListener('click', () => {
            // A blank page has no flowchart line to hang a block on; write one first.
            if (blankPage) writeStructureSource('flowchart TD');
            structureAddBlock(0);
          });
          el.structureRows.appendChild(first);
        }""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('guided footer removed: %d -> %d chars' % (len(orig), len(s)))
