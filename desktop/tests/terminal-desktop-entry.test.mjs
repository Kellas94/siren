import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {terminalPalette} from '../src/terminal/desktop-theme.mjs';
const body=await readFile(new URL('../src/ui/terminal/entry.js',import.meta.url),'utf8');
function fixture(){
 let resolveTheme;const calls=[],listeners=new Map(),buttons=new Map(),properties=new Map(),subscriptions=new Map();let refreshResolve,available=true;
 const palette=terminalPalette('light',false),satellite={snapshot:()=>({available}),refresh:()=>new Promise(r=>refreshResolve=r),setTheme:p=>{calls.push(['theme',p]);return {ok:true};},dispose:()=>{available=false;calls.push(['dispose']);},drain:async()=>{calls.push(['drain']);}};
 for(const id of ['terminalWorkspace','terminalPlacement','terminalHelp'])buttons.set(id,{addEventListener:(name,fn)=>listeners.set(id+':'+name,fn),textContent:''});
 const doc={getElementById:id=>buttons.get(id),documentElement:{style:{setProperty:(k,v)=>properties.set(k,v)}}};
 const bridge={getTerminalHelpContext:async()=>({ok:true,readable:true,role:'terminal',windowId:'window1',projectId:'project1',epoch:1}),getTerminalTheme:()=>new Promise(r=>resolveTheme=r),toggleTerminalPlacement:async()=>({ok:true,placement:'attached'}),onTerminalTheme:fn=>{subscriptions.set('theme',fn);return()=>calls.push(['off','theme']);},onTerminalContext:fn=>{subscriptions.set('context',fn);return()=>calls.push(['off','context']);},onTerminalHelp:fn=>{subscriptions.set('help',fn);return()=>calls.push(['off','help']);}};
 const help={open:()=>calls.push(['help']),close:()=>calls.push(['help-close']),dispose:()=>calls.push(['help-dispose'])};
 const win={sirenTerminal:bridge,SirenHelp:{create:()=>help},location:{href:'siren://app/windows/terminal.html?windowId=window1'},requestAnimationFrame(){},cancelAnimationFrame(){},ResizeObserver:class{},addEventListener:(name,fn)=>listeners.set(name,fn)};
 const source=body.replace(/^import .*;\r?\n/gm,'').replace('export function bootTerminalEntry','function bootTerminalEntry')+'\nthis.boot=bootTerminalEntry;';
 const context={URL,Terminal:class{},FitAddon:class{},SearchAddon:class{},createTerminalSatellite:()=>{throw Error('Must use finite injected test controls');}};vm.runInNewContext(source,context,{timeout:1000});
 const result=context.boot({window:win,document:doc,createSatellite:options=>{assert.equal(options.windowId,'window1');assert.equal(options.bridge,bridge);return satellite;}});
 return {result,calls,listeners,buttons,properties,palette,subscriptions,ready:()=>refreshResolve(true),theme:value=>resolveTheme(value)};
}
const tick=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
test('actual entry applies accepted theme to real controls and chrome, routes placement and offline Help',async()=>{const f=fixture();f.ready();await tick();f.theme({ok:true,palette:f.palette});await tick();assert.equal(f.properties.get('--terminal-bg'),f.palette.background);assert.equal(f.calls.filter(c=>c[0]==='theme').length,1);await f.listeners.get('terminalPlacement:click')();assert.equal(f.buttons.get('terminalPlacement').textContent,'Detach window');f.subscriptions.get('help')('unknown');assert.equal(f.calls.some(c=>c[0]==='help'),false);await f.subscriptions.get('help')('desktopHelpDiagnostics');assert.equal(f.calls.some(c=>c[0]==='help'),true);f.result.dispose();});
test('entry pagehide retires synchronously and a late theme cannot touch disposed controls or chrome',async()=>{const f=fixture();f.ready();await tick();f.listeners.get('pagehide')();assert.equal(f.result.snapshot().available,false);f.theme({ok:true,palette:f.palette});await tick();assert.equal(f.properties.size,0);assert.equal(f.calls.filter(c=>c[0]==='dispose').length,1);assert.equal(f.calls.filter(c=>c[0]==='off').length,3);f.result.dispose();assert.equal(f.calls.filter(c=>c[0]==='dispose').length,1);});
test('theme projection supports known themes and never accepts arbitrary CSS',()=>{for(const name of ['light','dark','system','oled','kpmg-blue','navy']){const p=terminalPalette(name,true);assert.equal(Object.keys(p).length,4);assert.ok(Object.values(p).every(v=>/^#[a-f0-9]{6}$/i.test(v)));}assert.deepEqual(terminalPalette('url(https://example.invalid)',false),terminalPalette('dark',false));});
test('private initializer is single-use, ordinary main default null and package excludes candidate graph/resources',async()=>{
 const a=await import('../src/desktop-launch.mjs?closed-default');assert.equal(a.takeDesktopLaunch(),null);assert.throws(()=>a.configureDesktopLaunch(()=>{}));
 const b=await import('../src/desktop-launch.mjs?closed-fixed'),initializer=()=>{};b.configureDesktopLaunch(initializer);assert.throws(()=>b.configureDesktopLaunch(()=>{}));assert.equal(b.takeDesktopLaunch(),initializer);assert.throws(()=>b.takeDesktopLaunch());
 const {allowedAppFile}=await import('../scripts/package.mjs');assert.equal(allowedAppFile('src/desktop-launch.mjs',new Set()),true);for(const path of ['src/terminal/candidate-initializer.mjs','src/terminal/shutdown-graph.mjs','generated/terminal-launch-preload.cjs','generated/windows/terminal.html','src/ui/terminal/preload.cjs'])assert.equal(allowedAppFile(path,new Set()),false,path);
});
