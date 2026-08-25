import json, sys

NL = "String.fromCharCode(10)"
TARGET, OUTJSON, TAG, MOBILE = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == 'mobile'

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

HELP = ("const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const card=()=>document.getElementById('settingsSection');"
        "const folds=()=>[...card().querySelectorAll('.style-fold')];")

boot = ("(async()=>{" + HELP +
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(300);"
        "const src=document.getElementById('source');src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);"
        "card().open=true;folds().forEach(f=>f.open=true);await s(600);"
        "card().scrollIntoView({block:'start'});await s(400);"
        "return {seeded:src.value.length};})()")

fit = ("(async()=>{" + HELP +
       "const cardRect=card().getBoundingClientRect();"
       "const over=[...card().querySelectorAll('input,select,button,summary,.style-fold-who')]"
       ".filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>cardRect.right+1||r.left<cardRect.left-1);})"
       ".map(e=>(e.id||e.className||e.tagName)+' '+Math.round(e.getBoundingClientRect().width));"
       "const clipped=[...card().querySelectorAll('.style-fold > summary')]"
       ".filter(sm=>sm.scrollWidth>sm.clientWidth+2).map(sm=>sm.textContent.trim().slice(0,20));"
       "return {step:'fit',tag:'" + TAG + "',vw:innerWidth,"
       "docOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,"
       "cardWidth:Math.round(cardRect.width),wider:over,clippedSummaries:clipped,"
       "bodyHeight:Math.round(card().querySelector('.details-body').getBoundingClientRect().height)};})()")

steps = [{"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500}]
if MOBILE:
    steps += [{"js": boot, "name": "boot_" + TAG}]
else:
    steps += [{"js": boot, "name": "boot_" + TAG}]
steps += [{"js": fit, "name": "fit_" + TAG}, {"shot": "fit_" + TAG + ".png"}]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
