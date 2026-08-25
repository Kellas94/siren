import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (c, a[:80])
    s = s.replace(a, b)

rep("const APP_VERSION = '1.63.6';", "const APP_VERSION = '1.64.0';")
rep("""      const CHANGELOG = [
        {
          version: '1.63.6',""",
    """      const CHANGELOG = [
        {
          version: '1.64.0',
          notes: [
            'Git graphs have colours you can set. Each branch gets a row in Style with its own colour and a contrast reading beside it, so you can see whether the label will be legible before you choose. A diagram that sets its own colours in its code keeps them and says so, and when a graph has more branches than Mermaid has colours, the rows tell you which branch shares which.',
            'A diagram that is drawn from its code \\u2014 a git graph, a sequence, a gantt \\u2014 is no longer dead to the pointer: click a part to find its line in the code, right-click for fit, size, export and colours, and a quiet line says this one is edited as code.',
            'The Guided editor works inside the pop-out window: the Text / Guided switch moved in with it, and the chips, the drag-to-reorder, Alt+\\u2191 / Alt+\\u2193 and the line menu all work in the floating window. Esc brings it back to the column.',
            'Long lines wrap. The Wrap checkbox never actually did anything \\u2014 a stylesheet rule outranked it \\u2014 so it is gone and wrapping is simply on, with the line numbers following the wrapped text instead of drifting away from it.',
            'On Cupertino Glass the block menu was too see-through to read or aim at. Every floating surface the canvas raises now sits on a solid ground on those finishes, and the row you are on keeps its contrast.',
            '\\u201cStyle \\u00b7 title, fonts, spacing, block styling, legend\\u201d opens as six named doors instead of fifty-nine controls: the card is a quarter of the height it was, and everything that was in it is still there behind the door it belongs to.',
            'Connect left the toolbar on a computer \\u2014 it is on a block\\u2019s right-click menu \\u2014 but stayed on a phone, where it is the only way to join two blocks with a finger.'
          ]
        },
        {
          version: '1.63.6',""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('1.64.0 applied: %d -> %d' % (len(orig), len(s)))
