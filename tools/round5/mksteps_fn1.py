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
        "return {seeded:src.value.length,nodes:document.querySelectorAll('#diagram g.node').length};})()")

rest = ("(async()=>{" + HELP + "return {step:'rest',chip:chipState(),"
        "toolbarButtons:[...document.querySelectorAll('.preview-toolbar button')].filter(b=>getComputedStyle(b).display!=='none').length};})()")

menu = ("(async()=>{" + HELP +
        "const n=node('Open the ledger');const r=n.getBoundingClientRect();"
        "n.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,"
        "clientX:r.left+r.width/2,clientY:r.top+r.height/2}));await s(500);"
        "const rows=[...document.querySelectorAll('.struct-menu-item')].map(i=>i.textContent.trim());"
        "return {step:'blockMenu',rows:rows};})()")

connect = ("(async()=>{" + HELP +
           "const rows=[...document.querySelectorAll('.struct-menu-item')];"
           "const row=rows.find(i=>/Connect from here/i.test(i.textContent));"
           "if(!row)return {step:'connectRow',found:false};row.click();await s(700);"
           "const st=document.getElementById('statusText')||document.querySelector('.status-text');"
           "return {step:'connectFromHere',chip:chipState(),status:st?st.textContent.trim().slice(0,90):'-'};})()")

target = ("(async()=>{" + HELP +
          "const before=document.getElementById('source').value;"
          "await tap(node('Sign the file'));await s(1200);"
          "const after=document.getElementById('source').value;"
          "return {step:'clickFarTarget',addedEdge:after.indexOf('A --> E')>=0||after.indexOf('A-->E')>=0,"
          "grew:after.length-before.length,tail:after.split(String.fromCharCode(10)).slice(-2).join(' | '),"
          "chip:chipState()};})()")

reenter = ("(async()=>{" + HELP +
           "const n=node('Check balances');const r=n.getBoundingClientRect();"
           "n.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,"
           "clientX:r.left+r.width/2,clientY:r.top+r.height/2}));await s(500);"
           "const row=[...document.querySelectorAll('.struct-menu-item')].find(i=>/Connect from here/i.test(i.textContent));"
           "row.click();await s(700);const on=chipState();"
           "chip().click();await s(500);const off=chipState();"
           "return {step:'chipIsTheExit',on:on,afterClickingChip:off};})()")

esc = ("(async()=>{" + HELP +
       "const n=node('Sample items');const r=n.getBoundingClientRect();"
       "n.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,"
       "clientX:r.left+r.width/2,clientY:r.top+r.height/2}));await s(500);"
       "const row=[...document.querySelectorAll('.struct-menu-item')].find(i=>/Connect from here/i.test(i.textContent));"
       "row.click();await s(700);const on=chipState();"
       "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await s(500);"
       "return {step:'escape',on:on,afterEsc:chipState()};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "boot_" + TAG},
    {"js": rest, "name": "rest_" + TAG},
    {"js": menu, "name": "blockmenu_" + TAG},
    {"js": connect, "name": "connectfromhere_" + TAG},
    {"shot": "fn1_" + TAG + "_connecting.png"},
    {"js": target, "name": "target_" + TAG},
    {"js": reenter, "name": "chipexit_" + TAG},
    {"js": esc, "name": "escape_" + TAG},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
