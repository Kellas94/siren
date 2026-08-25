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

# ---- 1. add the three scenes to AMBIENT_SCENES, before the closing brace of the object
marker = "\n      /* ---------------- engine ---------------- */"
i = s.index(marker)
close = s.rindex("\n      };\n", 0, i) + 1
bodies = []
for key, fname in [('cupertino', 'scene_v5_cupertino.js'), ('blueprint', 'scene_v5_blueprint.js'), ('oled', 'scene_v5_oled.js')]:
    body = read(fname).rstrip('\n')
    assert ('\n        %s: {' % key) in body or body.lstrip().startswith('%s: {' % key) or ('        %s: {' % key) in body, key
    if not body.endswith(','):
        body += ','
    bodies.append(body + '\n')
    print('scene ready:', key, len(body), 'chars')
s = s[:close] + ''.join(bodies) + s[close:]

# ---- 2. ambient veils, tuned to the same rule as the rest
rep("""    [data-theme="ie"]        { --ambient-opacity: .92;""",
    """    [data-theme="cupertino"] { --ambient-opacity: .95; --ambient-card: rgba(252, 253, 255, .62); --ambient-bar: rgba(252, 253, 255, .86); --ambient-pane: rgba(252, 253, 255, .82); --ambient-blur: 0px; }
    [data-theme="blueprint"] { --ambient-opacity: .90; --ambient-card: rgba(9, 44, 78, .78); --ambient-bar: rgba(8, 38, 68, .92); --ambient-pane: rgba(8, 38, 68, .88); --ambient-blur: 10px; }
    [data-theme="oled"]      { --ambient-opacity: .92; --ambient-card: rgba(0, 0, 0, .74); --ambient-bar: rgba(0, 0, 0, .90); --ambient-pane: rgba(0, 0, 0, .88); --ambient-blur: 16px; }
    [data-theme="ie"]        { --ambient-opacity: .92;""")

# ---- 3. the animated marker in the picker
rep("""    .theme-menu-option[data-theme-value="matrix"] > span:nth-child(2)::before,""",
    """    .theme-menu-option[data-theme-value="cupertino"] > span:nth-child(2)::before,
    .theme-menu-option[data-theme-value="blueprint"] > span:nth-child(2)::before,
    .theme-menu-option[data-theme-value="oled"] > span:nth-child(2)::before,
    .theme-menu-option[data-theme-value="matrix"] > span:nth-child(2)::before,""")

# ---- 4. their own arrival cards
rep("""        matrix: { mark: '01', name: 'MATRIX',""",
    """        cupertino: { mark: '◍', name: 'CUPERTINO GLASS', bg: '#f5f7fa', accent: '#7aa7d9', glint: '#ffffff', title: '#7c8598' },
        blueprint: { mark: '⊹', name: 'BLUEPRINT', bg: '#0a2f52', accent: '#dbe9f6', glint: '#9dc7ea', title: '#9dc7ea' },
        oled: { mark: '◎', name: 'OLED BLACK', bg: '#000000', accent: '#4aa8ff', glint: '#b06cff', title: '#5c6672' },
        matrix: { mark: '01', name: 'MATRIX',""")

rep("""        aurora: null, grandhotel: null, abyss: null, spacerace: null,""",
    """        aurora: null, grandhotel: null, abyss: null, spacerace: null, cupertino: null, blueprint: null, oled: null,""")

# ---- 5. the card veil applies to the light one too
rep("""[data-theme="abyss"], [data-theme="spacerace"]) .card""",
    """[data-theme="abyss"], [data-theme="spacerace"], [data-theme="cupertino"], [data-theme="blueprint"]) .card""")

tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('ok %d -> %d' % (len(orig), len(s)))
