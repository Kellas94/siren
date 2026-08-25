import json, sys

NL = "String.fromCharCode(10)"
TARGET, OUTJSON, TAG = sys.argv[1], sys.argv[2], sys.argv[3]

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
        "const t=document.getElementById('themePreset');t.value='light';"
        "t.dispatchEvent(new Event('change',{bubbles:true}));await s(1200);"
        "document.getElementById('styleShortcutButton').click();await s(900);"
        "const sm=card().querySelector('.style-fold summary');"
        "const cs=getComputedStyle(card().querySelector('.style-fold-who'));"
        "return {theme:document.documentElement.getAttribute('data-theme')||document.body.className.slice(0,40),"
        "foldOpen:folds().map(f=>f.open),whoColour:cs.color,summaryFont:getComputedStyle(sm).fontSize};})()")

connectshot = ("(async()=>{" + HELP +
               "const n=[...document.querySelectorAll('#diagram g.node')].find(x=>x.textContent.indexOf('Open the ledger')>=0);"
               "const r=n.getBoundingClientRect();"
               "n.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));"
               "await s(500);"
               "const row=[...document.querySelectorAll('.struct-menu-item')].find(i=>/Connect from here/i.test(i.textContent));"
               "row.click();await s(800);"
               "const c=document.getElementById('connectModeButton');"
               "return {step:'lightConnect',display:getComputedStyle(c).display,label:c.textContent.trim()};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "boot_" + TAG},
    {"shot": "light_" + TAG + "_style.png"},
    {"js": connectshot, "name": "lightconnect_" + TAG},
    {"shot": "light_" + TAG + "_connect.png"},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
