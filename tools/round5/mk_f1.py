import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import PORT, BOOT, STATE, TB, OPEN, GUIDED, TEXT, seed, setw, SMALL

THEME = """(async (name) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sel = document.querySelector('#themePreset');
  sel.value = name; sel.dispatchEvent(new Event('change', {bubbles:true}));
  await sleep(900);
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
  await sleep(300);
  return {theme: name, dataTheme: document.documentElement.getAttribute('data-theme')};
})(%s)"""

CTRLF = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'f', ctrlKey:true, bubbles:true, cancelable:true}));
  await sleep(800);
  const p = document.querySelector('#findReplacePanel');
  return {panelHidden: p.hidden, panelInFloat: f.contains(p),
          guidedPressed: document.querySelector('#structureModeButton').getAttribute('aria-pressed'),
          isGuided: f.classList.contains('is-guided'),
          codeHidden: document.querySelector('#codeEditor').hidden,
          structHidden: document.querySelector('#structureEditor').hidden,
          sourceVisible: !!document.querySelector('#source').offsetParent,
          active: document.activeElement ? (document.activeElement.id||document.activeElement.className) : null,
          popoutOpen: !f.hidden};
})()"""

CLOSEFIND = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const b = document.querySelector('#closeFindReplaceButton'); if (b) b.click();
  await sleep(500);
  return {panelHidden: document.querySelector('#findReplacePanel').hidden};
})()"""

DOCKEDFIND = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#findReplaceButton').click();
  await sleep(600);
  const p = document.querySelector('#findReplacePanel');
  return {panelHidden: p.hidden, guidedPressed: document.querySelector('#structureModeButton').getAttribute('aria-pressed'),
          sourceVisible: !!document.querySelector('#source').offsetParent};
})()"""

RO = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  document.body.classList.add('read-only-mode');
  await sleep(500);
  const r = f.getBoundingClientRect();
  const pane = document.querySelector('.editor-pane');
  const out = {floatHidden: f.hidden, floatVisible: !!f.offsetParent, floatW: Math.round(r.width),
               paneVisible: !!(pane && pane.offsetParent),
               chips: document.querySelectorAll('#structureRows .struct-token').length};
  document.body.classList.remove('read-only-mode');
  await sleep(300);
  return out;
})()"""

S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 10000})
S.append({"js": BOOT, "name": "F01_boot"})
S.append({"js": seed(SMALL), "name": "F02_seed"})
S.append({"js": OPEN, "name": "F03_open"})
S.append({"js": TB, "name": "F04_first_open_tb"})
S.append({"js": GUIDED, "name": "F05_guided"})
S.append({"js": TB, "name": "F06_guided_tb_760"})
# THE DEFECT: recentre shrinks the float to 624 in Guided
S.append({"js": OPEN, "name": "F07_recentre"})
S.append({"js": TB, "name": "F08_after_recentre_guided"})
S.append({"shot": "f08_recentre_guided_1200.png"})
S.append({"js": TEXT, "name": "F09_text"})
S.append({"js": TB, "name": "F10_after_recentre_text"})
S.append({"shot": "f10_recentre_text_1200.png"})
S.append({"js": GUIDED, "name": "F11_guided_again"})
for w in (700, 670, 665, 663, 660, 640, 624, 600, 570, 563, 561, 560, 520, 470, 430, 414):
    S.append({"js": setw(w), "name": "F12_guided_w%d" % w})
S.append({"shot": "f12_guided_w414.png"})
S.append({"js": setw(624), "name": "F13_guided_w624"})
S.append({"shot": "f13_guided_w624_dark.png"})
S.append({"js": THEME % json.dumps("light"), "name": "F14_light"})
S.append({"js": TB, "name": "F15_light_tb"})
S.append({"shot": "f15_guided_w624_light.png"})
S.append({"js": THEME % json.dumps("dark"), "name": "F16_dark"})
S.append({"js": setw(760), "name": "F17_back_760"})
# Ctrl+F while Guided must show the typed source, not search a hidden textarea
S.append({"js": CTRLF, "name": "F18_ctrlF_in_guided"})
S.append({"shot": "f18_ctrlf_guided.png"})
S.append({"js": CLOSEFIND, "name": "F19_close_find"})
S.append({"js": GUIDED, "name": "F20_guided_again"})
S.append({"js": DOCKEDFIND, "name": "F21_popout_find_button_route"})
S.append({"js": CLOSEFIND, "name": "F22_close_find"})
S.append({"js": GUIDED, "name": "F23_guided_again"})
S.append({"js": RO, "name": "F24_readonly_dom_sim"})
S.append({"js": STATE, "name": "F25_state"})

json.dump(S, open(r'C:\Claude\SIREN\pending\r5fix-popout\steps_f1.json', 'w'), indent=1)
print(len(S))
