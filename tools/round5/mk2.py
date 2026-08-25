"""Step generators for the style5 FIX re-verification (round 5 fix pass).

Usage: python mk2.py <kind> <target: app|base|def> <tag> <out.json>
Every JS string is built without literal newlines; newlines inside seeded source use
String.fromCharCode(10).
"""
import json, sys

NL = "String.fromCharCode(10)"
PORT = 9993

SEED = ("'flowchart TD'+NL+'  A[Open the ledger] --> B[Check balances]'+NL+"
        "'  B --> C[Sample items]'+NL+'  C --> D[Test controls]'+NL+"
        "'  D --> E[Sign the file]'").replace("NL", NL)

BOOT = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
        "document.body.click();await s(400);"
        "document.querySelectorAll('.tour-card button').forEach(b=>{if(/skip|done|got it|close/i.test(b.textContent))b.click();});"
        "await s(300);"
        "document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close();}catch(e){}});"
        "await s(300);"
        "const src=document.getElementById('source');"
        "src.value=" + SEED + ";"
        "src.dispatchEvent(new Event('input',{bubbles:true}));"
        "await s(3800);"
        "return 'seeded len='+src.value.length+' nodes='+document.querySelectorAll('#diagram g.node').length;})()")

# a control is "on screen" only if it is visible AND every <details> above it is open
VISHELP = ("const shown=e=>{if(!e)return false;"
           "if(typeof e.checkVisibility==='function'&&!e.checkVisibility({checkOpacity:false,checkVisibilityCSS:true}))return false;"
           "const r=e.getBoundingClientRect();if(r.width<=0||r.height<=0)return false;"
           "let d=e.closest('details');while(d){if(!d.open)return false;d=d.parentElement?d.parentElement.closest('details'):null;}"
           "return true;};")

CONNECT_MEASURE = (
    "(function(){const tb=document.querySelector('.preview-toolbar');"
    "const cb=document.getElementById('connectModeButton');"
    "const btns=tb?[...tb.querySelectorAll('button')].filter(b=>{const c=getComputedStyle(b);"
    "return c.display!=='none'&&c.visibility!=='hidden'&&b.getBoundingClientRect().width>0;}):[];"
    "const r=cb?cb.getBoundingClientRect():null;"
    "return {vw:innerWidth,vh:innerHeight,toolbarBtnCount:btns.length,"
    "toolbarLabels:btns.map(b=>(b.getAttribute('aria-label')||b.textContent||'').trim().slice(0,24)),"
    "connectDisplay:cb?getComputedStyle(cb).display:'missing',"
    "connectRect:r?Math.round(r.width)+'x'+Math.round(r.height):'-',"
    "connectLabel:cb?(cb.textContent||'').trim():'-',"
    "connectAria:cb?cb.getAttribute('aria-label'):'-',"
    "connectPressed:cb?cb.getAttribute('aria-pressed'):'-',"
    "bodyConnectMode:document.body.classList.contains('connect-mode')};})()")

CLICKNODE = ("const clickNode=async(txt)=>{const g=[...document.querySelectorAll('#diagram g.node')]"
             ".find(n=>(n.textContent||'').indexOf(txt)>=0);if(!g)return 'no node '+txt;"
             "const r=g.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;"
             "const o={bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:1,isPrimary:true,button:0};"
             "g.dispatchEvent(new PointerEvent('pointerdown',o));window.dispatchEvent(new PointerEvent('pointerup',o));"
             "g.dispatchEvent(new MouseEvent('click',o));await new Promise(r2=>setTimeout(r2,900));return 'clicked '+txt;};")


def mobile(target, tag):
    """Defect 1: is the Connect button a reachable START route below 900px?"""
    js_use = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + CLICKNODE +
              "const cb=document.getElementById('connectModeButton');const out={};"
              "out.displayAtRest=cb?getComputedStyle(cb).display:'missing';"
              "if(out.displayAtRest==='none')return JSON.stringify({note:'button not reachable at rest',...out});"
              "cb.click();await s(600);"
              "out.modeOnAfterButton=document.body.classList.contains('connect-mode');"
              "out.labelWhileOn=(cb.textContent||'').trim();out.ariaWhileOn=cb.getAttribute('aria-label');"
              "out.c1=await clickNode('Open the ledger');out.c2=await clickNode('Sign the file');"
              "await s(1200);const src=document.getElementById('source');"
              "out.sourceHasEdge=/A\\s*-->\\s*E/.test(src.value);"
              "out.modeAfter=document.body.classList.contains('connect-mode');"
              "out.displayAfter=getComputedStyle(cb).display;return JSON.stringify(out);})()")
    return [
        {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
        {"js": BOOT, "name": "boot_" + tag},
        {"click": "#mobilePreviewTab"},
        {"wait": 1200},
        {"js": CONNECT_MEASURE, "name": "toolbar_" + tag},
        {"shot": "m_%s.png" % tag},
        {"js": js_use, "name": "use_" + tag},
        {"shot": "m_%s_after.png" % tag},
    ]


def desktop_connect(target, tag):
    """Right-click a block -> Connect from here; chip appears; chip clicks out; Esc."""
    js = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + CLICKNODE +
          "const cb=document.getElementById('connectModeButton');const out={};"
          "out.chipAtRest=getComputedStyle(cb).display;"
          "const g=[...document.querySelectorAll('#diagram g.node')].find(n=>(n.textContent||'').indexOf('Open the ledger')>=0);"
          "const r=g.getBoundingClientRect();"
          "g.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:2}));"
          "await s(700);"
          "const menu=document.querySelector('.context-menu,[role=menu],.structure-menu');"
          "const rows=menu?[...menu.querySelectorAll('button,[role=menuitem]')].map(b=>(b.textContent||'').trim()):[];"
          "out.menuRows=rows;"
          "const row=menu?[...menu.querySelectorAll('button,[role=menuitem]')].find(b=>/connect from here/i.test(b.textContent)):null;"
          "if(!row)return JSON.stringify({...out,fail:'no connect row'});"
          "row.click();await s(700);"
          "out.modeOn=document.body.classList.contains('connect-mode');"
          "out.chipWhileOn=getComputedStyle(cb).display;out.chipLabel=(cb.textContent||'').trim();"
          "out.chipAria=cb.getAttribute('aria-label');out.chipTitle=cb.getAttribute('title');"
          "out.status=(document.querySelector('#previewStatus,#statusText,.status-text')||{}).textContent;"
          "out.c=await clickNode('Sign the file');await s(1200);"
          "out.sourceHasEdge=/A\\s*-->\\s*E/.test(document.getElementById('source').value);"
          "out.modeAfterEdge=document.body.classList.contains('connect-mode');"
          "out.chipAfterEdge=getComputedStyle(cb).display;"
          "return JSON.stringify(out);})()")
    js2 = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
           "const cb=document.getElementById('connectModeButton');const out={};"
           "const g=[...document.querySelectorAll('#diagram g.node')].find(n=>(n.textContent||'').indexOf('Check balances')>=0);"
           "const r=g.getBoundingClientRect();"
           "g.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:2}));"
           "await s(700);const menu=document.querySelector('.context-menu,[role=menu],.structure-menu');"
           "const row=menu?[...menu.querySelectorAll('button,[role=menuitem]')].find(b=>/connect from here/i.test(b.textContent)):null;"
           "row.click();await s(600);out.on=document.body.classList.contains('connect-mode');"
           "out.chipVisible=getComputedStyle(cb).display;"
           "cb.click();await s(600);"
           "out.modeAfterChipClick=document.body.classList.contains('connect-mode');"
           "out.chipAfterChipClick=getComputedStyle(cb).display;"
           "out.pressed=cb.getAttribute('aria-pressed');out.ariaAtRest=cb.getAttribute('aria-label');"
           "out.labelAtRest=(cb.textContent||'').trim();return JSON.stringify(out);})()")
    return [
        {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
        {"js": BOOT, "name": "boot_" + tag},
        {"js": CONNECT_MEASURE, "name": "rest_" + tag},
        {"js": js, "name": "rightclick_" + tag},
        {"shot": "d_%s_connect.png" % tag},
        {"js": js2, "name": "chipexit_" + tag},
    ]


def census(target, tag):
    """Visible-control census at rest + Style card geometry, open and all-open."""
    js_rest = ("(function(){" + VISHELP +
               "const all=[...document.querySelectorAll('button,input,select,textarea,summary,[role=button]')].filter(shown);"
               "const tb=document.querySelector('.preview-toolbar');"
               "const tbb=tb?[...tb.querySelectorAll('button')].filter(shown):[];"
               "return {vw:innerWidth,vh:innerHeight,visibleControls:all.length,previewToolbarButtons:tbb.length,"
               "hasConnectLabel:tbb.some(b=>/connect/i.test(b.getAttribute('aria-label')||b.textContent||''))};})()")
    js_card = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP +
               "const card=document.getElementById('settingsSection');card.open=true;await s(600);"
               "const body=card.querySelector('.details-body');"
               "const ctrls=[...card.querySelectorAll('input,select,textarea,button')].filter(shown);"
               "const folds=[...card.querySelectorAll('.style-fold')];"
               "const out={cardBodyHeight:Math.round(body.getBoundingClientRect().height),"
               "controlsOnOpen:ctrls.length,controlIdsOnOpen:ctrls.map(c=>c.id).filter(Boolean),"
               "foldCount:folds.length,foldNames:folds.map(f=>{const sm=f.querySelector('summary');"
               "const id=sm.getAttribute('aria-labelledby');const n=id?document.getElementById(id):null;"
               "return (n?n.textContent:sm.textContent).trim();}),foldOpen:folds.map(f=>f.open)};"
               "folds.forEach(f=>f.open=true);await s(500);"
               "const all=[...card.querySelectorAll('input,select,textarea,button')].filter(shown);"
               "out.controlsAllOpen=all.length;out.allIds=all.map(c=>c.id).filter(Boolean).sort();"
               "out.dupIds=out.allIds.filter((v,i,a)=>a.indexOf(v)!==i);"
               "out.cardBodyHeightAllOpen=Math.round(body.getBoundingClientRect().height);"
               "return JSON.stringify(out);})()")
    return [
        {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
        {"js": BOOT, "name": "boot_" + tag},
        {"js": js_rest, "name": "census_" + tag},
        {"shot": "c_%s_rest.png" % tag},
        {"js": js_card, "name": "card_" + tag},
        {"shot": "c_%s_card.png" % tag},
    ]


def funcs(target, tag):
    """Every folded function still works; legend fold reveal; the Style button never
    lands on a card with nothing to touch; the hidden 'Sidebar settings' route."""
    js1 = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP +
           "const out={};const card=document.getElementById('settingsSection');card.open=true;await s(500);"
           "const open=n=>{const f=[...card.querySelectorAll('.style-fold')][n];f.open=true;return f;};"
           "const t=document.getElementById('diagramTitle');t.value='Month-end close';"
           "t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));await s(2500);"
           "out.previewHeading=(document.querySelector('#diagram .t-diagram-title, #diagramTitleDisplay, #previewTitle')||{}).textContent||'(none)';"
           "out.sourceTitle=/Month-end close/.test(document.getElementById('source').value);"
           "open(1);await s(300);"
           "const curve=document.getElementById('curve');out.curveVisible=shown(curve);"
           "const eng=document.getElementById('layoutEngineSelect');out.engineVisible=shown(eng);out.engineValue=eng.value;"
           "const before=(document.querySelector('#diagram path.flowchart-link, #diagram .edgePath path')||{}).getAttribute?"
           "(document.querySelector('#diagram path.flowchart-link, #diagram .edgePath path')).getAttribute('d'):'';"
           "curve.value='linear';curve.dispatchEvent(new Event('change',{bubbles:true}));await s(2500);"
           "const after=(document.querySelector('#diagram path.flowchart-link, #diagram .edgePath path'));"
           "out.edgePathChanged=!!after&&after.getAttribute('d')!==before;out.curveValue=curve.value;"
           "return JSON.stringify(out);})()")
    js2 = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP +
           "const out={};const card=document.getElementById('settingsSection');"
           "const folds=[...card.querySelectorAll('.style-fold')];folds.forEach(f=>f.open=true);await s(400);"
           "const sp=document.getElementById('layoutNodeSpacing');out.spacingBefore=sp?sp.value:'-';"
           "const dens=document.getElementById('layoutDensity');if(dens){dens.value='spacious';dens.dispatchEvent(new Event('change',{bubbles:true}));}"
           "document.getElementById('applyLayoutButton').click();await s(2200);out.spacingAfterApply=sp?sp.value:'-';"
           "document.getElementById('resetLayoutButton').click();await s(2200);out.spacingAfterReset=sp?sp.value:'-';"
           "const fs2=document.getElementById('diagramFontSize');fs2.value='22';fs2.dispatchEvent(new Event('change',{bubbles:true}));await s(2500);"
           "const lbl=document.querySelector('#diagram g.node .nodeLabel, #diagram g.node text');"
           "out.nodeFontSize=lbl?getComputedStyle(lbl).fontSize:'-';"
           "const le=document.getElementById('legendEnabled');le.checked=true;le.dispatchEvent(new Event('change',{bubbles:true}));await s(2500);"
           "out.legendInRender=!!document.querySelector('#diagram .t-legend, #diagram [data-legend], #legendOverlay');"
           "return JSON.stringify(out);})()")
    js3 = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP +
           "const out={};const card=document.getElementById('settingsSection');"
           "const folds=[...card.querySelectorAll('.style-fold')];"
           "folds.forEach(f=>f.open=false);await s(300);"
           "out.allFoldsClosed=folds.every(f=>!f.open);"
           "const btn=document.getElementById('legendFromClassesButton');out.legendBtnExists=!!btn;"
           "if(btn){btn.click();await s(1800);}"
           "const legendFold=document.getElementById('styleFoldLegend');"
           "out.legendFoldOpenAfter=legendFold?legendFold.open:'-';"
           "out.legendItemsShown=shown(document.getElementById('legendItems'));"
           "folds.forEach(f=>f.open=false);card.open=false;await s(300);"
           "document.getElementById('styleShortcutButton').click();await s(900);"
           "out.cardOpenAfterShortcut=card.open;"
           "out.foldsOpenAfterShortcut=folds.map(f=>f.open);"
           "const ctrls=[...card.querySelectorAll('input,select,textarea,button')].filter(shown);"
           "out.controlsShownAfterShortcut=ctrls.length;"
           "return JSON.stringify(out);})()")
    js4 = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP + CLICKNODE +
           "const out={};await clickNode('Check balances');await s(700);"
           "const insp=document.getElementById('nodeInspector');out.inspectorOpen=insp?!insp.hidden:'-';"
           "const mb=document.getElementById('inspectorMoreButton');"
           "out.moreButtonHiddenAttr=mb?mb.hasAttribute('hidden'):'missing';"
           "out.moreButtonShown=mb?shown(mb):'-';"
           "if(mb){mb.click();await s(1200);}"
           "const card=document.getElementById('settingsSection');out.cardOpen=card.open;"
           "const tgt=document.getElementById('nodeStyleTarget');"
           "out.nodeStyleTargetShown=shown(tgt);out.activeElement=document.activeElement?document.activeElement.id:'-';"
           "out.nodeStyleTargetValue=tgt?tgt.value:'-';"
           "return JSON.stringify(out);})()")
    return [
        {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
        {"js": BOOT, "name": "boot_" + tag},
        {"js": js1, "name": "f1_title_curve_" + tag},
        {"js": js2, "name": "f2_layout_font_legend_" + tag},
        {"shot": "f_%s_legend.png" % tag},
        {"js": js3, "name": "f3_reveal_shortcut_" + tag},
        {"shot": "f_%s_shortcut.png" % tag},
        {"js": js4, "name": "f4_inspector_route_" + tag},
        {"shot": "f_%s_inspector.png" % tag},
    ]


def kbd(target, tag):
    js = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
          "const out={};const card=document.getElementById('settingsSection');card.open=true;await s(500);"
          "const sums=[...card.querySelectorAll('.style-fold > summary')];"
          "out.summaryCount=sums.length;"
          "const f=sums[3];const fold=f.parentElement;fold.open=false;await s(200);"
          "f.focus();out.focused=document.activeElement===f;"
          "f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true}));await s(300);"
          "out.afterEnter=fold.open;"
          "f.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',keyCode:32,bubbles:true}));"
          "f.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',keyCode:32,bubbles:true}));await s(300);"
          "out.afterSpace=fold.open;"
          "out.accName=sums.map(x=>{const id=x.getAttribute('aria-labelledby');const n=id?document.getElementById(id):null;"
          "return n?n.textContent.trim():'(whole summary)';});"
          "return JSON.stringify(out);})()")
    js_esc = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));const out={};"
              "const g=[...document.querySelectorAll('#diagram g.node')].find(n=>(n.textContent||'').indexOf('Open the ledger')>=0);"
              "const r=g.getBoundingClientRect();"
              "g.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:2}));"
              "await s(700);const menu=document.querySelector('.context-menu,[role=menu],.structure-menu');"
              "const row=menu?[...menu.querySelectorAll('button,[role=menuitem]')].find(b=>/connect from here/i.test(b.textContent)):null;"
              "if(row)row.click();await s(600);out.modeOn=document.body.classList.contains('connect-mode');"
              "const vp=document.getElementById('zoomViewport');if(vp)vp.focus();"
              "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,bubbles:true}));await s(600);"
              "out.modeAfterEsc=document.body.classList.contains('connect-mode');"
              "const cb=document.getElementById('connectModeButton');"
              "out.chipAfterEsc=getComputedStyle(cb).display;out.pressed=cb.getAttribute('aria-pressed');"
              "out.ariaAfterEsc=cb.getAttribute('aria-label');return JSON.stringify(out);})()")
    return [
        {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
        {"js": BOOT, "name": "boot_" + tag},
        {"js": js, "name": "kbd_" + tag},
        {"js": js_esc, "name": "esc_" + tag},
    ]


def light(target, tag):
    js_theme = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));"
                "const t=document.getElementById('themeSelect')||document.getElementById('appTheme');"
                "if(t){t.value='light';t.dispatchEvent(new Event('change',{bubbles:true}));}"
                "else{document.documentElement.setAttribute('data-theme','light');}"
                "await s(1200);const card=document.getElementById('settingsSection');card.open=true;await s(600);"
                "return 'theme='+(document.documentElement.getAttribute('data-theme')||document.body.className);})()")
    return [
        {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
        {"js": BOOT, "name": "boot_" + tag},
        {"js": js_theme, "name": "theme_" + tag},
        {"shot": "l_%s_style.png" % tag},
    ]


KINDS = {"mobile": mobile, "desktop": desktop_connect, "census": census,
         "funcs": funcs, "kbd": kbd, "light": light}

if __name__ == '__main__':
    kind, target, tag, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    steps = KINDS[kind](target, tag)
    open(out, 'w', encoding='utf-8').write(json.dumps(steps, indent=1))
    print('wrote', out, len(steps), 'steps')
