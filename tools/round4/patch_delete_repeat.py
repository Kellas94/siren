r"""A held Delete key deleted line after line (and block after block).

Key auto-repeat: hold Delete and the browser sends the event again every few tens of
milliseconds. Five repeats removed five lines - each its own Undo step, so getting back
took five presses of Ctrl+Z. A delete is a decision, not a stream: one press, one line.
Both places that took Delete as a verb now ignore the repeats - the guided editor's rows
and the canvas ring.
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

# guided rows
rep("""          // Delete / Backspace on a focused line removes it, as on a block in the canvas.
          // An inline edit owns its own keys.
          if ((event.key === 'Delete' || event.key === 'Backspace') && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {""",
    """          // Delete / Backspace on a focused line removes it, as on a block in the canvas.
          // An inline edit owns its own keys. `repeat` is the held key: one press, one line.
          if ((event.key === 'Delete' || event.key === 'Backspace') && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {""")

# canvas ring
rep("""        if ((event.key === 'Delete' || event.key === 'Backspace') && !mod && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasDeleteAndHeal(canvasSelectedId);
          return;
        }""",
    """        if ((event.key === 'Delete' || event.key === 'Backspace') && !event.repeat && !mod && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasDeleteAndHeal(canvasSelectedId);
          return;
        }""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('delete-repeat guard applied: %d -> %d chars' % (len(orig), len(s)))
