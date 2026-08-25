"""Keyboard pass with REAL key events (synthetic KeyboardEvents do not toggle <details>).

Focus the 4th fold summary, press Space with Input.dispatchKeyEvent, read the fold.
Then the same on Enter. Run against app and base to tell new behaviour from old.
Usage: python mk2c.py <target> <tag> <out.json>
"""
import json, sys
from mk2 import BOOT, PORT

target, tag, out = sys.argv[1], sys.argv[2], sys.argv[3]

SEL = ".style-fold" if target == 'app' else "#settingsSection details"

prep = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const card=document.getElementById('settingsSection');card.open=true;await s(600);"
        "const f=document.querySelectorAll('" + SEL + "');"
        "if(!f.length)return 'no folds in this build (base): '+f.length;"
        "const fold=f[3];fold.open=false;await s(200);const sm=fold.querySelector('summary');sm.focus();"
        "return JSON.stringify({target:'" + tag + "',foldCount:f.length,focused:document.activeElement===sm,openBefore:fold.open});})()")

read1 = ("(function(){const f=document.querySelectorAll('" + SEL + "');"
         "return f.length?JSON.stringify({openAfterEnter:f[3].open}):'n/a';})()")
read2 = ("(function(){const f=document.querySelectorAll('" + SEL + "');"
         "return f.length?JSON.stringify({openAfterSpace:f[3].open}):'n/a';})()")

tab = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
       "const card=document.getElementById('settingsSection');"
       "const items=[...card.querySelectorAll('summary,input,select,textarea,button')].filter(e=>{"
       "let d=e.closest('details');let ok=true;while(d){if(!d.open&&d!==e.parentElement)ok=false;d=d.parentElement?d.parentElement.closest('details'):null;}"
       "return ok&&e.getBoundingClientRect().width>0;});"
       "return JSON.stringify({tabOrder:items.slice(0,10).map(e=>e.id||e.tagName.toLowerCase()+':'+(e.textContent||'').trim().slice(0,18))});})()")

steps = [
    {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
    {"js": BOOT, "name": "boot_" + tag},
    {"js": prep, "name": "prep_" + tag},
    {"key": "Enter", "vk": 13},
    {"wait": 500},
    {"js": read1, "name": "enter_" + tag},
    {"key": " ", "vk": 32},
    {"wait": 500},
    {"js": read2, "name": "space_" + tag},
    {"js": tab, "name": "taborder_" + tag},
]
open(out, 'w', encoding='utf-8').write(json.dumps(steps, indent=1))
print('wrote', out)
