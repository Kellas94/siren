import io, os, sys, hashlib

# I wrote "three sheets - blocks, connections and the workspace" from the second engineer's
# summary without opening the file. Measured in real Excel on the workbook this build exports:
#   1 sheet per diagram, named after the diagram
#   the diagram drawn as 18 native Excel shapes
#   one native Excel table (TableStyleMedium2) with 32 columns: Type, ID, Label, Shape, From,
#   To, Connector, Connector label, Risk, Control, Owner, Evidence, Status, Reference,
#   Frequency, System, then the fill/border/font/layout columns
# The changelog must say what the file actually is.

DASH = u'—'

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read()
before = len(s)

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90])
    s = s.replace(a, b)

OLD = (u"'The Excel export is finished: three sheets " + DASH +
       u" blocks, connections and the workspace " + DASH +
       u" each a real Excel table you can sort and filter, not a grid of loose cells.'")

NEW = (u"'The Excel export is finished. Each diagram becomes its own sheet: the diagram itself is "
       u"drawn as native Excel shapes you can select and move, and underneath it sits a real Excel "
       u"table " + DASH + u" sortable and filterable, not a grid of loose cells " + DASH +
       u" with a row for every block and every connector, carrying the label, the shape, what it "
       u"joins, and the risk, control, owner, evidence and status you filled in.'")

rep(OLD, NEW)

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied %d -> %d' % (before, len(s)))
print('sha %s' % hashlib.sha256(io.open(APP, 'rb').read()).hexdigest().upper())
