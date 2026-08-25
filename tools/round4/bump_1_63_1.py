import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:80]); s = s.replace(a, b)
rep("const APP_VERSION = '1.63.0';", "const APP_VERSION = '1.63.1';")
rep("""      const CHANGELOG = [
        {
          version: '1.63.0',""",
    """      const CHANGELOG = [
        {
          version: '1.63.1',
          notes: [
            'The guided editor loses its \u201c+ Block\u201d and \u201c+ Connection\u201d bar: both are on a line\u2019s right-click menu, which is where the hint above the lines already sends you, and there is always a line to right-click. The block count moves up beside the hint, so the lines get the whole pane. On a page with nothing on it yet, one quiet \u201c+ Add the first block\u201d appears until there is a block.'
          ]
        },
        {
          version: '1.63.0',""")
io.open(APP + '.tmp', 'w', encoding='utf-8', newline='').write(s); os.replace(APP + '.tmp', APP)
print('1.63.1 applied: %d -> %d' % (len(orig), len(s)))
