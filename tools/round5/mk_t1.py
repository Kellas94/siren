import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import PORT, BOOT, seed

MEASURE = """(async (mode) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const t = document.querySelector('#source');
  if (mode) t.style.overflowWrap = mode;
  await sleep(400);
  const cs = getComputedStyle(t);
  const g = document.querySelector('.line-numbers');
  const nums = Array.from(g.querySelectorAll('.line-number'));
  // a mirror laid out exactly like the textarea tells us how many visual rows line 2 takes
  const mirror = document.createElement('div');
  mirror.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;';
  mirror.style.width = (t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) + 'px';
  mirror.style.font = cs.font; mirror.style.lineHeight = cs.lineHeight;
  mirror.style.whiteSpace = cs.whiteSpace; mirror.style.overflowWrap = cs.overflowWrap;
  const line2 = t.value.split(String.fromCharCode(10))[1];
  const d = document.createElement('div'); d.textContent = line2; mirror.appendChild(d);
  document.body.appendChild(mirror);
  const h = d.getBoundingClientRect().height;
  // first visual row blank? measure where the first non-space glyph starts
  const probe = document.createElement('span'); probe.textContent = line2.trim().slice(0, 1);
  d.textContent = line2.slice(0, 4); d.appendChild(probe);
  const rowsForIndent = Math.round(d.getBoundingClientRect().height / parseFloat(cs.lineHeight));
  const out = {mode: mode || '(unchanged)', overflowWrap: cs.overflowWrap, whiteSpace: cs.whiteSpace,
               line2VisualRows: Math.round(h / parseFloat(cs.lineHeight)),
               gutterLine2Height: nums[1] ? Math.round(nums[1].getBoundingClientRect().height) : null,
               indentPlusOneCharRows: rowsForIndent};
  mirror.remove();
  return out;
})(%s)"""

LEAD_SRC = ['flowchart TD',
            '    A["' + ('Q' * 190) + '"]',
            '    A --> B["Short label"]']

S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 11000})
S.append({"js": BOOT, "name": "T01_boot"})
S.append({"js": seed(LEAD_SRC, 4200), "name": "T02_seed"})
S.append({"js": MEASURE % 'null', "name": "T03_as_shipped_anywhere"})
S.append({"js": MEASURE % json.dumps('break-word'), "name": "T04_break_word"})
S.append({"js": MEASURE % json.dumps('normal'), "name": "T05_normal"})
S.append({"js": MEASURE % json.dumps('anywhere'), "name": "T06_back_to_anywhere"})

json.dump(S, open(r'C:\Claude\SIREN\pending\r5fix-popout\steps_t1.json', 'w'), indent=1)
print(len(S))
