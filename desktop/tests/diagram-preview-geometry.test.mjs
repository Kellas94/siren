import test from 'node:test';import assert from 'node:assert/strict';
import {isNativeDiagramGeometry} from './native/diagram-preview-geometry.mjs';
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
const fixture=()=>({width:959,height:575,main:rect(0,68,959,507),layout:rect(18,183,923,374),panel:rect(330,183,611,374),toolbar:rect(330,183,611,38),status:rect(18,147,923,12),viewport:rect(330,237,611,320),notice:null,middle:[],mainPaddingBottom:18,mainBorderBottom:0,mainRowGap:12,panelRowGap:8});
test('321px-class preview fills the actual remaining grid in a 575px window',()=>assert.equal(isNativeDiagramGeometry(fixture()),true));
test('visible style or build panel consumes its own row while preview fills the remainder',()=>{const r=fixture();r.middle=[rect(330,229,611,100)];r.viewport=rect(330,337,611,220);assert.equal(isNativeDiagramGeometry(r),true);});
test('visible change notice has one following main-grid gap',()=>{const r=fixture();r.notice=rect(18,171,923,22);r.layout=rect(18,205,923,352);r.panel=rect(330,205,611,352);r.toolbar=rect(330,205,611,38);r.viewport=rect(330,259,611,298);assert.equal(isNativeDiagramGeometry(r),true);});
for(const [name,change]of [
 ['zero viewport',r=>r.viewport=rect(330,237,611,0)],
 ['bottom blank area',r=>r.viewport=rect(330,237,611,300)],
 ['unused space above preview',r=>r.viewport=rect(330,257,611,300)],
 ['collapsed layout shifted down',r=>{r.layout=rect(18,283,923,274);r.panel=rect(330,283,611,274);r.toolbar=rect(330,283,611,38);r.viewport=rect(330,337,611,220)}],
 ['viewport outside panel width',r=>r.viewport=rect(350,237,591,320)],
 ['invalid geometry',r=>r.mainRowGap=NaN]
])test('refuses '+name,()=>{const r=fixture();change(r);assert.equal(isNativeDiagramGeometry(r),false);});
