"""Put the real KPMG mark into the KPMG intro overlay.

    python embed_kpmg_logo.py

Reads kpmg_mark.svg from this directory - the supplied brand SVG with Illustrator's
metadata and its hard-coded .st0{fill:#00338D} stripped, so the path takes
currentColor and the theme decides. Nothing is fetched; the app stays offline.

The mark slot is located structurally inside #kpmgIntroOverlay rather than by exact
markup, so this survives the intro being restyled.
"""
import io, os, shutil

SC = os.path.dirname(os.path.abspath(__file__))
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
MARK_START = '<div class="theme-intro-kanji">'

CSS = """    /* The supplied brand SVG, taking currentColor. KPMG blue on the day ground and
       the reversed white on night is the sanctioned pair, so the appearance drives it. */
    .kpmg-intro-logo {
      display: block;
      width: min(260px, 48vw);
      height: auto;
      margin: 0 auto;
      color: var(--primary);
    }
    body[data-theme="kpmg"][data-kpmg-variant="night"] .kpmg-intro-logo { color: #ffffff; }
"""


def mark_slot(s):
    """(start, end) of the intro's mark slot, matching its own closing </div>."""
    i = s.index('id="kpmgIntroOverlay"')
    j = s.index(MARK_START, i)
    depth, k = 0, j
    while True:
        nxt_open = s.find('<div', k + 1)
        nxt_close = s.index('</div>', k + 1)
        if nxt_open != -1 and nxt_open < nxt_close:
            depth += 1
            k = nxt_open
        else:
            if depth == 0:
                return j, nxt_close + len('</div>')
            depth -= 1
            k = nxt_close


def main():
    mark = io.open(os.path.join(SC, 'kpmg_mark.svg'), encoding='utf-8').read().strip()
    assert 'currentColor' in mark and '#00338D' not in mark, 'the mark still carries a hard fill'
    assert 'base64' not in mark and '<image' not in mark, 'the mark is not a pure vector'

    s = io.open(P, encoding='utf-8').read()
    start, end = mark_slot(s)
    s = s[:start] + MARK_START + mark + '</div>' + s[end:]

    if '.kpmg-intro-logo {' not in s:
        anchor = '    .kpmg-intro-overlay {'
        assert s.count(anchor) == 1, 'cannot find the intro stylesheet to extend'
        s = s.replace(anchor, CSS + anchor)

    shutil.copyfile(P, os.path.join(os.environ.get('TEMP', SC), 'siren_backup_kpmglogo.html'))
    tmp = P + '.tmp'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, P)
    print('KPMG mark embedded (%d chars of vector)' % len(mark))


if __name__ == '__main__':
    main()
