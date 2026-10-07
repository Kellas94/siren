import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {AppearanceStore} from '../src/appearance/store.mjs';
import {invokeShell} from '../src/appearance/ipc.mjs';
import {readAppearancePalette,readDesktopShell,addDesktopShell} from '../build/appearance.mjs';
import {Script,runInNewContext} from 'node:vm';
import {parse} from 'parse5';

test('original named themes retain their exact chrome colours without importing resources',async()=>{
 const themes=await readAppearancePalette();assert.equal(themes.length,39);
 const blue=themes.find(t=>t.id==='kpmg');assert.equal(blue.name,'KPMG Blue');
 assert.equal(blue.mode,'light');assert.equal(blue.colors['app-bg'],'#edf2f9');assert.equal(blue.colors.primary,'#00338d');
 assert.equal(new Set(themes.map(t=>t.id)).size,39);
 assert.equal(/url\s*\(|@import|<script/i.test(JSON.stringify(themes)),false);
});
test('native appearance carries original angular, rounded and glow metrics through the packed shell',async()=>{
 const themes=await readAppearancePalette(),byId=id=>themes.find(t=>t.id===id);
 assert.deepEqual(['xl','lg','md','sm'].map(size=>byId('artdeco').metrics['radius-'+size]),['8px','6px','4px','2px']);
 assert.deepEqual(['xl','lg','md','sm'].map(size=>byId('cupertino').metrics['radius-'+size]),['30px','24px','17px','13px']);
 assert.equal(byId('light').metrics['shadow-soft'],'0 8px 24px rgba(68, 51, 38, 0.08)');
 assert.equal(byId('matrix').metrics.shadow,'0 0 0 1px rgba(0,255,65,.14), 0 0 32px rgba(0,255,65,.10)');
 assert.equal(byId('cupertino').metrics.shadow.includes('inset'),true);
 const window={};runInNewContext((await readDesktopShell()).split('\n')[0],{window});
 assert.deepEqual(JSON.parse(JSON.stringify(window.SirenAppearancePalette)),themes);
 for(const theme of themes){assert.equal(Object.keys(theme.metrics).length,6);assert.equal(/url\s*\(|@import|var\s*\(|expression|<|>/i.test(JSON.stringify(theme.metrics)),false);}
});
test('appearance persists atomically, refuses stale writers and preserves corrupt records',async()=>{
 const root=await mkdtemp(join(tmpdir(),'siren-appearance-'));const store=new AppearanceStore(root);
 assert.deepEqual(await store.read(),{ok:true,theme:'system'});
 assert.equal((await store.set({theme:'kpmg'})).ok,true);
 assert.deepEqual(await new AppearanceStore(root).read(),{ok:true,theme:'kpmg'});
 let live=true;const fenced=new AppearanceStore(root,{fault:async phase=>{if(phase==='before-rename')live=false;}});
 assert.equal((await fenced.set({theme:'sakura'},{isCurrent:()=>live})).ok,false);
 assert.equal((await store.read()).theme,'kpmg');
 assert.equal((await store.set({theme:'kpmg',path:'arbitrary'})).ok,false);
 await writeFile(join(root,'UI','appearance.json'),'broken');
 assert.equal((await store.read()).code,'INVALID_APPEARANCE');
 assert.equal((await store.set({theme:'dark'})).ok,false);
 assert.equal(await readFile(join(root,'UI','appearance.json'),'utf8'),'broken');
});
test('private shell refuses Audience, forged fields and callers retired during an await',async()=>{
 const frame={},sender={};const event={sender,senderFrame:frame};let live=true;const captured={role:'docs'};
 const args={event,capture:()=>captured,isCurrent:()=>live,store:{read:async()=>{live=false;return {ok:true,theme:'kpmg'};}},navigate:async()=>({ok:true})};
 assert.equal((await invokeShell({...args,method:'getAppearance'})).code,'ACCESS_REFUSED');
 live=true;assert.equal((await invokeShell({...args,capture:()=>({role:'audience'}),method:'navigate',payload:{surface:'home'}})).code,'ACCESS_REFUSED');
 assert.equal((await invokeShell({...args,method:'navigate',payload:{surface:'docs',projectId:'forged'}})).code,'REQUEST_REFUSED');
 let route;assert.deepEqual(await invokeShell({...args,method:'navigate',payload:{surface:'code'},navigate:async surface=>{route=surface;return {ok:true};}}),{ok:true});assert.equal(route,'code');
});
test('shared asset insertion preserves closing-body literals inside renderer libraries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'siren-shell-boundary-'));
 const code="const rendererTemplate='<html><body>sample</body></html>';";
 const output=await addDesktopShell('<html><head><meta content="script-src \'sha256-test\'; style-src \'unsafe-inline\';"></head><body><script>'+code+'</script></body></html>',root);
 const nodes=[];const visit=n=>{nodes.push(n);for(const child of n.childNodes??[])visit(child);};visit(parse(output));
 const scripts=nodes.filter(n=>n.tagName==='script');assert.equal(scripts.length,2);
 const original=scripts[0].childNodes.map(n=>n.value??'').join('');assert.equal(original,code);new Script(original);
 assert.equal(scripts[1].attrs.find(a=>a.name==='src')?.value,'siren://app/assets/shell.js');
});

test('shared stylesheet insertion preserves closing-head literals inside head libraries and CSP hashes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'siren-shell-head-'));
 const code="const headTemplate='<html><head>sample</head><body>example</body></html>';";
 const output=await addDesktopShell('<html><head><meta content="script-src \'sha256-test\'; style-src \'unsafe-inline\';"><script>'+code+'</script></head><body></body></html>',root);
 const nodes=[];const visit=n=>{nodes.push(n);for(const child of n.childNodes??[])visit(child);};visit(parse(output));
 assert.equal(nodes.filter(n=>n.tagName==='script')[0].childNodes.map(n=>n.value??'').join(''),code);
 assert.equal(nodes.filter(n=>n.tagName==='link').length,1);
});
test('corrupt appearance falls back without hiding navigation or overwriting the original record',async()=>{
 const frame={},sender={},grant={role:'docs'};
 const result=await invokeShell({event:{sender,senderFrame:frame},method:'getAppearance',capture:()=>grant,isCurrent:()=>true,store:{read:async()=>({ok:false,code:'INVALID_APPEARANCE'})},context:()=>({projectName:'Owned project'})});
 assert.deepEqual(result,{ok:true,theme:'system',warning:'INVALID_APPEARANCE',projectName:'Owned project'});
});

test('classic appearance bridge synchronizes every original theme route without autosaving a visual preference',async()=>{
 const {patchClassicAppearance}=await import('../build/appearance.mjs');assert.equal(typeof patchClassicAppearance,'function');
 const code='      function applyTheme(themeName, shouldRender) {\n        state.theme = themeName;\n        document.body.dataset.theme = themeName;\n        scheduleSave();\n      }\n      function following() {}';
 let saves=0;const events=[],window={sirenShell:{}},state={theme:'dark'},document={body:{dataset:{theme:'dark'}},dispatchEvent:e=>events.push(e.detail)};
 runInNewContext(patchClassicAppearance(code),{window,state,document,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},scheduleSave:()=>saves++});
 assert.equal(window.sirenClassicAppearance.apply('kpmg'),true);assert.equal(state.theme,'kpmg');assert.equal(document.body.dataset.theme,'kpmg');assert.equal(saves,0);assert.equal(events[0].theme,'kpmg');assert.equal(events[0].user,false);
 assert.equal(window.sirenClassicAppearance.apply('forged'),false);assert.equal(state.theme,'kpmg');
 document.body.dataset.theme='dark';assert.equal(window.sirenClassicAppearance.current(),'dark');
});
test('accepted native appearance survives a later legacy startup theme and user selection can replace the owner',async()=>{
 const {patchClassicAppearance}=await import('../build/appearance.mjs');
 const code='      function applyTheme(themeName, shouldRender) {\n        state.theme = themeName;\n        document.body.dataset.theme = themeName;\n        scheduleSave();\n      }\n      function following() {}';
 const window={sirenShell:{}},state={theme:'light'},document={body:{dataset:{theme:'light'}},dispatchEvent(){}};
 const context={window,state,document,CustomEvent:class{constructor(type,options){this.detail=options.detail;}},scheduleSave:()=>assert.fail('Native visual change must not save a project')};
 runInNewContext(patchClassicAppearance(code),context);
 window.sirenClassicAppearance.apply('dark');context.applyTheme('light',false);
 assert.equal(state.theme,'dark');assert.equal(document.body.dataset.theme,'dark');
 context.applyTheme('kpmg',true,true);assert.equal(state.theme,'kpmg');
 window.sirenClassicAppearance.apply('kpmg');context.applyTheme('light',false);
 assert.equal(state.theme,'kpmg');assert.equal(document.body.dataset.theme,'kpmg');
});

test('failed preference writes preserve finite native diagnostics without exposing paths or changing refusal',async()=>{
 const root=await mkdtemp(join(tmpdir(),'siren-appearance-diagnostic-')),original=new AppearanceStore(root);await original.set({theme:'kpmg'});
 const events=[],store=new AppearanceStore(root,{onDiagnostic:event=>{events.push(event);throw Error('Observer must not change refusal');},fault:async phase=>{if(phase==='before-rename')throw Object.assign(Error('Private path and OS detail must not enter diagnostics'),{code:'EPERM',path:'private-path'});}});
 assert.equal((await store.set({theme:'dark'})).code,'APPEARANCE_WRITE_FAILED');assert.equal((await original.read()).theme,'kpmg');
 assert.deepEqual(events,[{phase:'before-rename',code:'EPERM'}]);assert.equal(JSON.stringify(events).includes('private-path'),false);
});
