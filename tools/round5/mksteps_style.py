import json, sys

NL = "String.fromCharCode(10)"
TARGET = sys.argv[1]
OUTJSON = sys.argv[2]
TAG = sys.argv[3]

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

# strict visibility: the element must be rendered AND every <details> above it open
HELP = ("const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "const card=()=>document.getElementById('settingsSection');"
        "const openAbove=e=>{let d=e.parentElement?e.parentElement.closest('details'):null;"
        "while(d){if(!d.open)return false;d=d.parentElement?d.parentElement.closest('details'):null;}return true;};"
        "const shown=root=>[...root.querySelectorAll('input,select,textarea,button')]"
        ".filter(e=>e.checkVisibility&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&openAbove(e));"
        "const cardBody=()=>{const b=card().querySelector('.details-body');"
        "return b?Math.round(b.getBoundingClientRect().height):-1;};"
        "const folds=()=>[...card().querySelectorAll('.style-fold')];")

boot = ("(async()=>{" + HELP +
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});await s(300);"
        "const src=document.getElementById('source');src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3800);"
        "return {seeded:src.value.length};})()")

census = ("(async()=>{" + HELP +
          "const all=shown(document.body);"
          "return {step:'censusAtRest',tag:'" + TAG + "',vw:innerWidth,visibleControls:all.length,"
          "previewToolbarButtons:[...document.querySelectorAll('.preview-toolbar button')]"
          ".filter(b=>b.checkVisibility({checkVisibilityCSS:true})).length,"
          "cardOpen:card().open};})()")

opencard = ("(async()=>{" + HELP +
            "document.getElementById('styleShortcutButton').click();await s(900);"
            "const f=folds();"
            "return {step:'openViaStyleButton',cardOpen:card().open,bodyHeight:cardBody(),"
            "controlsShown:shown(card()).length,foldCount:f.length,"
            "foldOpen:f.map(x=>x.open),"
            "doors:f.map(x=>{const sm=x.querySelector('summary');const nameId=sm.getAttribute('aria-labelledby');"
            "const nameEl=nameId?document.getElementById(nameId):null;"
            "return {name:nameEl?nameEl.textContent.trim():'(no aria-labelledby)',"
            "whoVisible:!!x.querySelector('.style-fold-who')&&x.querySelector('.style-fold-who').checkVisibility({checkVisibilityCSS:true}),"
            "who:(x.querySelector('.style-fold-who')||{textContent:''}).textContent.trim().slice(0,44)};})};})()")

openall = ("(async()=>{" + HELP +
           "folds().forEach(f=>f.open=true);await s(500);"
           "const list=shown(card()).map(e=>e.id||('('+e.tagName.toLowerCase()+':'+(e.textContent||'').trim().slice(0,18)+')'));"
           "return {step:'allFoldsOpen',controlsShown:list.length,bodyHeight:cardBody(),"
           "curveVisible:!!document.getElementById('curve')&&document.getElementById('curve').checkVisibility({checkVisibilityCSS:true}),"
           "engineVisible:!!document.getElementById('layoutEngineSelect')&&document.getElementById('layoutEngineSelect').checkVisibility({checkVisibilityCSS:true}),"
           "ids:list.sort()};})()")

shutall = ("(async()=>{" + HELP +
           "folds().forEach(f=>f.open=false);card().open=false;await s(400);"
           "const beforeClick={anyFoldOpen:folds().some(f=>f.open),cardOpen:card().open};"
           "document.getElementById('styleShortcutButton').click();await s(900);"
           "return {step:'styleButtonNeverLandsEmpty',beforeClick:beforeClick,"
           "cardOpen:card().open,firstFoldOpen:folds()[0]?folds()[0].open:null,"
           "controlsShown:shown(card()).length,bodyHeight:cardBody()};})()")

legend = ("(async()=>{" + HELP +
          "const src=document.getElementById('source');"
          "src.value=src.value+String.fromCharCode(10)+'  classDef ctrl fill:#ffdd55'+String.fromCharCode(10)+'  class B ctrl';"
          "src.dispatchEvent(new Event('input',{bubbles:true}));await s(3500);"
          "folds().forEach(f=>f.open=false);await s(300);"
          "const b=document.getElementById('legendFromClassesButton');"
          "if(!b)return {step:'legendRoute',found:false};"
          "b.click();await s(1500);"
          "const li=document.getElementById('legendItems');"
          "return {step:'legendRoute',found:true,legendFoldOpen:!!li&&openAbove(li),"
          "legendItemsVisible:!!li&&li.checkVisibility({checkVisibilityCSS:true}),"
          "rows:li?li.querySelectorAll('input[type=checkbox]').length:-1};})()")

inspector = ("(async()=>{" + HELP +
             "const n=[...document.querySelectorAll('#diagram g.node')].find(x=>x.textContent.indexOf('Check balances')>=0);"
             "const r=n.getBoundingClientRect();const o={bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0,pointerId:1,isPrimary:true};"
             "n.dispatchEvent(new PointerEvent('pointerdown',o));window.dispatchEvent(new PointerEvent('pointerup',o));"
             "n.dispatchEvent(new MouseEvent('click',o));await s(900);"
             "const insp=document.getElementById('nodeInspector');"
             "const more=document.getElementById('inspectorMoreButton');"
             "return {step:'inspectorMoreButton',inspectorOpen:!!insp&&insp.checkVisibility({checkVisibilityCSS:true}),"
             "moreExists:!!more,moreHiddenAttr:more?more.hasAttribute('hidden'):null,"
             "moreVisible:more?more.checkVisibility({checkVisibilityCSS:true}):null};})()")

steps = [
    {"nav": "http://127.0.0.1:9993/" + TARGET + ".html", "wait": 4500},
    {"js": boot, "name": "boot_" + TAG},
    {"js": census, "name": "census_" + TAG},
    {"js": opencard, "name": "opencard_" + TAG},
    {"shot": "style_" + TAG + "_open.png"},
    {"js": openall, "name": "openall_" + TAG},
    {"js": shutall, "name": "shutall_" + TAG},
    {"shot": "style_" + TAG + "_shortcut.png"},
    {"js": legend, "name": "legend_" + TAG},
    {"js": inspector, "name": "inspector_" + TAG},
]
open(OUTJSON, "w", encoding="utf-8").write(json.dumps(steps, indent=1))
print("wrote", OUTJSON)
