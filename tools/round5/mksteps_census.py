import json, sys

NL = "String.fromCharCode(10)"
TARGET, OUTJSON, TAG, MOBILE = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == 'mobile'

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

HELP = ("const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const openAbove=e=>{let d=e.parentElement?e.parentElement.closest('details'):null;"
        "while(d){if(!d.open)return false;d=d.parentElement?d.parentElement.closest('details'):null;}return true;};"
        "const shown=root=>[...root.querySelectorAll('input,select,textarea,button')]"
        ".filter(e=>e.checkVisibility&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&openAbove(e));")

boot = ("(async()=>{" + HELP +
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(300);"
        "const src=document.getElementById('source');src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);return {seeded:src.value.length};})()")

census = ("(async()=>{" + HELP +
          "const cb=document.getElementById('connectModeButton');const r=cb.getBoundingClientRect();"
          "return {step:'census',tag:'" + TAG + "',vw:innerWidth,"
          "mobileLayout:matchMedia('(max-width: 900px)').matches,"
          "visibleControls:shown(document.body).length,"
          "previewToolbarButtons:[...document.querySelectorAll('.preview-toolbar button')]"
          ".filter(b=>b.checkVisibility({checkVisibilityCSS:true})).length,"
          "connectDisplay:getComputedStyle(cb).display,connectSize:Math.round(r.width)+'x'+Math.round(r.height)};})()")

steps = [{"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
         {"js": boot, "name": "boot_" + TAG}]
if MOBILE:
    steps += [{"click": "#mobilePreviewTab"}, {"wait": 1200}]
steps += [{"js": census, "name": "census_" + TAG}, {"shot": "census_" + TAG + ".png"}]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
