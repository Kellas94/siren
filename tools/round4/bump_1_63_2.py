import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:80]); s = s.replace(a, b)
rep("const APP_VERSION = '1.63.1';", "const APP_VERSION = '1.63.2';")
rep("""      const CHANGELOG = [
        {
          version: '1.63.1',""",
    """      const CHANGELOG = [
        {
          version: '1.63.2',
          notes: [
            'Going to another diagram opened it instead of putting it away. Every tab carried a hide zone at its right edge that armed itself the moment the pointer entered the tab, so a click on the right-hand side of a tab \u2014 an ordinary place to click a wide one \u2014 removed that diagram from the bar. The \u00d7 now exists only on the tab you are already on; every other diagram is put away from its right-click menu. The \u00d7 is also drawn properly: it was tinted from the tab\u2019s own colour and invisible on a light theme.',
            'Holding Delete no longer deletes line after line in the guided editor, or block after block on the canvas: one press, one delete.',
            'A connector\u2019s caption in a PowerPoint deck takes the colour of what is behind it, so a caption inside a subgraph no longer wears a square of the slide\u2019s background.'
          ]
        },
        {
          version: '1.63.1',""")
io.open(APP + '.tmp', 'w', encoding='utf-8', newline='').write(s); os.replace(APP + '.tmp', APP)
print('1.63.2 applied: %d -> %d' % (len(orig), len(s)))
