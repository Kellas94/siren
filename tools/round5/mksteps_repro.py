import json, sys

NL = "String.fromCharCode(10)"
TARGET = sys.argv[1]          # 'app' or 'base'
OUTJSON = sys.argv[2]
TAG = sys.argv[3]

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

boot = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);"
        "document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});"
        "await s(300);"
        "const src=document.getElementById('source');"
        "src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));"
        "await s(3800);"
        "return 'seeded len='+src.value.length;})()")

measure = ("(function(){const tb=document.querySelector('.preview-toolbar');"
           "const vis=e=>{if(!e)return 'missing';const r=e.getBoundingClientRect();"
           "const cs=getComputedStyle(e);return cs.display==='none'?'display:none':"
           "(r.width>0&&r.height>0? Math.round(r.width)+'x'+Math.round(r.height):'zero-rect');};"
           "const btns=tb?[...tb.querySelectorAll('button')].filter(b=>{const c=getComputedStyle(b);"
           "return c.display!=='none'&&c.visibility!=='hidden'&&b.getBoundingClientRect().width>0;}):[];"
           "const cb=document.getElementById('connectModeButton');"
           "return {tag:'" + TAG + "',vw:innerWidth,vh:innerHeight,"
           "toolbarVis:vis(tb),toolbarBtnCount:btns.length,"
           "toolbarLabels:btns.map(b=>(b.getAttribute('aria-label')||b.textContent||'').trim().slice(0,26)),"
           "connectVis:vis(cb),connectDisplay:cb?getComputedStyle(cb).display:'missing',"
           "connectLabel:cb?(cb.textContent||'').trim():'-',"
           "connectAria:cb?cb.getAttribute('aria-label'):'-',"
           "connectTitle:cb?cb.getAttribute('title'):'-',"
           "connectPressed:cb?cb.getAttribute('aria-pressed'):'-'};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "boot_" + TAG},
    {"click": "#mobilePreviewTab"},
    {"wait": 1200},
    {"js": measure, "name": "toolbar_" + TAG},
    {"shot": "mobile_" + TAG + ".png"},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
