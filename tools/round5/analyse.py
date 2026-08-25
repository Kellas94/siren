import io, json, os, re, sys

# Pulls every "== name ==" JSON block out of a driver log, computes WCAG contrast from
# the real colours, and diffs the popover screenshot against the same shot taken with
# the diagram hidden (any pixel that moves is the diagram showing through).

FOLD = os.path.dirname(os.path.abspath(__file__))


def blocks(path):
    t = io.open(path, encoding='utf-8', errors='replace').read()
    out = {}
    parts = t.split('== ')
    for p in parts[1:]:
        nl = p.find(chr(10))
        name = p[:nl].strip()
        if name.endswith(' =='):
            name = name[:-3].strip()
        body = p[nl + 1:]
        # body runs until the next line that is not part of the JSON
        lines = body.split(chr(10))
        buf = []
        for ln in lines:
            if ln.startswith('SHOT ') or ln.startswith('CLICK ') or ln.startswith('KEY ') or ln.startswith('HOVER '):
                break
            buf.append(ln)
        raw = chr(10).join(buf).strip()
        try:
            out[name] = json.loads(raw)
        except Exception:
            out[name] = raw
    return out


def parse_color(c):
    """-> (r,g,b,a) floats 0-255 / 0-1. Handles rgb(), rgba(), #hex, color(srgb ...)."""
    if not c:
        return None
    c = c.strip()
    m = re.match(r'^#([0-9a-fA-F]{6})$', c)
    if m:
        v = m.group(1)
        return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16), 1.0)
    m = re.match(r'^rgba?\(([^)]+)\)$', c)
    if m:
        parts = [x.strip() for x in m.group(1).replace('/', ',').split(',')]
        r, g, b = float(parts[0]), float(parts[1]), float(parts[2])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return (r, g, b, a)
    m = re.match(r'^color\(srgb ([^)]+)\)$', c)
    if m:
        parts = m.group(1).replace('/', ' ').split()
        r, g, b = float(parts[0]) * 255, float(parts[1]) * 255, float(parts[2]) * 255
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return (r, g, b, a)
    return None


def over(fg, bg):
    """composite fg (with alpha) over opaque bg -> opaque rgb"""
    r, g, b, a = fg
    br, bg_, bb = bg[0], bg[1], bg[2]
    return (r * a + br * (1 - a), g * a + bg_ * (1 - a), b * a + bb * (1 - a))


def lum(rgb):
    def f(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    if la < lb:
        la, lb = lb, la
    return round((la + 0.05) / (lb + 0.05), 2)


def modal_bg(png, rect, inset=3):
    """The most common colour inside a rect: the surface, not the text."""
    from PIL import Image
    im = Image.open(png).convert('RGB')
    x, y, w, h = rect['x'] + inset, rect['y'] + inset, rect['w'] - 2 * inset, rect['h'] - 2 * inset
    if w <= 0 or h <= 0:
        return None, 0, 0
    crop = im.crop((x, y, x + w, y + h))
    cols = crop.getcolors(w * h) or []
    cols.sort(reverse=True)
    total = sum(c for c, _ in cols)
    return cols[0][1], len(cols), round(cols[0][0] / float(total), 3)


def seethrough(png_a, png_b, rect, inset=0):
    from PIL import Image
    a = Image.open(png_a).convert('RGB')
    b = Image.open(png_b).convert('RGB')
    x, y, w, h = rect['x'] + inset, rect['y'] + inset, rect['w'] - 2 * inset, rect['h'] - 2 * inset
    ca = a.crop((x, y, x + w, y + h)).tobytes()
    cb = b.crop((x, y, x + w, y + h)).tobytes()
    diff = sum(1 for i in range(0, len(ca), 3) if ca[i:i + 3] != cb[i:i + 3])
    return diff, w * h


def crop(png, rect, out, pad=6):
    from PIL import Image
    im = Image.open(png)
    x = max(0, rect['x'] - pad); y = max(0, rect['y'] - pad)
    im.crop((x, y, min(im.width, rect['x'] + rect['w'] + pad), min(im.height, rect['y'] + rect['h'] + pad))).save(out)
    return out


VARIANTS = ['day-blue', 'day-green', 'night-blue', 'night-green']


def run(tag, outdir, log):
    B = blocks(log)
    res = {}
    for v in VARIANTS:
        r = {}
        m = B.get('measure ' + v)
        if isinstance(m, dict):
            popbg = parse_color(m['popover']['bg'])
            page = (238, 240, 244) if v.startswith('day') else (15, 18, 24)
            surf = over(popbg, page) if popbg[3] < 1 else popbg[:3]
            r['popover'] = {'bg': m['popover']['bg'], 'alpha': round(popbg[3], 4), 'backdrop': m['popover']['backdrop'], 'border': m['popover']['borderColor'], 'borderAlpha': round(parse_color(m['popover']['borderColor'])[3], 4)}
            # rendered contrast: text colour vs the modal colour of the element's own region
            png = os.path.join(outdir, tag + '_pop_' + v + '.png')
            if os.path.exists(png):
                for key, label in (('chipSelected', 'chip selected'), ('chipPlain', 'chip plain'), ('input', 'name field'), ('hintText', 'hint line')):
                    e = m.get(key)
                    if not e:
                        continue
                    bgpx, ncol, share = modal_bg(png, e['rect'])
                    fg = parse_color(e['color'])
                    r[label] = {'color': e['color'], 'renderedBg': bgpx, 'ratio': ratio(over(fg, bgpx) if fg[3] < 1 else fg[:3], bgpx)}
                sbg, ncol, share = modal_bg(png, m['popover']['rect'], inset=4)
                r['popoverSurface'] = {'distinctColours': ncol, 'modalShare': share, 'modalColour': sbg}
                hidden = os.path.join(outdir, tag + '_pophidden_' + v + '.png')
                if os.path.exists(hidden):
                    d0, t0 = seethrough(png, hidden, m['popover']['rect'], 0)
                    d4, t4 = seethrough(png, hidden, m['popover']['rect'], 4)
                    r['seeThrough'] = {'diffPixels': d0, 'ofTotal': t0, 'diffAt4pxInset': d4}
        ip = B.get('inplace ' + v)
        if isinstance(ip, dict):
            a = parse_color(ip['bg'])
            r['inplace'] = {'bg': ip['bg'], 'alpha': round(a[3], 4), 'backdrop': ip['backdrop'], 'border': ip['borderColor']}
            png = os.path.join(outdir, tag + '_inplace_' + v + '.png')
            if os.path.exists(png):
                bgpx, ncol, share = modal_bg(png, ip['rect'])
                fg = parse_color(ip['color'])
                r['inplace']['textRatio'] = ratio(fg[:3], bgpx)
                r['inplace']['renderedBg'] = bgpx
        mn = B.get('menu ' + v)
        if isinstance(mn, dict):
            mb = parse_color(mn['menu']['bg'])
            r['structMenu'] = {'bg': mn['menu']['bg'], 'alpha': round(mb[3], 4), 'backdrop': mn['menu']['backdrop'], 'border': mn['menu']['borderColor']}
            png = os.path.join(outdir, tag + '_menu_' + v + '.png')
            for key, label in (('selected', 'menu current row'), ('plain', 'menu plain row')):
                e = mn.get(key)
                if not e:
                    continue
                fg = parse_color(e['color'])
                ent = {'color': e['color'], 'weight': e['weight'], 'rowBg': e['bg'], 'focused': mn.get('selectedFocused') if key == 'selected' else None}
                if os.path.exists(png):
                    bgpx, ncol, share = modal_bg(png, e['rect'], inset=2)
                    ent['renderedBg'] = bgpx
                    ent['ratio'] = ratio(over(fg, bgpx) if fg[3] < 1 else fg[:3], bgpx)
                r[label] = ent
            if os.path.exists(png) and mn.get('selected'):
                crop(png, mn['selected']['rect'], os.path.join(outdir, 'menurow_' + tag + '_' + v + '.png'), pad=10)
        bm = B.get('blockmenu ' + v)
        if isinstance(bm, dict):
            bb = parse_color(bm['bg'])
            r['blockMenu'] = {'bg': bm['bg'], 'alpha': round(bb[3], 4), 'backdrop': bm['backdrop'], 'rows': bm['rows'], 'hasSelected': bm['hasSelected']}
        res[v] = r
    return res


if __name__ == '__main__':
    out = {}
    for tag in ('before', 'mid', 'after'):
        log = os.path.join(FOLD, 'out_' + tag + '_log.txt')
        outdir = os.path.join(FOLD, 'out_' + tag)
        if os.path.exists(log):
            out[tag] = run(tag, outdir, log)
    io.open(os.path.join(FOLD, 'measurements.json'), 'w', encoding='utf-8', newline='').write(json.dumps(out, indent=1))
    print(json.dumps(out, indent=1))
