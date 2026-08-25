import json, sys

NL = "String.fromCharCode(10)"
TARGET = sys.argv[1]
OUTJSON = sys.argv[2]
TAG = sys.argv[3]

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

HELP = ("const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const node=t=>[...document.querySelectorAll('#diagram g.node')].find(n=>n.textContent.indexOf(t)>=0);"
        "const tap=async e=>{const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;"
        "const o={bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,pointerId:1,isPrimary:true};"
        "e.dispatchEvent(new PointerEvent('pointerdown',o));window.dispatchEvent(new PointerEvent('pointerup',o));"
        "e.dispatchEvent(new MouseEvent('click',o));await s(600);};"
        "const chip=()=>document.getElementById('connectModeButton');"
        "const chipState=()=>{const c=chip();const cs=getComputedStyle(c);const r=c.getBoundingClientRect();"
        "return {display:cs.display,size:Math.round(r.width)+'x'+Math.round(r.height),"
        "label:(c.textContent||'').trim(),aria:c.getAttribute('aria-label'),pressed:c.getAttribute('aria-pressed'),"
        "bodyMode:document.body.classList.contains('connect-mode')};};")

boot = ("(async()=>{" + HELP +
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(300);"
        "const src=document.getElementById('source');src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);"
        "return {seeded:src.value.length};})()")

run = ("(async()=>{" + HELP +
       "const before=document.getElementById('source').value;"
       "const rest=chipState();"
       "chip().click();await s(600);const on=chipState();"
       "await tap(node('Open the ledger'));await s(500);"
       "await tap(node('Sign the file'));await s(1400);"
       "const after=document.getElementById('source').value;"
       "return {step:'mobileToolbarStart',rest:rest,afterTappingChip:on,"
       "addedEdge:after.indexOf('A --> E')>=0||after.indexOf('A-->E')>=0,"
       "tail:after.split(String.fromCharCode(10)).slice(-1)[0],grew:after.length-before.length};})()")

off = ("(async()=>{" + HELP + "chip().click();await s(500);"
       "return {step:'mobileChipExit',after:chipState()};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "boot_" + TAG},
    {"click": "#mobilePreviewTab"},
    {"wait": 1200},
    {"js": run, "name": "mobileconnect_" + TAG},
    {"shot": "fn2_" + TAG + "_after.png"},
    {"js": off, "name": "mobileexit_" + TAG},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
