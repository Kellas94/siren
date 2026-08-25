import json, sys

NL = "String.fromCharCode(10)"
TARGET = sys.argv[1]
OUTJSON = sys.argv[2]
TAG = sys.argv[3]

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

HELP = ("const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const card=()=>document.getElementById('settingsSection');"
        "const folds=()=>[...card().querySelectorAll('.style-fold')];"
        "const openAbove=e=>{let d=e.parentElement?e.parentElement.closest('details'):null;"
        "while(d){if(!d.open)return false;d=d.parentElement?d.parentElement.closest('details'):null;}return true;};"
        "const set=(id,v)=>{const e=document.getElementById(id);e.value=v;"
        "e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};"
        "const toast=()=>{const t=document.querySelector('.toast, #toast, [class*=toast]');return t?t.textContent.trim().slice(0,80):'-';};")

boot = ("(async()=>{" + HELP +
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(300);"
        "const src=document.getElementById('source');src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);"
        "card().open=true;folds().forEach(f=>f.open=true);await s(400);"
        "return {seeded:src.value.length};})()")

mkclass = ("(async()=>{" + HELP +
           "set('styleClassName','Control point');await s(300);"
           "document.getElementById('createStyleClassButton').click();await s(800);"
           "set('nodeStyleTarget','B');await s(400);"
           "document.getElementById('assignStyleClassButton').click();await s(1200);"
           "return {step:'makeClass',classOptions:[...document.getElementById('styleClassSelect').options].map(o=>o.textContent.trim()),"
           "source:document.getElementById('source').value.indexOf('classDef')>=0,toast:toast()};})()")

route = ("(async()=>{" + HELP +
         "folds().forEach(f=>f.open=false);await s(400);"
         "const before={anyFoldOpen:folds().some(f=>f.open)};"
         "document.getElementById('legendFromClassesButton').click();await s(1800);"
         "const li=document.getElementById('legendItems');"
         "const labels=[...li.querySelectorAll('input[type=text]')].map(i=>i.value).filter(Boolean);"
         "return {step:'legendFromClasses',before:before,toast:toast(),"
         "legendFoldOpen:openAbove(li),legendItemsVisible:li.checkVisibility({checkVisibilityCSS:true}),"
         "legendEnabled:document.getElementById('legendEnabled').checked,labels:labels,"
         "foldOpen:folds().map(f=>f.open)};})()")

render = ("(async()=>{" + HELP + "await s(1500);"
          "const svg=document.querySelector('#diagram svg');"
          "return {step:'legendInRender',svgHasLegendText:svg?svg.textContent.indexOf('Control point')>=0:false};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "boot_" + TAG},
    {"js": mkclass, "name": "mkclass_" + TAG},
    {"js": route, "name": "legendroute_" + TAG},
    {"shot": "legend_" + TAG + ".png"},
    {"js": render, "name": "legendrender_" + TAG},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
