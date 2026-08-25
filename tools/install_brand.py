"""Install the SIREN brand mark into the application.

Replaces the fixed base64 roundel with the owner's own mark as inline SVG. The app
carries 36 themes from paper-white to pure black, so the mark takes currentColor and
follows the theme rather than sitting on a forced white plate. The favicon becomes
the same geometry.
"""
import io, os, re, sys, shutil, urllib.parse

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
BRAND = r'C:\Claude\SIREN\assets\brand_fixed'

s = io.open(APP, encoding='utf-8').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:80])
    s = s.replace(anchor, new)


# ---------------------------------------------------------------- the header mark
symbol = io.open(os.path.join(BRAND, '02_siren_standalone_symbol.currentcolor.svg'),
                 encoding='utf-8').read().strip()
# Strip the file's own sizing; the header CSS owns it.
symbol = re.sub(r'\s(width|height)="[^"]*"', '', symbol, count=2)
symbol = symbol.replace('<svg', '<svg class="brand-mark" role="img" aria-label="SIREN"', 1)

i = s.index('<img class="brand-mark"')
j = s.index('/>', i) + 2
s = s[:i] + symbol + s[j:]

# The mark is now line art, not a photo on a plate: drop the white tile, the cover
# fit and the gold ring, and let it take the theme's own ink.
rep("""    .brand-mark {
      display: block;
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      border-radius: 11px;
      object-fit: cover;
      background: rgba(255,255,255,0.96);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(217, 180, 92, 0.28);
    }""",
    """    .brand-mark {
      display: block;
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      /* Line art, so it follows the theme's ink instead of sitting on a plate.
         --deco-gold is the house accent every theme already defines. */
      color: var(--deco-gold, var(--text));
      overflow: visible;
    }""")

rep('      .brand-mark { width: 34px; height: 34px; flex-basis: 34px; }',
    '      .brand-mark { width: 30px; height: 30px; flex-basis: 30px; }')

# ---------------------------------------------------------------- the favicon
fav = io.open(os.path.join(BRAND, '05_siren_app_icon_light.svg'), encoding='utf-8').read().strip()
fav = re.sub(r'\s(width|height)="[^"]*"', '', fav, count=2)
data_uri = 'data:image/svg+xml,' + urllib.parse.quote(fav, safe="/:='%,()<>?+;#[]@!$&*~ ")
old_icon = re.search(r'<link rel="icon" href="[^"]*" />', s)
assert old_icon, 'favicon link not found'
s = s.replace(old_icon.group(0), '<link rel="icon" href="%s" />' % data_uri)

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_brand.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('brand installed: %d -> %d chars (mark %d chars inline, favicon %d)'
      % (len(orig), len(s), len(symbol), len(data_uri)))
