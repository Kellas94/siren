"""Put the real wordmark in the header, and fix the lockup order.

Two corrections:

1. The product name was still set as type, so the E was an ordinary E rather than
   the three ruled terminals the mark is built on. It becomes the drawn wordmark.

2. The mark beside it was the standalone symbol - which IS the E figure - so the
   same three-line device appeared twice, side by side. The brand board's enterprise
   lockup puts the T-Industries monogram there instead, with the product wordmark
   carrying the device. That is the arrangement installed here.

The accessible name is unchanged: the h1 still reads "T-INDUSTRIES SIREN" to a
screen reader, with the drawn wordmark marked decorative.
"""
import io, os, re, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
BRAND = r'C:\Claude\SIREN\brand\svg'

s = io.open(APP, encoding='utf-8').read()
orig = s


def load(name, cls, label=None):
    svg = io.open(os.path.join(BRAND, name), encoding='utf-8').read().strip()
    svg = re.sub(r'\s(width|height)="[^"]*"', '', svg, count=2)
    attrs = ' class="%s"' % cls
    attrs += ' role="img" aria-label="%s"' % label if label else ' aria-hidden="true" focusable="false"'
    return svg.replace('<svg', '<svg' + attrs, 1)


# ---------------------------------------------------------------- the mark
# Swap the standalone symbol for the parent company's monogram.
i = s.index('<svg class="brand-mark"')
j = s.index('</svg>', i) + len('</svg>')
s = s[:i] + load('17_tindustries_T_monogram.currentcolor.svg', 'brand-mark') + s[j:]

# ---------------------------------------------------------------- the wordmark
wordmark = load('14_siren_product_wordmark_only.currentcolor.svg', 'brand-wordmark')
old = '<span class="brand-project">SIREN</span>'
assert s.count(old) == 1, 'project name span moved'
s = s.replace(old, '<span class="brand-project">%s<span class="sr-only">SIREN</span></span>' % wordmark)

# The wordmark is drawn art, so it is sized off the type's cap height rather than
# given a font size, and it must not inherit the uppercase/tracking rules.
anchor = """    .brand-copy h1 {
      display: flex;
      align-items: baseline;"""
assert s.count(anchor) == 1
s = s.replace(anchor, """    .brand-wordmark {
      display: block;
      /* The product name is the hero of the lockup and the house name is its label,
         so the drawn wordmark is set larger than the type beside it. The view box is
         5.03:1 after tightening, so the width follows the height. */
      height: 19px;
      width: calc(19px * 5.03);
      overflow: visible;
    }
    .brand-project { display: inline-flex; align-items: center; }
    /* The house name is a label next to it, not a competing title. */
    .brand-house { font-weight: 600; opacity: .78; }
    @media (max-width: 1180px) {
      .brand-wordmark { height: 15px; width: calc(15px * 5.03); }
    }
""" + anchor)

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_wordmark.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('wordmark installed: %d -> %d chars' % (len(orig), len(s)))
