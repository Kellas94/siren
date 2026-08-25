"""Two corrections to the SIREN brand SVGs, from the owner's reference renders.

1. THE DIAMOND ON THE E's THIRD LINE. In the reference the square and the circle
   sit against their lines, but the diamond stands clear of its line with a small
   gap. In the SVGs all three merge: the third line runs under the diamond's left
   vertex, and because that vertex is thinner than the stroke it reads as a pinched
   waist rather than a separated terminal. Each third line is pulled back so the
   gap equals its own stroke width.

2. THE T MONOGRAM'S STEM. The stem path starts inside the top bar with a round cap,
   which paints a visible blob where the two meet, and its two verticals sit 6 units
   apart under a 2.1 stroke, leaving a 3.9 interior that closes up at small sizes.
   The stem is redrawn to start flush with the bar on a butt cap and to hold an
   even interior.

Run on a directory of SVGs; rewrites in place.
"""
import io, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'

# ---------------------------------------------------------------- the diamond gap
DIAMOND = re.compile(
    r'<path d="M\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)\s+'
    r'L\s*([\d.]+)\s+([\d.]+)\s+L\s*([\d.]+)\s+([\d.]+)\s+Z"[^>]*/>')
LINE = re.compile(r'<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"'
                  r' stroke="[^"]*" stroke-width="([\d.]+)"[^>]*/>')


def fix_diamond_gap(svg):
    """Pull back any line that runs into a diamond's left vertex."""
    diamonds = []
    for m in DIAMOND.finditer(svg):
        xs = [float(m.group(i)) for i in (1, 3, 5, 7)]
        ys = [float(m.group(i)) for i in (2, 4, 6, 8)]
        diamonds.append({'left': min(xs), 'cy': sum(ys) / 4.0})
    if not diamonds:
        return svg, 0

    moved = 0

    def shrink(m):
        nonlocal moved
        x1, y1, x2, y2, w = (float(m.group(i)) for i in range(1, 6))
        if abs(y1 - y2) > 0.5:
            return m.group(0)
        for d in diamonds:
            if abs(d['cy'] - y1) > 1.0:
                continue
            # A round cap extends the painted line by half the stroke, so measure
            # from there, and leave one stroke width of clean paper.
            target = d['left'] - w - w / 2.0
            if x2 <= target + 0.05:
                continue
            moved += 1
            return m.group(0).replace('x2="%s"' % m.group(3),
                                      'x2="%s"' % ('%.3f' % target))
        return m.group(0)

    return LINE.sub(shrink, svg), moved


# ---------------------------------------------------------------- the T stem
OLD_STEM = (
    '<path d="M 27 26 V 46 H 35 V 42" fill="none" stroke="{ink}" stroke-width="2.1"'
    ' stroke-linecap="round" stroke-linejoin="round"/>'
    '<line x1="33" y1="26.5" x2="33" y2="40" stroke="{ink}" stroke-width="2.1"'
    ' stroke-linecap="butt"/>')
NEW_STEM = (
    # Flush with the bar's lower edge (the bar is y 19..27) on a butt cap, so no
    # bulge is painted over the bar, and a wider interior that survives 16px.
    '<path d="M 25.9 27 V 45.9 H 35.4 V 41.6" fill="none" stroke="{ink}"'
    ' stroke-width="2.1" stroke-linecap="butt" stroke-linejoin="miter"/>'
    '<line x1="34.1" y1="27" x2="34.1" y2="39.2" stroke="{ink}" stroke-width="2.1"'
    ' stroke-linecap="butt"/>')


def fix_t_stem(svg):
    for ink in ('#071B33', 'currentColor', '#FFFFFF', '#ffffff'):
        old, new = OLD_STEM.format(ink=ink), NEW_STEM.format(ink=ink)
        if old in svg:
            return svg.replace(old, new), 1
    return svg, 0


report = []
for name in sorted(os.listdir(SRC)):
    if not name.endswith('.svg'):
        continue
    path = os.path.join(SRC, name)
    svg = io.open(path, encoding='utf-8').read()
    svg, gaps = fix_diamond_gap(svg)
    svg, stem = fix_t_stem(svg)
    if gaps or stem:
        io.open(path, 'w', encoding='utf-8', newline='\n').write(svg)
        bits = []
        if gaps:
            bits.append('%d diamond gap%s' % (gaps, '' if gaps == 1 else 's'))
        if stem:
            bits.append('T stem redrawn')
        report.append('%-46s %s' % (name, ', '.join(bits)))

print('\n'.join(report) if report else 'nothing matched')
