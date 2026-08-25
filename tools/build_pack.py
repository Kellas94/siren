"""Build the SIREN brand package from the corrected SVGs.

Rasterises every asset through a real browser (the SVGs use strokes and round caps,
so a browser is the honest renderer), assembles a multi-size favicon.ico, and writes
the guide, the CSS and the manifest.

    python build_pack.py <svg-dir> <out-dir> <driver.mjs> <serve-root>
"""
import base64, io, json, os, re, struct, subprocess, sys

SVG_DIR, OUT, DRIVER, ROOT = sys.argv[1:5]
SQUARE = [16, 32, 48, 64, 128, 256, 512, 1024]
WIDE = [480, 960, 1920]
ICO_SIZES = [16, 32, 48, 64, 256]

os.makedirs(os.path.join(OUT, 'png'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'svg'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'ico'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'css'), exist_ok=True)

names = sorted(n for n in os.listdir(SVG_DIR) if n.endswith('.svg'))
for n in names:
    io.open(os.path.join(OUT, 'svg', n), 'w', encoding='utf-8', newline='\n').write(
        io.open(os.path.join(SVG_DIR, n), encoding='utf-8').read())


def is_square(name, svg):
    m = re.search(r'viewBox="([\d.\- ]+)"', svg)
    if not m:
        return True
    _, _, w, h = [float(v) for v in m.group(1).split()]
    return abs(w - h) / max(w, h) < 0.12


# ---------------------------------------------------------------- rasterise
jobs = []
for n in names:
    if '.currentcolor.' in n:
        continue                      # a themed twin has no fixed colour to bake
    svg = io.open(os.path.join(SVG_DIR, n), encoding='utf-8').read()
    for px in (SQUARE if is_square(n, svg) else WIDE):
        jobs.append({'name': n, 'px': px, 'square': is_square(n, svg)})

page = ['<!doctype html><meta charset="utf-8"><body>']
page.append('<script>window.__JOBS=%s;</script>' % json.dumps(jobs))
page.append('''<script>
window.__render = async () => {
  const out = [];
  for (const j of window.__JOBS) {
    const res = await fetch('svg/' + j.name);
    const text = await res.text();
    const blob = new Blob([text], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const ratio = img.naturalHeight / img.naturalWidth;
    const w = j.px, h = j.square ? j.px : Math.round(j.px * ratio);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, w, h);
    out.push({name: j.name, px: j.px, w, h, data: c.toDataURL('image/png').split(',')[1]});
    URL.revokeObjectURL(url);
  }
  return out;
};
</script></body>''')
io.open(os.path.join(OUT, '_raster.html'), 'w', encoding='utf-8').write('\n'.join(page))

steps = [{'nav': 'http://localhost:8955/%s/_raster.html' % os.path.basename(OUT.rstrip('\\/')),
          'wait': 2500},
         {'js': 'window.__render().then(r => JSON.stringify(r))', 'name': 'png'}]
step_file = os.path.join(OUT, '_steps.json')
io.open(step_file, 'w', encoding='utf-8').write(json.dumps(steps))
env = dict(os.environ, OUT_DIR=os.path.join(OUT, '_shots'),
           PROFILE=os.path.join(OUT, '_prof'))
proc = subprocess.run(['node', DRIVER, step_file], capture_output=True, text=True,
                      env=env, cwd=ROOT)
raw = proc.stdout
m = re.search(r'"(\[.*\])"', raw, re.S) or re.search(r'(\[\{.*\}\])', raw, re.S)
if not m:
    print(raw[-2000:]); raise SystemExit('rasteriser produced nothing')
payload = m.group(1)
try:
    shots = json.loads(payload)
except Exception:
    shots = json.loads(json.loads('"%s"' % payload))

written = []
for sh in shots:
    stem = sh['name'].replace('.svg', '')
    fn = '%s_%dpx.png' % (stem, sh['px'])
    with open(os.path.join(OUT, 'png', fn), 'wb') as f:
        f.write(base64.b64decode(sh['data']))
    written.append((fn, sh['w'], sh['h']))
print('rasterised %d PNGs' % len(written))

# ---------------------------------------------------------------- favicon.ico
icons = []
for px in ICO_SIZES:
    p = os.path.join(OUT, 'png', '05_siren_app_icon_light_%dpx.png' % px)
    if os.path.exists(p):
        icons.append((px, open(p, 'rb').read()))
if icons:
    header = struct.pack('<HHH', 0, 1, len(icons))
    offset = 6 + 16 * len(icons)
    entries, blobs = b'', b''
    for px, data in icons:
        entries += struct.pack('<BBBBHHII', px if px < 256 else 0, px if px < 256 else 0,
                               0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    with open(os.path.join(OUT, 'ico', 'favicon.ico'), 'wb') as f:
        f.write(header + entries + blobs)
    print('favicon.ico with %d sizes' % len(icons))

# ---------------------------------------------------------------- manifest
manifest = {
    'name': 'SIREN brand package',
    'product': 'SIREN', 'parent': 'T-Industries',
    'ink': '#071B33',
    'svg': sorted(os.listdir(os.path.join(OUT, 'svg'))),
    'png': sorted(os.listdir(os.path.join(OUT, 'png'))),
    'ico': sorted(os.listdir(os.path.join(OUT, 'ico'))),
    'notes': [
        'Every .currentcolor.svg takes its colour from the surrounding CSS colour '
        'property, for use inside themed interfaces.',
        'PNGs are rendered from the same SVGs through a browser, so strokes and round '
        'caps match what ships.',
    ],
}
io.open(os.path.join(OUT, 'asset_manifest.json'), 'w', encoding='utf-8').write(
    json.dumps(manifest, indent=1))
os.remove(os.path.join(OUT, '_raster.html'))
os.remove(step_file)
print('package written to', OUT)
