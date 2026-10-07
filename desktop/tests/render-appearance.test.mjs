import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {THEME_IDS} from '../src/appearance/contracts.mjs';
import {readAppearancePalette} from '../build/appearance.mjs';
import {createRenderAppearanceContract} from '../src/appearance/render.mjs';
const contract=createRenderAppearanceContract();
test('all native graph palettes match frozen original literals and named modes',async()=>{
 const source=await readFile(new URL('../baseline/R78.html',import.meta.url),'utf8'),start=source.indexOf('      const themePresets = {'),stop=source.indexOf('\n      };',start),presets=vm.runInNewContext('('+source.slice(start,stop).split(' = ').slice(1).join(' = ')+'\n})');
 const chrome=await readAppearancePalette();assert.equal(chrome.length,39);
 for(const id of THEME_IDS){const d=contract.resolve(id,false),p=contract.palette(d);assert.equal(d.mode,chrome.find(t=>t.id===id).mode);for(const key of ['canvasBg','text','muted','nodeFill','nodeText','nodeBorder','nodeAccent','nodeAccentBorder','line','edgeLabel'])assert.equal(p[key],presets[id][key],id+':'+key);}
});
test('forced named modes ignore OS mode while System resolves once',()=>{
 assert.deepEqual(contract.resolve('kpmg',true),{theme:'kpmg',mode:'light'});assert.deepEqual(contract.resolve('matrix',false),{theme:'matrix',mode:'dark'});
 assert.deepEqual(contract.resolve('system',true),{theme:'dark',mode:'dark'});assert.deepEqual(contract.resolve('system',false),{theme:'light',mode:'light'});
});
test('render capsule refuses unknown names, inconsistent modes and arbitrary CSS/fields',()=>{
 for(const d of [{theme:'kpmg',mode:'dark'},{theme:'system',mode:'light'},{theme:'https://bad',mode:'light'},{theme:'matrix',mode:'dark',colors:{fill:'url(x)'}},null])assert.throws(()=>contract.read(d));
 assert.throws(()=>contract.resolve('unknown',false));const d=contract.resolve('matrix',false);assert.equal(Object.isFrozen(d),true);assert.equal(Object.isFrozen(contract.palette(d)),true);
 const cfg=contract.config(d);assert.equal(cfg.theme,'base');assert.equal(cfg.themeVariables.primaryColor,'#021a08');assert.equal(cfg.themeVariables.primaryTextColor,'#caffd6');assert.equal(cfg.themeVariables.darkMode,true);assert.equal('layout'in cfg,false);assert.equal('securityLevel'in cfg,false);
});
