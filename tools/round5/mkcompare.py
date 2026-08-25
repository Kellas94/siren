import os
from PIL import Image

F = os.path.dirname(os.path.abspath(__file__))


def stack(pairs, out, scale=3):
    ims = []
    for label, p in pairs:
        im = Image.open(p).convert('RGB')
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        ims.append(im)
    w = max(i.width for i in ims)
    h = sum(i.height for i in ims) + 8 * (len(ims) - 1)
    canvas = Image.new('RGB', (w, h), (128, 128, 128))
    y = 0
    for i in ims:
        canvas.paste(i, (0, y))
        y += i.height + 8
    canvas.save(out)
    print('wrote', out, canvas.size)


for v in ('day-blue', 'day-green', 'night-blue', 'night-green'):
    stack([('mid', os.path.join(F, 'out_mid', 'menurow_mid_' + v + '.png')),
           ('after', os.path.join(F, 'out_after', 'menurow_after_' + v + '.png'))],
          os.path.join(F, 'cmp_menurow_' + v + '.png'))


def cropbox(src, box, out, scale=1):
    im = Image.open(src).convert('RGB').crop(box)
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(out)
    print('wrote', out, im.size)


# the whole structure menu, mid vs after, so the "you are here" row can be judged in place
for v in ('day-blue', 'night-green'):
    stack([('mid', os.path.join(F, 'out_mid', 'mid_menu_' + v + '.png')),
           ('after', os.path.join(F, 'out_after', 'after_menu_' + v + '.png'))],
          os.path.join(F, 'cmp_menufull_' + v + '.png'), scale=1)
