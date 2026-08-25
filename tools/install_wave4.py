import io, os

SC = r'C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad'
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

def read(name):
    return io.open(os.path.join(SC, name), encoding='utf-8').read()

def scene_bounds(key):
    """The entry plus the comment block directly above it. The last entry in the
    object closes without a comma, so the terminator has to allow both."""
    marker = chr(10) + '        %s: {' % key + chr(10) + '          settleFrames:'
    i = s.index(marker)
    head = s.rindex('/* ', 0, i)
    line_start = s.rindex(chr(10), 0, head) + 1
    pos = i + 1
    while True:
        eol = s.index(chr(10), pos)
        line = s[pos:eol]
        if line == '        },' or line == '        }':
            return line_start, eol + 1
        pos = eol + 1

# ------------------------------------------------ 1. the four reworked scenes
for key, fname in [('zen', 'scene_v4_zen.js'), ('grandhotel', 'scene_v4_grandhotel.js'),
                   ('artdeco', 'scene_v4_artdeco.js'), ('ie', 'scene_v4_ie.js')]:
    a, b = scene_bounds(key)
    body = read(fname).rstrip('\n') + '\n'
    assert ('\n        %s: {' % key) in body, key
    s = s[:a] + body + s[b:]
    print('scene installed:', key, len(body), 'chars')

# ------------------------------------------------ 2. space race takes the opera slot
a, b = scene_bounds('operahouse')
body = read('scene_v4_spacerace.js').rstrip('\n') + '\n'
assert '\n        spacerace: {' in body
s = s[:a] + body + s[b:]
print('scene installed: spacerace')

# ------------------------------------------------ 3. palette (CSS)
i = s.index('    [data-theme="operahouse"] {')
j = s.index('\n    [data-theme="ukiyoe"] {', i)
s = s[:i] + """    [data-theme="spacerace"] {
      color-scheme: dark;
      --canvas-bg: #0b1526;
      --app-bg: #050914;
      --panel-bg: #0b1526;
      --panel-alt: #081120;
      --panel-elevated: #12203a;
      --sidebar-start: #0a1424;
      --sidebar-end: #050b16;
      --input-bg: #081120;
      --text: #e8f0fb;
      --muted: #9db4d0;
      --subtle: #8aa2bd;
      --border: #1c2f4d;
      --border-strong: #2b4670;
      --field-border: #35527f;
      --primary: #ffb648;
      --primary-hover: #ffc978;
      --primary-text: #24170a;
      --secondary: #16294a;
      --secondary-hover: #1e3760;
      --secondary-text: #e8f0fb;
      --danger: #ff9182;
      --danger-strong: #ffab9c;
      --danger-bg: #3a1512;
      --success: #7fe0b0;
      --success-bg: #0e2c22;
      --warning: #ffd27a;
      --warning-bg: #33270f;
      --focus-ring: #6fe3ff;
      --code-text: #cfe4f7;
      --pill-text: #ffcf8a;
      --pill-bg: #2a1e0c;
      --code-bg: #060d19;
      --deco-gold: #ffb648;
      --shadow: 0 18px 50px rgba(0, 0, 0, .6);
      --shadow-soft: 0 8px 24px rgba(0, 0, 0, .45);
      --node-fill: #12203a;
      --node-text: #eaf3ff;
      --node-border: #2b4670;
      --node-accent: #2a1e0c;
      --node-accent-border: #ffb648;
      --line-color: #6fe3ff;
      --edge-label-bg: #0a1424;
    }
""" + s[j + 1:]

# ------------------------------------------------ 4. ambient wiring
rep('[data-theme="abyss"], [data-theme="operahouse"]) .card',
    '[data-theme="abyss"], [data-theme="spacerace"]) .card')
rep("""    [data-theme="operahouse"] { --ambient-opacity: .96; --ambient-card: rgba(58, 15, 26, .72); --ambient-bar: rgba(58, 15, 26, .86); --ambient-pane: rgba(58, 15, 26, .8); }""",
    """    [data-theme="spacerace"] { --ambient-opacity: .96; --ambient-card: rgba(11, 21, 38, .74); --ambient-bar: rgba(5, 9, 20, .86); --ambient-pane: rgba(11, 21, 38, .8); }""")
rep("""    .theme-menu-option[data-theme-value="operahouse"] > span:nth-child(2)::before,""",
    """    .theme-menu-option[data-theme-value="spacerace"] > span:nth-child(2)::before,""")

# ------------------------------------------------ 5. the pickers
rep('<option value="operahouse">Baroque Opera</option>', '<option value="spacerace">Space Race</option>', 2)
rep("""<button class="theme-menu-option" type="button" role="option" data-theme-value="operahouse" aria-selected="false"><span class="theme-option-swatch" style="--swatch-a:#25080f;--swatch-b:#e8c86a"></span><span>Baroque Opera</span><span class="theme-option-check">\u2713</span></button>""",
    """<button class="theme-menu-option" type="button" role="option" data-theme-value="spacerace" aria-selected="false"><span class="theme-option-swatch" style="--swatch-a:#050914;--swatch-b:#ffb648"></span><span>Space Race</span><span class="theme-option-check">\u2713</span></button>""")

# ------------------------------------------------ 6. diagram palettes (two objects)
rep("""        operahouse: {
          canvasBg: '#3a0f1a', text: '#f6e7d6', muted: '#d0ab9a',
          nodeFill: '#4a1624', nodeText: '#fbefe1', nodeBorder: '#7d3547',
          nodeAccent: '#4a2a12', nodeAccentBorder: '#e8c86a', line: '#c9a291', edgeLabel: '#340d17'
        },""",
    """        spacerace: {
          canvasBg: '#0b1526', text: '#e8f0fb', muted: '#9db4d0',
          nodeFill: '#12203a', nodeText: '#eaf3ff', nodeBorder: '#2b4670',
          nodeAccent: '#2a1e0c', nodeAccentBorder: '#ffb648', line: '#6fe3ff', edgeLabel: '#0a1424'
        },""")

# ------------------------------------------------ 7. intro registration
rep("""        operahouse: { mark: '\u2766', name: 'BAROQUE OPERA', bg: '#25080f', accent: '#e8c86a', glint: '#f6e7d6', title: '#d0ab9a' },""",
    """        spacerace: { mark: '\u25b2', name: 'SPACE RACE', bg: '#050914', accent: '#ffb648', glint: '#6fe3ff', title: '#9db4d0' },""")
rep('aurora: null, grandhotel: null, abyss: null, operahouse: null,',
    'aurora: null, grandhotel: null, abyss: null, spacerace: null,')
rep('artdeco: el.artdecoIntroOverlay, operahouse: el.operahouseIntroOverlay,',
    'artdeco: el.artdecoIntroOverlay, spacerace: el.spaceraceIntroOverlay,')
rep("'artdecoIntroOverlay','operahouseIntroOverlay',", "'artdecoIntroOverlay','spaceraceIntroOverlay',")

# ------------------------------------------------ 8. intro CSS + markup
i = s.index('/* ---- OPERA HOUSE intro:')
j = s.index('/* ---- ART DECO intro:', i)
s = s[:i] + read('intro_spacerace.css').rstrip('\n') + '\n' + s[j:]

i = s.index('  <div class="theme-intro-overlay operahouse-intro-overlay"')
j = s.index('  <div class="theme-intro-overlay artdeco-intro-overlay"', i)
s = s[:i] + read('intro_spacerace.html').rstrip('\n') + '\n' + s[j:]

leftovers = s.count('operahouse') + s.count('oh-intro') + s.count('Baroque Opera') + s.count('Opera House')
assert leftovers == 0, 'operahouse leftovers: %d' % leftovers

tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('ok %d -> %d' % (len(orig), len(s)))
