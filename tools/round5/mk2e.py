"""Persistence across a reload, read-only mode, and the block-inspector route.

Usage: python mk2e.py <target> <tag> <out.json>
"""
import json, sys
from mk2 import BOOT, VISHELP, PORT

target, tag, out = sys.argv[1], sys.argv[2], sys.argv[3]

setup = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP +
         "const card=document.getElementById('settingsSection');card.open=true;"
         "[...card.querySelectorAll('.style-fold')].forEach(f=>f.open=true);await s(400);"
         "const set=(id,v,ev)=>{const e=document.getElementById(id);if(!e)return 'no '+id;"
         "if(e.type==='checkbox'){e.checked=v;}else{e.value=v;}e.dispatchEvent(new Event(ev||'change',{bubbles:true}));return e.id;};"
         "set('curve','linear');await s(1200);"
         "const ff=document.getElementById('diagramFontFamily');"
         "ff.value=[...ff.options].map(o=>o.value).find(v=>/georgia/i.test(v))||ff.value;"
         "ff.dispatchEvent(new Event('change',{bubbles:true}));await s(1200);"
         "set('layoutNodeSpacing','90','change');await s(1200);"
         "set('legendEnabled',true);await s(1500);"
         "return JSON.stringify({curve:document.getElementById('curve').value,"
         "font:ff.value,spacing:document.getElementById('layoutNodeSpacing').value,"
         "legend:document.getElementById('legendEnabled').checked,"
         "engine:document.getElementById('layoutEngineSelect').value});})()")

after = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP +
         "document.body.click();await s(400);"
         "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
         "await s(500);const card=document.getElementById('settingsSection');card.open=true;await s(600);"
         "const folds=[...card.querySelectorAll('.style-fold')];"
         "const ff=document.getElementById('diagramFontFamily');"
         "return JSON.stringify({curve:document.getElementById('curve').value,font:ff.value,"
         "spacing:document.getElementById('layoutNodeSpacing').value,"
         "legend:document.getElementById('legendEnabled').checked,"
         "engine:document.getElementById('layoutEngineSelect').value,"
         "srcLen:document.getElementById('source').value.length,"
         "nodes:document.querySelectorAll('#diagram g.node').length,"
         "foldsOpen:folds.map(f=>f.open),"
         "editorError:!!document.querySelector('.editor-error:not([hidden]), #sourceError:not([hidden])')});})()")

readonly = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
            "const cb=document.getElementById('connectModeButton');const out={};"
            "document.body.classList.add('read-only-mode');await s(400);"
            "out.chipInReadOnlyAtRest=getComputedStyle(cb).display;"
            "document.body.classList.add('connect-mode');await s(300);"
            "out.chipInReadOnlyWhileConnectClass=getComputedStyle(cb).display;"
            "document.body.classList.remove('read-only-mode');await s(300);"
            "out.chipConnectClassOnly=getComputedStyle(cb).display;"
            "document.body.classList.remove('connect-mode');await s(200);"
            "out.chipBackAtRest=getComputedStyle(cb).display;return JSON.stringify(out);})()")

steps = [
    {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
    {"js": BOOT, "name": "boot_" + tag},
    {"js": setup, "name": "set_" + tag},
    {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 5500},
    {"js": after, "name": "reload_" + tag},
    {"shot": "p_%s_reload.png" % tag},
    {"js": readonly, "name": "readonly_" + tag},
]
open(out, 'w', encoding='utf-8').write(json.dumps(steps, indent=1))
print('wrote', out)
