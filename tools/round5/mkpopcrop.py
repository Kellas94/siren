import os, json, io
from PIL import Image

F = os.path.dirname(os.path.abspath(__file__))
M = json.load(io.open(os.path.join(F, 'measurements.json'), encoding='utf-8'))


def side(a, b, box, out, scale=2):
    ia = Image.open(a).convert('RGB').crop(box)
    ib = Image.open(b).convert('RGB').crop(box)
    ia = ia.resize((ia.width * scale, ia.height * scale), Image.LANCZOS)
    ib = ib.resize((ib.width * scale, ib.height * scale), Image.LANCZOS)
    c = Image.new('RGB', (ia.width + ib.width + 10, ia.height), (128, 128, 128))
    c.paste(ia, (0, 0)); c.paste(ib, (ia.width + 10, 0))
    c.save(out)
    print('wrote', out, c.size)


# popover rect is the same in both runs; take it from the after measurement pass
BOX = (800, 418, 1128, 572)
for v in ('day-blue', 'night-green'):
    side(os.path.join(F, 'out_before', 'before_pop_' + v + '.png'),
         os.path.join(F, 'out_after', 'after_pop_' + v + '.png'),
         BOX, os.path.join(F, 'cmp_pop_' + v + '.png'))
