"""Second function pass: the probes the first pass got wrong (diagram title preview,
legend in the render, and 'Build legend from classes' with a class actually assigned).

Usage: python mk2b.py <target> <tag> <out.json>
"""
import json, sys
from mk2 import BOOT, VISHELP, CLICKNODE, PORT

target, tag, out = sys.argv[1], sys.argv[2], sys.argv[3]

js1 = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP +
       "const out={};const card=document.getElementById('settingsSection');card.open=true;await s(500);"
       "const t=document.getElementById('diagramTitle');out.titleShown=shown(t);"
       "t.value='Month-end close';t.dispatchEvent(new Event('input',{bubbles:true}));await s(2500);"
       "out.titlePreview=(document.getElementById('diagramTitlePreview')||{}).textContent;"
       "const num=document.getElementById('numberingStyle');out.numberingShown=shown(num);"
       "num.value='flat';num.dispatchEvent(new Event('change',{bubbles:true}));await s(2500);"
       "out.firstNodeText=(document.querySelector('#diagram g.node')||{}).textContent;"
       "num.value='off';num.dispatchEvent(new Event('change',{bubbles:true}));await s(2000);"
       "out.firstNodeTextOff=(document.querySelector('#diagram g.node')||{}).textContent;"
       "return JSON.stringify(out);})()")

js2 = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP + CLICKNODE +
       "const out={};const card=document.getElementById('settingsSection');card.open=true;"
       "const folds=[...card.querySelectorAll('.style-fold')];folds.forEach(f=>f.open=true);await s(400);"
       "const tgt=document.getElementById('nodeStyleTarget');tgt.value='B';"
       "tgt.dispatchEvent(new Event('change',{bubbles:true}));await s(400);"
       "const fill=document.getElementById('nodeFillHex');if(fill){fill.value='#ff0055';"
       "fill.dispatchEvent(new Event('input',{bubbles:true}));fill.dispatchEvent(new Event('change',{bubbles:true}));}await s(400);"
       "const nm=document.getElementById('styleClassName');nm.value='Control point';"
       "nm.dispatchEvent(new Event('input',{bubbles:true}));"
       "document.getElementById('createStyleClassButton').click();await s(1500);"
       "out.classInSelect=[...document.getElementById('styleClassSelect').options].map(o=>o.value);"
       "document.getElementById('assignStyleClassButton').click();await s(2000);"
       "out.assignedToast=(document.querySelector('.toast, #toast')||{}).textContent;"
       "folds.forEach(f=>f.open=false);await s(300);out.allClosedBefore=folds.every(f=>!f.open);"
       "document.getElementById('legendFromClassesButton').click();await s(2500);"
       "const lf=document.getElementById('styleFoldLegend');out.legendFoldOpen=lf?lf.open:'-';"
       "out.legendItemsShown=shown(document.getElementById('legendItems'));"
       "out.legendEnabled=document.getElementById('legendEnabled').checked;"
       "out.legendInSvg=!!document.querySelector('#diagram [data-t-legend]');"
       "out.legendText=(document.querySelector('#diagram [data-t-legend]')||{}).textContent;"
       "return JSON.stringify(out);})()")

js3 = ("(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));" + VISHELP +
       "const out={};const card=document.getElementById('settingsSection');"
       "const folds=[...card.querySelectorAll('.style-fold')];folds.forEach(f=>f.open=true);await s(300);"
       "const ff=document.getElementById('diagramFontFamily');out.fontShown=shown(ff);"
       "ff.value=[...ff.options].map(o=>o.value).find(v=>/georgia/i.test(v))||ff.value;"
       "ff.dispatchEvent(new Event('change',{bubbles:true}));await s(2500);"
       "const lbl=document.querySelector('#diagram g.node .nodeLabel, #diagram g.node text');"
       "out.nodeFontFamily=lbl?getComputedStyle(lbl).fontFamily:'-';"
       "const eng=document.getElementById('layoutEngineSelect');out.engineShown=shown(eng);out.engine=eng.value;"
       "return JSON.stringify(out);})()")

steps = [
    {"nav": "http://127.0.0.1:%d/%s.html" % (PORT, target), "wait": 4500},
    {"js": BOOT, "name": "boot_" + tag},
    {"js": js1, "name": "g1_title_numbering_" + tag},
    {"js": js2, "name": "g2_class_legend_" + tag},
    {"shot": "g_%s_legend.png" % tag},
    {"js": js3, "name": "g3_font_engine_" + tag},
    {"shot": "g_%s_font.png" % tag},
]
open(out, 'w', encoding='utf-8').write(json.dumps(steps, indent=1))
print('wrote', out, len(steps))
