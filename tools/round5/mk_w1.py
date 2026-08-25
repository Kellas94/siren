import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import BOOT, seed

PORT = int(sys.argv[1])
OUT = sys.argv[2]

LONG = ['flowchart TD']
LONG.append('    A["' + ' '.join(['cuvant%d' % i for i in range(1, 40)]) + '"]')
LONG.append('    A --> B["Short"]')

WRAPSTATE = """(async (want) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const cb = document.querySelector('#dockedWrapToggle');
  if (cb && want !== null && cb.checked !== want) { cb.click(); await sleep(700); }
  const t = document.querySelector('#source');
  const cs = getComputedStyle(t);
  return {checkboxPresent: !!cb, checked: cb ? cb.checked : null,
          isWrappedClass: !!document.querySelector('.code-editor.is-wrapped'),
          whiteSpace: cs.whiteSpace, overflowWrap: cs.overflowWrap,
          scrollWidth: t.scrollWidth, clientWidth: t.clientWidth,
          overflowsSideways: t.scrollWidth > t.clientWidth + 1,
          storedKeys: Object.keys(localStorage).filter(k => /wrap/i.test(k)),
          storedWrapInState: (() => { try {
              return Object.keys(localStorage).map(k => {
                const v = localStorage.getItem(k) || '';
                return /"wrap"|wrapCode|softWrap/.test(v) ? k : null; }).filter(Boolean);
            } catch (e) { return 'err'; } })()};
})(%s)"""

S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 11000})
S.append({"js": BOOT, "name": "W01_boot"})
S.append({"js": seed(LONG, 4200), "name": "W02_seed_long_line"})
S.append({"js": WRAPSTATE % 'null', "name": "W03_default"})
S.append({"js": WRAPSTATE % 'true', "name": "W04_wrap_on"})
S.append({"shot": "w04_wrap_on_%d.png" % PORT})
S.append({"js": WRAPSTATE % 'false', "name": "W05_wrap_off"})
S.append({"shot": "w05_wrap_off_%d.png" % PORT})

json.dump(S, open(OUT, 'w'), indent=1)
print(len(S))
