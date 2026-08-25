"""Tighten the SIREN brand SVGs.

The artwork sits inside view boxes with large, uneven, hand-set margins: the
standalone symbol fills 40% x 45% of its box and is 11 units off centre, so asking
for a 24px mark actually paints an 11px one, off to one side. This rewrites each
view box to the measured content plus one deliberate, uniform margin, and emits a
theme-aware variant whose strokes and fills follow currentColor.

Reads bbox.json (measured in a real browser via getBBox) and writes ./fixed/.
"""
import io, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
BB = json.load(io.open(os.path.join(HERE, 'bbox.json'), encoding='utf-8'))
OUT = os.path.join(HERE, 'fixed')
os.makedirs(OUT, exist_ok=True)

# Margin as a share of the content's larger side. Icons already carry a frame, so
# they keep the frame's own breathing room and only get centred.
MARGIN = 0.06
BRAND_INK = re.compile(r'#071B33', re.I)


def tighten(name, svg, box):
    vb, bb, bleed = box['vb'], box['bb'], box['bleed']
    if bleed:
        # A full-bleed background defines the canvas; centre the artwork inside it
        # instead of cropping to it, otherwise the plate disappears.
        return svg, 'kept (background plate)'
    x, y, w, h = bb
    if w <= 0 or h <= 0:
        return svg, 'skipped (no measurable content)'
    # The icons, favicons and monogram already carry a frame whose margin is a
    # design decision. They were measured centred and well filled, so re-padding
    # them would only shrink the artwork. Leave anything already tight alone.
    fill = max(w / vb[2], h / vb[3])
    off = max(abs((x - vb[0]) - ((vb[0] + vb[2]) - (x + w))),
              abs((y - vb[1]) - ((vb[1] + vb[3]) - (y + h))))
    if fill >= 0.78 and off <= 2:
        return svg, 'kept (already tight and centred)'
    pad = max(w, h) * MARGIN
    nx, ny, nw, nh = x - pad, y - pad, w + pad * 2, h + pad * 2
    new_vb = 'viewBox="%s %s %s %s"' % tuple(
        ('%.3f' % v).rstrip('0').rstrip('.') for v in (nx, ny, nw, nh))
    out = re.sub(r'viewBox="[^"]*"', new_vb, svg, count=1)
    # width/height must follow the new aspect ratio or the mark distorts.
    out = re.sub(r'\swidth="[^"]*"', ' width="%d"' % round(nw), out, count=1)
    out = re.sub(r'\sheight="[^"]*"', ' height="%d"' % round(nh), out, count=1)
    before = (w / vb[2] * 100, h / vb[3] * 100)
    after = (w / nw * 100, h / nh * 100)
    return out, 'fill %.0f%%x%.0f%% -> %.0f%%x%.0f%%' % (before + after)


report = []
for name in sorted(BB):
    src = io.open(os.path.join(HERE, name), encoding='utf-8').read()
    fixed, note = tighten(name, src, BB[name])
    io.open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n').write(fixed)
    # A theme-aware twin: the app has 36 themes from paper-white to pure black, so
    # a mark frozen at #071B33 is invisible on half of them.
    themed = BRAND_INK.sub('currentColor', fixed)
    if themed != fixed:
        io.open(os.path.join(OUT, name.replace('.svg', '.currentcolor.svg')),
                'w', encoding='utf-8', newline='\n').write(themed)
    report.append('%-46s %s' % (name, note))

print('\n'.join(report))
print('\nwritten to', OUT)
