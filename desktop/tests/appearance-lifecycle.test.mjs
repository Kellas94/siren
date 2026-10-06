import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {patchClassicAppearance} from '../build/appearance.mjs';

test('actual original same-theme restore retains an open menu and the original palette lifecycle',async()=>{
 const html=(await readFile(new URL('../baseline/R78.html',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const start=html.indexOf('      function applyTheme(themeName, shouldRender) {'),end=html.indexOf('\n      function ',start+40);
 const functionSource=html.slice(start,end)+'\n      function following() {}';
 const functions='stopWastelandBootSequence stopObservatoryBootSequence stopKintsugiIntroSequence stopWondersIntroSequence clearWastelandInlineTheme clearObservatoryInlineTheme clearKintsugiInlineTheme applyCupertinoThemePreset syncCupertinoUi applyKpmgThemePreset syncKpmgUi clearWondersInlineTheme applyWondersThemePreset syncWondersUi stopWondersClock applyAmbientSoft tuneThemeAccessibility syncAmbientScene syncThemeMenu loadSelectedNodeStyleControls syncWastelandUi syncKintsugiUi syncObservatoryControls applyObservatoryShellState markPreviewOutdated scheduleRender'.split(' ');
 let paletteUpdates=0;const menu={hidden:false},window={sirenShell:{}},state={theme:'dark',wasteland:{},observatory:{},kintsugi:{}},document={body:{dataset:{theme:'dark'}},dispatchEvent(){}};
 const context={window,state,document,themePresets:{dark:{},light:{}},themeIntroTimers:{},el:{themePreset:{value:'dark'},themeMenu:menu},CustomEvent:class{},setThemeMenuOpen:open=>{menu.hidden=!open;},renderDiagramPaletteControls:()=>paletteUpdates++,themeArrivalDuration:()=>0,scheduleSave(){}};
 for(const name of functions)context[name]=()=>{};
 runInNewContext(patchClassicAppearance(functionSource),context);
 window.sirenClassicAppearance.apply('dark');menu.hidden=false;context.applyTheme('light',false);
 assert.equal(menu.hidden,false,'Delayed same native-owned appearance must not close the menu');
 assert.equal(paletteUpdates,1,'Retain the genuine original theme lifecycle work');
 context.applyTheme('dark',true,true);assert.equal(menu.hidden,true,'Genuine user choice closes the menu');
 menu.hidden=false;window.sirenClassicAppearance.apply('light');assert.equal(menu.hidden,true,'A genuinely changed native theme closes the old palette menu');
 window.sirenShell=undefined;menu.hidden=false;context.applyTheme('light',false);assert.equal(menu.hidden,true,'Standalone original same-theme restore retains its own behavior');
});
