import io, os, sys, hashlib

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read()
before = len(s)
DASH = u'—'

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

rep("APP_VERSION = '1.65.0'", "APP_VERSION = '1.66.0'")

NOTES = [
    u"The block inspector and the connector inspector can be moved. Drag either one by its header "
    u"and it stays where you put it, so the card no longer sits on top of the very block you are "
    u"editing. It still opens beside what you clicked the first time, and it comes back to your "
    u"chosen place afterwards " + DASH + u" unless that would cover the block, in which case it steps aside on "
    u"its own. Arrow keys nudge it when the header has focus.",

    u"Every shape is on the canvas now. Adding a block used to offer five choices out of the "
    u"fifteen the app knows; the other ten were reachable only from the side panel. The row still "
    u"opens with the five you use most " + DASH + u" press “All 15 shapes” and the rest are there, with the "
    u"mouse wheel scrolling the row sideways and a quiet cue showing there is more.",

    u"Clicking a block in the map takes you into that diagram, at that block. It used to only mark "
    u"the block and leave you where you were. Marking a block for a slide is still there on "
    u"Shift+click, so nothing you could build before is lost, and the hint line names both.",

    u"A long document in Docs has a navigation rail: a thin strip down the edge with one mark per "
    u"heading, indented by level. The mark for the section you are reading is lit, hovering shows "
    u"the titles, and clicking jumps there. A document with no headings shows nothing at all.",

    u"The second layout engine no longer pretends to be local. “ELK” now reads “ELK · online · dense "
    u"diagrams” and says, before you choose it, that it fetches about 500 KB from the internet, that "
    u"it cannot load with the network unplugged, and that a diagram arranged with it may come out "
    u"differently on a machine without a connection."
]

BLOCK = u"      const CHANGELOG = [\n        {\n          version: '1.66.0',\n          notes: [\n"
for i, n in enumerate(NOTES):
    BLOCK += u"            '" + n.replace(u"\\", u"\\\\").replace(u"'", u"\\'") + u"'" + (u"," if i < len(NOTES) - 1 else u"") + u"\n"
BLOCK += u"          ]\n        },\n        {\n          version: '1.65.0',"

rep(u"      const CHANGELOG = [\n        {\n          version: '1.65.0',", BLOCK)

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied %d -> %d' % (before, len(s)))
print('sha %s' % hashlib.sha256(io.open(APP, 'rb').read()).hexdigest().upper())
