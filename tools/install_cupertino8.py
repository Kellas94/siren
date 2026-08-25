import io, os, shutil

SC = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad'
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'

shutil.copyfile(P, os.path.join(os.environ.get('TEMP', SC), 'siren_backup_cup8.html'))

s = io.open(P, encoding='utf-8').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)


def scene_bounds(key):
    """The scene entry plus the comment block that introduces it. The last entry in
    AMBIENT_SCENES closes without a comma, so both terminators are allowed."""
    marker = '\n        %s: {\n          settleFrames:' % key
    i = s.index(marker)
    head = s.rindex('/* ', 0, i)
    start = s.rindex('\n', 0, head) + 1
    pos = i + 1
    while True:
        eol = s.index('\n', pos)
        if s[pos:eol] in ('        },', '        }'):
            return start, eol + 1
        pos = eol + 1


# ============================================================ 1. the scene, now with a night half
a, b = scene_bounds('cupertino')
body = io.open(os.path.join(SC, 'scene_v8_cupertino.js'), encoding='utf-8').read().rstrip('\n')
assert '\n        cupertino: {' in body, 'scene body missing its key'
if not body.rstrip().endswith(','):
    body += ','
s = s[:a] + body + '\n' + s[b:]

# ============================================================ 2. the intro's own stylesheet
css = io.open(os.path.join(SC, 'intro_cupertino.css'), encoding='utf-8').read().rstrip('\n')
rep("/* ---- AURORA BOREALIS intro: curtains of light rise past a kindling star ---- */",
    css + "\n/* ---- AURORA BOREALIS intro: curtains of light rise past a kindling star ---- */")

# ============================================================ 3. the markup, beside the other theme intros
html = io.open(os.path.join(SC, 'intro_cupertino.html'), encoding='utf-8').read().rstrip('\n')
rep('''  <div class="theme-intro-overlay zen-intro-overlay" id="zenIntroOverlay" hidden aria-live="polite" aria-label="zen theme loading">''',
    html + '\n' + '''  <div class="theme-intro-overlay zen-intro-overlay" id="zenIntroOverlay" hidden aria-live="polite" aria-label="zen theme loading">''')

# ============================================================ 4. the theme claims its own overlay
rep("        const own = { ie: el.ieIntroOverlay,",
    "        const own = { cupertino: el.cupertinoIntroOverlay, ie: el.ieIntroOverlay,")

# the generic dressing for this key is unreachable from here on
rep("        cupertino: { mark: '\u25cd', name: 'CUPERTINO GLASS', bg: '#f5f7fa', accent: '#7aa7d9', glint: '#ffffff', title: '#7c8598' },\n", "")

tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('ok %d -> %d bytes' % (len(orig), len(s)))
