def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(h):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

P = {
    'canvasBg': '#101d33', 'text': '#f2ead9', 'muted': '#a9b6cd',
    'nodeFill': '#e6dcc3', 'nodeText': '#221c14', 'nodeBorder': '#8d6a3c',
    'nodeAccent': '#c9a227', 'nodeAccentBorder': '#f0d67a',
    'line': '#b08a52', 'edgeLabel': '#1a2a45', 'phosphor': '#6fe3d0',
}

# The pairs that decide whether a diagram theme is usable. 4.5 is the readable floor for
# body text, 3.0 for large text and for a shape's edge against its ground.
PAIRS = [
    ('block label on the block',      'nodeText',  'nodeFill',  4.5),
    ('decision label on the decision','nodeText',  'nodeAccent', 4.5),
    ('block edge against the canvas', 'nodeBorder','canvasBg',   3.0),
    ('decision edge against canvas',  'nodeAccentBorder','canvasBg', 3.0),
    ('connector against the canvas',  'line',      'canvasBg',   3.0),
    ('block against the canvas',      'nodeFill',  'canvasBg',   3.0),
    ('title on the canvas',           'text',      'canvasBg',   4.5),
    ('edge label text on its chip',   'muted',     'edgeLabel',  4.5),
    ('edge chip against the canvas',  'edgeLabel', 'canvasBg',   1.2),
    ('phosphor on the canvas',        'phosphor',  'canvasBg',   4.5),
]

print('%-34s %7s  %s' % ('pair', 'ratio', 'needs'))
print('-' * 60)
worst = []
for name, a, b, floor in PAIRS:
    r = ratio(P[a], P[b])
    ok = r >= floor
    if not ok:
        worst.append((name, r, floor))
    print('%-34s %6.2f:1  %.1f  %s' % (name, r, floor, 'ok' if ok else '<-- FAILS'))

print()
if worst:
    print('FAILS:')
    for n, r, f in worst:
        print('  %-32s %.2f:1 against a floor of %.1f' % (n, r, f))
else:
    print('every pair clears its floor')

DAY = {
    'canvasBg': '#e9dfc6', 'text': '#3b2f1e', 'muted': '#6d5c42',
    'nodeFill': '#fbf6ea', 'nodeText': '#2a2118', 'nodeBorder': '#7a5628',
    'nodeAccent': '#d8b23f', 'nodeAccentBorder': '#8a6412',
    'line': '#8d6a3c', 'edgeLabel': '#e4d9bd', 'phosphor': '#0a6d60',
}
print()
print('=== DAY (papyrus) ===')
print('%-34s %7s  %s' % ('pair','ratio','needs'))
print('-'*60)
bad=[]
for name,a,b,floor in PAIRS:
    r = ratio(DAY[a], DAY[b]); ok = r>=floor
    if not ok: bad.append((name,r,floor))
    print('%-34s %6.2f:1  %.1f  %s' % (name,r,floor,'ok' if ok else '<-- FAILS'))
print()
print('day fails:', [n for n,_,_ in bad] or 'none')
