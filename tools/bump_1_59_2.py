r"""1.59.2 - the four XS polish items closed; version + changelog, and the comment box scrolls
clear of the inspector's sticky footer (block: 'center', not 'nearest')."""
import io, os, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# the box sat under the sticky Reset/Done footer with 'nearest'
rep("""              if (disclosure && !disclosure.open) disclosure.open = true;
              if (box && box.getBoundingClientRect().width > 0) { box.focus({ preventScroll: true }); box.scrollIntoView({ block: 'nearest' }); }""",
    """              if (disclosure && !disclosure.open) disclosure.open = true;
              if (box && box.getBoundingClientRect().width > 0) { box.focus({ preventScroll: true }); box.scrollIntoView({ block: 'center' }); }""")

rep("const APP_VERSION = '1.59.1';", "const APP_VERSION = '1.59.2';")
rep("""      const CHANGELOG = [
        {
          version: '1.59.1',""",
    """      const CHANGELOG = [
        {
          version: '1.59.2',
          notes: [
            'Right-click a block and choose \u201cAdd comment\u2026\u201d: the Comments section opens and the box takes focus itself, ready to type into.',
            'In the guided editor, Alt+\u2191 / Alt+\u2193 moves a line one visible slot, a blank line included \u2014 the same place a drop lands, so the arrows and the drag agree.',
            'While you drag a diagram on the board, an empty Unfiled appears as a drop target, so a diagram can always be taken back out of its project.'
          ]
        },
        {
          version: '1.59.1',""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('1.59.2 applied: %d -> %d chars' % (len(orig), len(s)))
