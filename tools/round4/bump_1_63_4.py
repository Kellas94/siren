import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:80]); s = s.replace(a, b)
rep("const APP_VERSION = '1.63.3';", "const APP_VERSION = '1.63.4';")
rep("""      const CHANGELOG = [
        {
          version: '1.63.3',""",
    """      const CHANGELOG = [
        {
          version: '1.63.4',
          notes: [
            'A verb about a block is on that block. Right-clicking a block now offers \u201cAdd a step after\u201d and \u201cInsert a step before\u201d it; right-clicking the empty canvas offers \u201cNew block\u2026\u201d and the view actions, and no longer offers to add a step to a block that is somewhere else.'
          ]
        },
        {
          version: '1.63.3',""")
io.open(APP + '.tmp', 'w', encoding='utf-8', newline='').write(s); os.replace(APP + '.tmp', APP)
print('1.63.4 applied: %d -> %d' % (len(orig), len(s)))
