"""Is 'Enter does not toggle a <summary>' pre-existing? Test the Style card's OWN
summary on whichever build is served. Usage: python mk2d.py <target> <tag> <out.json>
"""
import json, sys
from mk2 import BOOT, PORT

target, tag, out = sys.argv[1], sys.argv[2], sys.argv[3]

prep = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const card=document.getElementById('settingsSection');card.open=false;await s(300);"
        "const sm=card.querySelector(':scope > summary');sm.focus();"
        "return JSON.stringify({focused:document.activeElement===sm,openBefore:card.open});})()")
read = ("(function(){return JSON.stringify({cardOpen:document.getElementById('settingsSection').open});})()")

steps = [
    {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
    {"js": BOOT, "name": "boot_" + tag},
    {"js": prep, "name": "prep_" + tag},
    {"key": "Enter", "vk": 13},
    {"wait": 500},
    {"js": read, "name": "afterEnter_" + tag},
    {"key": " ", "vk": 32},
    {"wait": 500},
    {"js": read, "name": "afterSpace_" + tag},
]
open(out, 'w', encoding='utf-8').write(json.dumps(steps, indent=1))
print('wrote', out)
