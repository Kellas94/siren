import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import BOOT, OPEN, seed, SMALL

PORT = int(sys.argv[1])
OUT = sys.argv[2]

READONLY = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const t = document.querySelector('#source');
  document.body.classList.add('read-only-mode');
  await sleep(600);
  const cs = getComputedStyle(f);
  const r = f.getBoundingClientRect();
  const pane = document.querySelector('.editor-pane');
  const out = {floatAttrHidden: f.hidden, floatDisplay: cs.display, floatVisibility: cs.visibility,
               floatRect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
               floatOnTop: document.elementFromPoint(Math.round(r.x + r.width/2), Math.round(r.y + 8)) ?
                           (f.contains(document.elementFromPoint(Math.round(r.x + r.width/2), Math.round(r.y + 8)))) : null,
               textareaInFloat: f.contains(t), textareaReadOnly: t.readOnly, textareaDisabled: t.disabled,
               paneDisplay: pane ? getComputedStyle(pane).display : null,
               banner: (document.querySelector('.readonly-banner')||{}).textContent || null};
  // a typed character still lands in the source while the window is open
  const before = t.value;
  t.value = before + String.fromCharCode(10) + '    ZZ["typed while read-only"]';
  t.dispatchEvent(new Event('input', {bubbles:true}));
  await sleep(2200);
  out.sourceAcceptedEdit = document.querySelector('#source').value !== before;
  t.value = before; t.dispatchEvent(new Event('input', {bubbles:true}));
  await sleep(1500);
  return out;
})()"""

READONLY_OFF = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.body.classList.remove('read-only-mode');
  await sleep(600);
  return {off: !document.body.classList.contains('read-only-mode')};
})()"""


def perf(n):
    body = ['flowchart TD']
    for i in range(1, n):
        body.append('    N%d["Step %d"]' % (i, i))
    src = "[" + ",".join(json.dumps(l) for l in body) + "].join(String.fromCharCode(10))"
    return """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t = document.querySelector('#source');
  t.value = %s;
  t.dispatchEvent(new Event('input', {bubbles:true}));
  await sleep(4500);
  const times = [];
  for (let i = 0; i < 9; i++) {
    const base = t.value;
    t.value = base + ' ';
    const t0 = performance.now();
    t.dispatchEvent(new Event('input', {bubbles:true}));
    times.push(performance.now() - t0);
    await sleep(450);
    t.value = base;
    t.dispatchEvent(new Event('input', {bubbles:true}));
    await sleep(450);
  }
  times.sort((a,b)=>a-b);
  return {lines: t.value.split(String.fromCharCode(10)).length,
          median: Math.round(times[4]*10)/10,
          min: Math.round(times[0]*10)/10, max: Math.round(times[8]*10)/10};
})()""" % src


S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 11000})
S.append({"js": BOOT, "name": "Q01_boot"})
S.append({"js": seed(SMALL), "name": "Q02_seed"})
S.append({"js": OPEN, "name": "Q03_open_float"})
S.append({"js": READONLY, "name": "Q04_readonly_with_float_open"})
S.append({"shot": "q04_readonly_%d.png" % PORT})
S.append({"js": READONLY_OFF, "name": "Q04b_readonly_off"})
S.append({"js": perf(100), "name": "Q05_perf_100"})
S.append({"js": perf(400), "name": "Q06_perf_400"})
S.append({"js": perf(100), "name": "Q07_perf_100_again"})

json.dump(S, open(OUT, 'w'), indent=1)
print(len(S))
