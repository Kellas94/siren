import json, sys

NL = "String.fromCharCode(10)"
TARGET, OUTJSON, TAG = sys.argv[1], sys.argv[2], sys.argv[3]

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

HELP = ("const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const card=()=>document.getElementById('settingsSection');"
        "const folds=()=>[...card().querySelectorAll('.style-fold')];"
        "const openAll=()=>{card().open=true;folds().forEach(f=>f.open=true);};"
        "const set=(id,v)=>{const e=document.getElementById(id);e.value=v;"
        "e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};"
        "const edges=()=>[...document.querySelectorAll('#diagram svg path')]"
        ".filter(p=>!p.closest('marker')&&(p.getAttribute('d')||'').length>30)"
        ".map(p=>p.getAttribute('d').replace(/[0-9.\\-]+/g,'#').slice(0,60));"
        "const nodeTexts=()=>[...document.querySelectorAll('#diagram g.node')].map(n=>n.textContent.trim()).slice(0,3);")

boot = ("(async()=>{" + HELP +
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(300);"
        "const src=document.getElementById('source');src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);openAll();await s(500);"
        "return {seeded:src.value.length,edgeShapes:edges().length};})()")

curve = ("(async()=>{" + HELP +
         "const before=edges();set('curve','linear');await s(3000);const after=edges();"
         "set('curve','stepBefore');await s(3000);const step=edges();"
         "return {step:'curve',curveValue:document.getElementById('curve').value,"
         "smooth:before[0],linear:after[0],stepBefore:step[0],"
         "smoothVsLinear:before[0]!==after[0],linearVsStep:after[0]!==step[0]};})()")

numbering = ("(async()=>{" + HELP +
             "const before=nodeTexts();set('numberingStyle','flat');await s(3000);const flat=nodeTexts();"
             "set('numberingStyle','outline');await s(3000);const outline=nodeTexts();"
             "return {step:'numbering',off:before,flat:flat,outline:outline,"
             "changed:JSON.stringify(before)!==JSON.stringify(flat)||JSON.stringify(before)!==JSON.stringify(outline),"
             "optionValues:[...document.getElementById('numberingStyle').options].map(o=>o.value)};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "boot_" + TAG},
    {"js": curve, "name": "curve_" + TAG},
    {"js": numbering, "name": "numbering_" + TAG},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
