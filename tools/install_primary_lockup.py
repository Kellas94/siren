"""The header becomes the brand board's PRIMARY LOCKUP.

The product name drawn large, "BY T-INDUSTRIES" small beneath it, and nothing else.
The house name stops being type set beside the wordmark, and the feature tagline
goes: the header names the product, the interface explains itself.

Uses asset 03 as drawn rather than recomposing it from parts, so the spacing between
the wordmark, its rules and the byline is the one in the drawings.
"""
import io, os, re, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
BRAND = r'C:\Claude\SIREN\brand\svg'

s = io.open(APP, encoding='utf-8').read()
orig = s

art = io.open(os.path.join(BRAND, '03_siren_primary_lockup.currentcolor.svg'),
              encoding='utf-8').read().strip()
art = re.sub(r'\s(width|height)="[^"]*"', '', art, count=2)
art = art.replace('<svg', '<svg class="brand-lockup-art" aria-hidden="true" focusable="false"', 1)

# ---------------------------------------------------------------- markup
start = s.index('<div class="brand-copy">')
end = s.index('</div>', s.index('<p>Mermaid diagrams', start)) + len('</div>')
new = ('<div class="brand-copy">\n'
       '          <h1>%s<span class="sr-only">SIREN by T-Industries</span></h1>\n'
       '          <span class="brand-version" id="brandVersion"></span>\n'
       '        </div>' % art)
s = s[:start] + new + s[end:]

# ---------------------------------------------------------------- styles
old_h1 = re.search(r'    \.brand-copy h1 \{[^}]*\}\n', s)
assert old_h1, 'brand-copy h1 rule not found'
s = s.replace(old_h1.group(0), """    .brand-copy h1 {
      display: block;
      margin: 0;
      min-width: 0;
      color: var(--text);
      line-height: 0;
    }
    .brand-lockup-art {
      display: block;
      /* The drawn lockup already carries the wordmark, its rules and the byline at
         the proportions in the brand board, so it is placed as one piece and only
         sized here. View box is 3.528:1. */
      height: 40px;
      width: calc(40px * 3.528);
      overflow: visible;
    }
    @media (max-width: 1180px) {
      .brand-lockup-art { height: 32px; width: calc(32px * 3.528); }
    }
""")

# The wordmark rules from the previous arrangement are dead now.
s = re.sub(r'    \.brand-wordmark \{[^}]*\}\n', '', s, count=1)
s = re.sub(r'    \.brand-project \{ display: inline-flex; align-items: center; \}\n', '', s, count=1)
s = re.sub(r'    /\* The house name is a label next to it, not a competing title\. \*/\n'
           r'    \.brand-house \{ font-weight: 600; opacity: \.78; \}\n', '', s, count=1)
s = re.sub(r'    @media \(max-width: 1180px\) \{\n      \.brand-wordmark \{[^}]*\}\n    \}\n', '', s, count=1)

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_primary.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('primary lockup installed: %d -> %d chars' % (len(orig), len(s)))
print('tagline refs left:', s.count('Mermaid diagrams, workpapers'))
