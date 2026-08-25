"""Set the product name in the theme intros as the drawn wordmark.

Every intro that announces "SIREN // <theme>" typed the product name as ordinary
letters, so the E was an ordinary E rather than the three ruled terminals the mark
is built on. The name becomes the drawn wordmark.

The wordmark is defined once as an SVG <symbol> and referenced with <use>, so the
thirteen places it appears cost one copy of the geometry rather than thirteen. It
inherits currentColor, so each intro's own title colour still drives it - including
the anime intro, whose three offset copies are what produce its chromatic split.
"""
import io, os, re, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
BRAND = r'C:\Claude\SIREN\brand\svg'

s = io.open(APP, encoding='utf-8').read()
orig = s

# ---------------------------------------------------------------- the symbol
art = io.open(os.path.join(BRAND, '14_siren_product_wordmark_only.currentcolor.svg'),
              encoding='utf-8').read().strip()
view_box = re.search(r'viewBox="([^"]+)"', art).group(1)
inner = art[art.index('>') + 1:art.rindex('</svg>')]
sprite = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">'
          '<symbol id="sirenWordmark" viewBox="%s">%s</symbol></svg>' % (view_box, inner))

anchor = '  <a class="skip-link" href="#editorPane">Skip to flowchart editor</a>'
assert s.count(anchor) == 1, 'skip link anchor moved'
s = s.replace(anchor, sprite + '\n' + anchor)

# ---------------------------------------------------------------- the styles
ratio = None
vb = [float(v) for v in view_box.split()]
ratio = vb[2] / vb[3]
css_anchor = '    .theme-intro-title {'
assert s.count(css_anchor) == 1, 'intro title rule moved'
s = s.replace(css_anchor, """    .intro-siren-word {
      display: inline-block;
      /* Sized off the title's own font-size so every intro keeps its own scale, and
         set on the cap height rather than the em box so it sits on the same line as
         the theme name beside it. */
      height: .74em;
      width: calc(.74em * %.3f);
      vertical-align: -.06em;
      overflow: visible;
    }
""" % ratio + css_anchor)

# ---------------------------------------------------------------- the markup
WORD = ('<svg class="intro-siren-word" aria-hidden="true" focusable="false">'
        '<use href="#sirenWordmark"/></svg><span class="sr-only">SIREN</span>')
count = s.count('SIREN // ')
assert count >= 6, 'expected the SIREN // titles, found %d' % count
s = s.replace('SIREN // ', WORD + ' // ')

# ---------------------------------------------------------------- the generic overlay
old_js = ("        el.genericIntroOverlay.querySelector('.theme-intro-title').textContent = "
          + repr('SIREN // ') .replace("'", "'") + " + style.name;")
old_js = ("        el.genericIntroOverlay.querySelector('.theme-intro-title').textContent = '"
          + WORD + " // ' + style.name;")
# the blanket replace above already rewrote the JS string, so repair it into markup
assert s.count(old_js) == 1, 'generic overlay title line not in the expected shape'
s = s.replace(old_js,
              "        // The product name is drawn art, so it is set as markup; the theme name\n"
              "        // stays escaped text.\n"
              "        el.genericIntroOverlay.querySelector('.theme-intro-title').innerHTML =\n"
              "          '" + WORD + " // ' + escapeHtml(style.name);")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_introword.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('intro wordmark installed: %d -> %d chars, %d titles' % (len(orig), len(s), count))
