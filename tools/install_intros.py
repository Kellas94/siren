import io, os, sys
LF = chr(10)
BASE = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad'
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()

keys = sys.argv[1].split(',')
installed = []
for key in keys:
    html_path = os.path.join(BASE, 'intro_%s.html' % key)
    css_path = os.path.join(BASE, 'intro_%s.css' % key)
    if not (os.path.exists(html_path) and os.path.exists(css_path)):
        print('skip (incomplete):', key)
        continue
    if ('id="%sIntroOverlay"' % key) in s:
        print('skip (already present):', key)
        continue
    markup = io.open(html_path, encoding='utf-8').read().strip()
    css = io.open(css_path, encoding='utf-8').read().strip()
    anchor = '  <a class="skip-link" href="#editorPane">'
    assert s.count(anchor) == 1
    s = s.replace(anchor, '  ' + markup.replace(LF, LF + '  ') + LF + anchor)
    css_anchor = '    @keyframes theme-intro-fade'
    assert s.count(css_anchor) == 1
    s = s.replace(css_anchor, css + LF + css_anchor)
    cache_anchor = "'genericIntroOverlay',"
    assert s.count(cache_anchor) == 1
    s = s.replace(cache_anchor, "'genericIntroOverlay','%sIntroOverlay'," % key)
    res_anchor = "        const own = { "
    assert s.count(res_anchor) == 1, ('resolver anchor', s.count(res_anchor))
    s = s.replace(res_anchor, "        const own = { %s: el.%sIntroOverlay, " % (key, key))
    installed.append(key)

io.open(P + '.tmp', 'w', encoding='utf-8').write(s)
os.replace(P + '.tmp', P)
print('installed:', installed)
