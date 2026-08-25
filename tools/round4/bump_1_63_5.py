import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:80]); s = s.replace(a, b)
rep("const APP_VERSION = '1.63.4';", "const APP_VERSION = '1.63.5';")
rep("""      const CHANGELOG = [
        {
          version: '1.63.4',""",
    """      const CHANGELOG = [
        {
          version: '1.63.5',
          notes: [
            'The side handles connect the new step to the block you pressed them on. They used to hang it off whatever fed that block, so a step added beside the third box arrived attached to the second. Left and right are kept as far as a computed layout can keep them \u2014 the new connector is written before or after the block\u2019s other connectors, which is what decides left and right \u2014 and when the layout puts it somewhere else the message says so instead of pretending.'
          ]
        },
        {
          version: '1.63.4',""")
io.open(APP + '.tmp', 'w', encoding='utf-8', newline='').write(s); os.replace(APP + '.tmp', APP)
print('1.63.5 applied: %d -> %d' % (len(orig), len(s)))
