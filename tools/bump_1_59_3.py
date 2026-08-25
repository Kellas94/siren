r"""1.59.3 - board: overlapping renders no longer duplicate sections and cards."""
import io, os, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

rep("const APP_VERSION = '1.59.2';", "const APP_VERSION = '1.59.3';")
rep("""      const CHANGELOG = [
        {
          version: '1.59.2',""",
    """      const CHANGELOG = [
        {
          version: '1.59.3',
          notes: [
            'Collapsing or expanding several projects in quick succession no longer leaves duplicate sections and cards on the board \u2014 a render overtaken by a newer one now stops instead of finishing into the live grid.'
          ]
        },
        {
          version: '1.59.2',""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('1.59.3 applied: %d -> %d chars' % (len(orig), len(s)))
