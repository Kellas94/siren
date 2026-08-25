import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:80]); s = s.replace(a, b)
rep("const APP_VERSION = '1.63.2';", "const APP_VERSION = '1.63.3';")
rep("""      const CHANGELOG = [
        {
          version: '1.63.2',""",
    """      const CHANGELOG = [
        {
          version: '1.63.3',
          notes: [
            'Diagrams you put away have a way back. The count beside the tabs now says how many are out of the bar and opens a list: bring one back, or all of them. Before this the only route was a tooltip pointing somewhere else.',
            'A diagram that is put away still shows in the bar while you are on it \u2014 and then vanishes the moment you open another one, which looked like the click had thrown it away. Its tab now says so, with a dashed edge and a plain explanation.'
          ]
        },
        {
          version: '1.63.2',""")
io.open(APP + '.tmp', 'w', encoding='utf-8', newline='').write(s); os.replace(APP + '.tmp', APP)
print('1.63.3 applied: %d -> %d' % (len(orig), len(s)))
