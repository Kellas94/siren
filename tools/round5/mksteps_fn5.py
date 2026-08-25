import json, sys

NL = "String.fromCharCode(10)"
TARGET, OUTJSON, TAG = sys.argv[1], sys.argv[2], sys.argv[3]

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

HELP = ("const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const card=()=>document.getElementById('settingsSection');"
        "const folds=()=>[...card().querySelectorAll('.style-fold')];"
        "const set=(id,v)=>{const e=document.getElementById(id);e.value=v;"
        "e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};")

boot = ("(async()=>{" + HELP +
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(300);"
        "const src=document.getElementById('source');src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);"
        "card().open=true;folds().forEach(f=>f.open=true);await s(400);"
        "set('curve','linear');await s(1200);set('diagramFontFamily','Georgia, serif');await s(1200);"
        "set('layoutNodeSpacing','90');await s(1200);"
        "const le=document.getElementById('legendEnabled');if(!le.checked){le.click();}await s(2500);"
        "return {step:'setup',curve:document.getElementById('curve').value,"
        "font:document.getElementById('diagramFontFamily').value,"
        "spacing:document.getElementById('layoutNodeSpacing').value,legend:le.checked,"
        "engine:document.getElementById('layoutEngineSelect').value};})()")

after = ("(async()=>{" + HELP +
         "await s(1500);"
         "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
         "document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(500);"
         "card().open=true;await s(400);"
         "return {step:'afterReload',curve:document.getElementById('curve').value,"
         "font:document.getElementById('diagramFontFamily').value,"
         "spacing:document.getElementById('layoutNodeSpacing').value,"
         "legend:document.getElementById('legendEnabled').checked,"
         "engine:document.getElementById('layoutEngineSelect').value,"
         "foldOpen:folds().map(f=>f.open),"
         "sourceNodes:document.querySelectorAll('#diagram g.node').length,"
         "editorError:!!document.querySelector('.editor-error:not([hidden])')};})()")

readonly = ("(async()=>{" + HELP +
            "const cb=document.getElementById('connectModeButton');"
            "const before=getComputedStyle(cb).display;"
            "document.body.classList.add('read-only-mode');await s(400);"
            "const ro=getComputedStyle(cb).display;"
            "document.body.classList.remove('read-only-mode');await s(300);"
            "return {step:'readOnly',vw:innerWidth,normal:before,inReadOnly:ro};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "setup_" + TAG},
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 6000},
    {"js": after, "name": "afterreload_" + TAG},
    {"click": "#mobilePreviewTab"},
    {"wait": 1000},
    {"js": readonly, "name": "readonly_" + TAG},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
