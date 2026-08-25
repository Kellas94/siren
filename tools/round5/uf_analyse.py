import io, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyse import blocks, parse_color, over, ratio, modal_bg

F = os.path.dirname(os.path.abspath(__file__))
for tag, log in (('ufmid', 'uf_mid.txt'), ('ufafter', 'uf_after.txt')):
    B = blocks(os.path.join(F, log))
    for v in ('day-blue', 'day-green', 'night-blue', 'night-green'):
        e = B.get('unfocused ' + v)
        if not isinstance(e, dict):
            print(tag, v, e); continue
        png = os.path.join(F, 'out_uf', tag + '_unfocused_' + v + '.png')
        bgpx, ncol, share = modal_bg(png, e['rect'], inset=2)
        fg = parse_color(e['color'])
        print(tag, v, 'color', e['color'], 'rowBg', e['bg'], 'weight', e['weight'], 'stillFocused', e['stillFocused'], 'renderedBg', bgpx, 'ratio', ratio(over(fg, bgpx) if fg[3] < 1 else fg[:3], bgpx))
