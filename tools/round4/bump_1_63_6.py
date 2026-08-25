import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:80]); s = s.replace(a, b)
rep("const APP_VERSION = '1.63.5';", "const APP_VERSION = '1.63.6';")
rep("""      const CHANGELOG = [
        {
          version: '1.63.5',""",
    """      const CHANGELOG = [
        {
          version: '1.63.6',
          notes: [
            'Present opens with the diagram, not with your control room. Pressing Present used to put 44 controls on screen \u2014 a stopwatch, a pen colour, Record, Snapshot, Export notes and seven panels down the left \u2014 in front of whoever you were presenting to, and squeezed the diagram into what was left. It opens with six now. The Studio button in the bar opens the console when you want it, and remembers that you do.'
          ]
        },
        {
          version: '1.63.5',""")
io.open(APP + '.tmp', 'w', encoding='utf-8', newline='').write(s); os.replace(APP + '.tmp', APP)
print('1.63.6 applied: %d -> %d' % (len(orig), len(s)))
