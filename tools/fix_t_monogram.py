"""Rebuild the T-Industries monogram at the proportions of the owner's drawing.

The pack's T is topologically right — hollow bar, open lower stem, short lower-right
return, separate internal vertical — but drawn far too spindly. Measured off the
owner's 1250px drawing against the 788px frame:

    top bar   62% of the frame width   (pack: 54%)
    stem      22% of the frame width   (pack: 15%)  <- the visible error
    stem foot 80.5% down the frame     (pack: 77%)

The stem is the one that reads as wrong: a 15%-wide stem under a 2.1 stroke leaves a
3.9-unit interior that closes up, so the letter looks like a stick rather than an
outlined form. At 22% the interior is 7.2 and the T holds its shape down to 20px.

The monogram is baked at a different scale into every asset with no transform to
key off, so each instance is located by its own frame rect and rewritten in that
instance's own coordinate space.
"""
import io, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'

# frame rect, then bar rect, then the stem path, then the internal vertical
T_GROUP = re.compile(
    r'(<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="[\d.]+" rx="[\d.]+"'
    r' fill="none" stroke="([^"]+)" stroke-width="([\d.]+)"/>)'
    r'<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" rx="([\d.]+)"'
    r' fill="none" stroke="[^"]+" stroke-width="([\d.]+)"/>'
    r'<path d="M [\d.]+ [\d.]+ V [\d.]+ H [\d.]+ V [\d.]+"[^>]*/>'
    r'<line x1="[\d.]+" y1="[\d.]+" x2="[\d.]+" y2="[\d.]+"[^>]*/>')

# the rebuilt letterform, in the 64-unit reference grid
F = 52.0
BAR_W, STEM_W = F * 0.62, F * 0.22
BAR_TOP, BAR_BOT = 19.0, 27.0
FOOT = 6 + F * 0.805
BAR_X = 6 + (F - BAR_W) / 2
LEFT = 32.0 - STEM_W / 2
RIGHT = 32.0 + STEM_W / 2
RETURN_TOP = FOOT - 3.0          # the short lower-right return
STEM_STOP = FOOT - 5.4           # the internal vertical stops clear of it


def rebuild(m):
    frame, fx, fy, fw, ink, fsw, bar_rx, sw = m.groups()
    fx, fy, fw, sw = float(fx), float(fy), float(fw), float(sw)
    s = fw / F                      # this instance's scale
    ox, oy = fx - 6 * s, fy - 6 * s
    X = lambda v: '%.3f' % (ox + v * s)
    Y = lambda v: '%.3f' % (oy + v * s)
    half = sw / 2.0                 # verticals are centred on the stem's edges
    lc = ox + LEFT * s + half
    rc = ox + RIGHT * s - half
    return (frame
            + '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="none"'
              ' stroke="%s" stroke-width="%.3f"/>'
              % (X(BAR_X), Y(BAR_TOP), '%.3f' % (BAR_W * s), '%.3f' % ((BAR_BOT - BAR_TOP) * s),
                 bar_rx, ink, sw)
            + '<path d="M %.3f %s V %s H %.3f V %s" fill="none" stroke="%s"'
              ' stroke-width="%.3f" stroke-linecap="butt" stroke-linejoin="miter"/>'
              % (lc, Y(BAR_BOT), Y(FOOT), rc, Y(RETURN_TOP), ink, sw)
            + '<line x1="%.3f" y1="%s" x2="%.3f" y2="%s" stroke="%s"'
              ' stroke-width="%.3f" stroke-linecap="butt"/>'
              % (rc, Y(BAR_BOT), rc, Y(STEM_STOP), ink, sw))


report = []
for name in sorted(os.listdir(SRC)):
    if not name.endswith('.svg'):
        continue
    path = os.path.join(SRC, name)
    svg = io.open(path, encoding='utf-8').read()
    out, n = T_GROUP.subn(rebuild, svg)
    if n:
        io.open(path, 'w', encoding='utf-8', newline='\n').write(out)
        report.append('%-46s %d monogram%s rebuilt' % (name, n, '' if n == 1 else 's'))

print('\n'.join(report) if report else 'no monogram matched')
