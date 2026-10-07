import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceContext} from '../src/windows/source-context.mjs';
const a={sourceId:'source-a',version:1,sha256:'a'.repeat(64)},v2={...a,version:2,sha256:'b'.repeat(64)},b={sourceId:'source-b',version:1,sha256:a.sha256};
const snapshot=(workspace,refs=[a,v2,b])=>({schema:2,sourceRefs:refs,json:JSON.stringify(workspace)});
test('source context distinguishes exact, earlier and same-name/hash foreign associations without private bodies',()=>{
 const context=createSourceContext(snapshot({codeFiles:[{id:'a',name:'same.py',language:'python',sourceRef:v2},{id:'b',name:'same.py',language:'text',sourceRef:b}],workpapers:[{id:'doc-old',title:'Old design',agent:{agentId:'AG-1',agentVersion:'1'},private:'SECRET_BODY',blocks:[{kind:'knowledge',rows:[{sourceRef:a},{sourceRef:a}]}]},{id:'doc-foreign',title:'Other',blocks:[{kind:'knowledge',rows:[{sourceRef:b}]}]}]}));
 const current=context.describe(v2);assert.equal(current.displayName,'same.py');assert.equal(current.language,'python');assert.equal(current.linkState,'earlier');assert.equal(current.exactCount,0);assert.equal(current.earlierCount,1);assert.equal(current.earlierLinks[0].title,'Old design');assert.equal(current.earlierLinks[0].version,1);assert.equal(current.earlierLinks[0].agentId,'AG-1');
 assert.equal(context.describe(a).linkState,'linked');assert.equal(context.describe(b).language,'text');assert.equal(context.describe({...v2,sha256:'c'.repeat(64)}),null);assert.equal(JSON.stringify(current).includes('SECRET_BODY'),false);
});
test('metadata requires admitted references and safe own names; unknown language never becomes Python from source contents',()=>{
 const ref={...a,provenance:{kind:'standalone',fileId:'file-a',fileName:'original.py'}};
 const context=createSourceContext(snapshot({codeFiles:[{id:'file-a',name:'C:/PRIVATE.py',language:'python',sourceRef:b}],workpapers:[]},[ref,b]));
 assert.equal(context.describe(ref).displayName,'original.py');assert.equal(context.describe(ref).language,'unknown');
 let ran=false;const getter=Object.defineProperty({...a},'provenance',{get(){ran=true;throw Error('getter');}});assert.equal(createSourceContext(snapshot({},[getter])).describe(a).language,'unknown');assert.equal(ran,false);
});
test('relationship previews and scans are finite and disclose incompleteness instead of claiming unlinked',()=>{
 const papers=Array.from({length:20},(_,i)=>({id:'doc-'+i,title:'Document '+i,blocks:[{kind:'knowledge',rows:[{sourceRef:v2}]}]}));
 const current=createSourceContext(snapshot({workpapers:papers})).describe(v2);assert.equal(current.exactCount,20);assert.equal(current.exactLinks.length,8);assert.equal(current.linksTruncated,true);assert.equal(current.linkState,'linked');
 const rows=Array.from({length:16385},()=>({sourceRef:b}));const limited=createSourceContext(snapshot({workpapers:[{id:'many',blocks:[{kind:'knowledge',rows}]}]})).describe(v2);assert.equal(limited.linkState,'unknown');assert.equal(limited.linksTruncated,true);
});
test('exact Docs Python claims work without standalone files; conflicting claims stay unknown',()=>{
 const paper={id:'doc-a',blocks:[{kind:'knowledge',rows:[{sourceRef:a,fileType:'python',fileName:'agent.py'}]}]};
 assert.equal(createSourceContext(snapshot({workpapers:[paper]})).describe(a).language,'python');
 assert.equal(createSourceContext(snapshot({workpapers:[paper],codeFiles:[{name:'agent.txt',sourceRef:a,language:'text'}]})).describe(a).language,'unknown');
 assert.equal(createSourceContext(snapshot({workpapers:[paper]})).describe(v2).language,'unknown');
});
test('exact file language outranks a stale fileId name and duplicate Doc rows still contribute conflicts',()=>{
 const selected={...a,provenance:{kind:'standalone',fileId:'same-id',fileName:'old.py'}};
 const workspace={codeFiles:[{id:'same-id',name:'stale.txt',language:'text',sourceRef:b},{id:'actual',name:'exact.py',language:'python',sourceRef:a}],workpapers:[]};
 let value=createSourceContext(snapshot(workspace,[selected,b])).describe(a);assert.equal(value.displayName,'exact.py');assert.equal(value.language,'python');
 workspace.workpapers=[{id:'doc-a',blocks:[{kind:'knowledge',rows:[{sourceRef:a,fileType:'python'},{sourceRef:a,fileType:'text'}]}]}];value=createSourceContext(snapshot(workspace,[selected,b])).describe(a);assert.equal(value.language,'unknown');assert.equal(value.exactCount,1);
 workspace.codeFiles=Array.from({length:4097},()=>({name:'x.py',language:'python',sourceRef:a}));assert.equal(createSourceContext(snapshot(workspace,[selected,b])).describe(a).language,'unknown');
});
test('relationship filters inspect admitted associations beyond the eight preview captions',()=>{
 const workpapers=Array.from({length:12},(_,i)=>({id:'doc-'+i,title:'Document '+i,agent:{agentId:'AG-'+i},blocks:[{kind:'knowledge',rows:[{sourceRef:a}]}]})),context=createSourceContext(snapshot({workpapers}));
 assert.equal(context.describe(a).exactLinks.length,8);assert.equal(context.matches(a,{document:'Document 11',agent:'AG-11'}),true);assert.equal(context.matches(b,{agent:'AG-11'}),false);
});
test('native Docs txt classification and unsafe descriptive filenames cannot conceal an explicit text conflict',()=>{
 const papers=[{id:'doc-txt',blocks:[{kind:'knowledge',rows:[{sourceRef:a,fileType:'txt',name:'plain.txt'}]}]}];
 assert.equal(createSourceContext(snapshot({workpapers:papers})).describe(a).language,'text');
 assert.equal(createSourceContext(snapshot({workpapers:papers,codeFiles:[{sourceRef:a,name:'python.py',language:'python'}]})).describe(a).language,'unknown');
 const context=createSourceContext(snapshot({codeFiles:[{sourceRef:a,name:'python.py',language:'python'},{sourceRef:a,name:'folder/plain.txt',language:'text'}]})).describe(a);assert.equal(context.language,'unknown');assert.equal(context.displayName,'python.py');assert.equal(JSON.stringify(context).includes('folder/'),false);
});
