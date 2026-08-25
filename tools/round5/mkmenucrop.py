import os
from PIL import Image

F = os.path.dirname(os.path.abspath(__file__))
BOX = (30, 190, 270, 630)  # the structure menu rect (42,203 211x410) with a margin


def side(a, b, out, scale=2):
    ia = Image.open(a).convert('RGB').crop(BOX)
    ib = Image.open(b).convert('RGB').crop(BOX)
    ia = ia.resize((ia.width * scale, ia.height * scale), Image.LANCZOS)
    ib = ib.resize((ib.width * scale, ib.height * scale), Image.LANCZOS)
    c = Image.new('RGB', (ia.width + ib.width + 10, ia.height), (128, 128, 128))
    c.paste(ia, (0, 0)); c.paste(ib, (ia.width + 10, 0))
    c.save(out)
    print('wrote', out, c.size)


for v in ('day-blue', 'night-green'):
    side(os.path.join(F, 'out_mid', 'mid_menu_' + v + '.png'),
         os.path.join(F, 'out_after', 'after_menu_' + v + '.png'),
         os.path.join(F, 'cmp_menu_side_' + v + '.png'))
