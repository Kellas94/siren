import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {atomicWrite} from '../src/projects/atomic.mjs';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8'),start=main.indexOf('const selected = async'),end=main.indexOf('const changeSelection =',start);
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-bundle-selection-')),path=join(root,'session-selection.json'),old=Buffer.from('{"schema":1,"projectId":"old-project","accountId":null}');await writeFile(path,old);
 let current=true;const next={schema:2,project:{id:'new-project'},json:'{}',revision:2};
 const context=vm.createContext({dataRoot:root,join,Buffer,atomicWrite,writes:new Set(),selectedId:'old-project',grants:new Set(),snapshot:{project:{id:'old-project'}},account:{accountId:null,policy:{opened(){}}},nativeReadonly:false,mode:'normal',reason:null,bootstrap:{selectionGeneration:3}});
 vm.runInContext(main.slice(start,end)+';globalThis.select=selected;',context);
 return {context,next,path,old,revoke:()=>{current=false;},current:()=>current};
}
test('selection refuses revocation immediately before pointer publication and retains original bytes',async()=>{
 const f=await fixture();f.context.atomicWrite=(path,bytes,options)=>atomicWrite(path,bytes,{...options,fault:async phase=>{if(phase==='before-rename')f.revoke();await options?.fault?.(phase);}});
 await assert.rejects(f.context.select(f.next,{isCurrent:f.current}),{code:'ACCESS_REFUSED'});assert.deepEqual(await readFile(f.path),f.old);assert.equal(f.context.selectedId,'old-project');assert.equal(f.context.writes.size,0);
});
test('already renamed selection finishes readback and state handoff while tracked in the Lock drain',async()=>{
 const f=await fixture();f.context.atomicWrite=(path,bytes,options)=>atomicWrite(path,bytes,{...options,fault:async phase=>{if(phase==='after-rename'){assert.equal(f.context.writes.size,1);f.revoke();}await options?.fault?.(phase);}});
 await f.context.select(f.next,{isCurrent:f.current});assert.equal(JSON.parse(await readFile(f.path)).projectId,'new-project');assert.equal(f.context.selectedId,'new-project');assert.equal(f.context.snapshot,f.next);assert.equal(f.context.writes.size,0);
});
test('post-rename failure reports uncertain selection in readonly recovery instead of claiming rollback',async()=>{
 const f=await fixture();f.context.atomicWrite=(path,bytes,options)=>atomicWrite(path,bytes,{...options,fault:async phase=>{await options?.fault?.(phase);if(phase==='after-rename')throw Error('Real readback interrupted');}});
 await assert.rejects(f.context.select(f.next,{isCurrent:f.current}),{code:'SELECTION_UNCONFIRMED'});assert.equal(JSON.parse(await readFile(f.path)).projectId,'new-project');assert.equal(f.context.selectedId,'new-project');assert.equal(f.context.snapshot,null);assert.equal(f.context.nativeReadonly,true);assert.equal(f.context.bootstrap.readonly,true);assert.equal(f.context.mode,'recovery');assert.equal(f.context.bootstrap.selectionGeneration,4);
});
