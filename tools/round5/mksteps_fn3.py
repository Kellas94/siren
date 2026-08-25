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
        "e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));};"
        "const edgeD=()=>{const p=document.querySelector('#diagram path.flowchart-link, #diagram .edgePath path, #diagram path');"
        "return p?(p.getAttribute('d')||'').slice(0,40):'-';};"
        "const labelSize=()=>{const t=document.querySelector('#diagram g.node text, #diagram g.node span, #diagram g.node foreignObject div');"
        "return t?getComputedStyle(t).fontSize:'-';};")

boot = ("(async()=>{" + HELP +
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(300);"
        "const src=document.getElementById('source');src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);"
        "card().open=true;folds().forEach(f=>f.open=true);await s(500);"
        "return {seeded:src.value.length,edgeBefore:edgeD(),labelBefore:labelSize()};})()")

title = ("(async()=>{" + HELP +
         "set('diagramTitle','Month-end close');await s(2500);"
         "const h=document.querySelector('.preview-card h2, .preview-card h3, #previewTitle, .preview-card-title');"
         "return {step:'title',heading:h?h.textContent.trim():'-'};})()")

numbering = ("(async()=>{" + HELP +
             "const before=document.querySelector('#diagram g.node').textContent.trim();"
             "set('numberingStyle','flat');await s(2600);"
             "const after=document.querySelector('#diagram g.node').textContent.trim();"
             "set('numberingStyle','off');await s(2200);"
             "return {step:'numbering',before:before,afterFlat:after,changed:before!==after};})()")

fonts = ("(async()=>{" + HELP +
         "const before=labelSize();set('diagramFontSize','22');await s(2600);"
         "return {step:'fonts',before:before,after:labelSize()};})()")

curve = ("(async()=>{" + HELP +
         "const before=edgeD();set('curve','linear');await s(2600);"
         "const after=edgeD();"
         "return {step:'curve',before:before,after:after,changed:before!==after,"
         "engine:document.getElementById('layoutEngineSelect').value};})()")

layout = ("(async()=>{" + HELP +
          "set('layoutDensity','spacious');await s(400);"
          "document.getElementById('applyLayoutButton').click();await s(2600);"
          "const applied=document.getElementById('layoutNodeSpacing').value;"
          "document.getElementById('resetLayoutButton').click();await s(2600);"
          "return {step:'layout',afterApply:applied,afterReset:document.getElementById('layoutNodeSpacing').value};})()")

palette = ("(async()=>{" + HELP +
           "const src=document.getElementById('source');"
           "src.value='pie title Coverage'+String.fromCharCode(10)+'  \"Tested\" : 60'+String.fromCharCode(10)+'  \"Not tested\" : 40';"
           "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);"
           "card().open=true;folds().forEach(f=>f.open=true);await s(400);"
           "set('diagramPaletteColour0','#ff0055');await s(300);"
           "document.getElementById('applyDiagramPaletteButton').click();await s(2800);"
           "const svg=document.querySelector('#diagram svg');"
           "return {step:'palette',hexInSvg:svg?svg.outerHTML.toLowerCase().indexOf('#ff0055')>=0:false};})()")

kbd = ("(async()=>{" + HELP +
       "const sums=folds().map(f=>f.querySelector('summary'));"
       "const focusable=sums.map(sm=>{sm.focus();return document.activeElement===sm;});"
       "folds().forEach(f=>f.open=false);await s(300);"
       "sums[3].focus();"
       "return {step:'kbdFocus',focusable:focusable,activeIsFourthSummary:document.activeElement===sums[3],"
       "fourthOpenBefore:folds()[3].open,"
       "names:sums.map(sm=>{const id=sm.getAttribute('aria-labelledby');const n=id?document.getElementById(id):null;"
       "return (id||'none')+':'+(n?n.textContent.trim():'-');})};})()")

after_space = ("(async()=>{" + HELP +
               "return {step:'afterSpace',fourthOpen:folds()[3].open,"
               "active:document.activeElement?document.activeElement.tagName+'/'+(document.activeElement.textContent||'').trim().slice(0,14):'-'};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "boot_" + TAG},
    {"js": title, "name": "title_" + TAG},
    {"js": numbering, "name": "numbering_" + TAG},
    {"js": fonts, "name": "fonts_" + TAG},
    {"js": curve, "name": "curve_" + TAG},
    {"js": layout, "name": "layout_" + TAG},
    {"js": kbd, "name": "kbd_" + TAG},
    {"key": " ", "vk": 32},
    {"wait": 500},
    {"js": after_space, "name": "space_" + TAG},
    {"js": palette, "name": "palette_" + TAG},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
