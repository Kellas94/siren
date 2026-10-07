import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const modelUrl=new URL('../src/documents/document-activity.mjs',import.meta.url);
async function contract(){let module;try{module=await import(modelUrl);}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}assert.equal(typeof module?.createDocumentActivityContract,'function','Docs Activity finite contract is missing');return module.createDocumentActivityContract();}
const block=(id,extra={})=>({id,kind:'text',text:'same',...extra});
test('comments preserve original positions and require actual boolean resolution',async()=>{
 const m=await contract(),doc={comments:[{id:'duplicate',resolved:false,text:'a'},{id:'duplicate',resolved:true,text:'b'},{resolved:'false'},null,{text:'unknown'}]},before=JSON.stringify(doc);
 const all=m.page(doc,{section:'comments'});assert.equal(all.total,5);assert.deepEqual(all.rows.map(r=>[r.position,r.state]),[[0,'open'],[1,'resolved'],[2,'unsupported'],[3,'unsupported'],[4,'unsupported']]);
 assert.deepEqual(m.page(doc,{section:'comments',filter:'open'}).rows.map(r=>r.position),[0]);assert.deepEqual(m.page(doc,{section:'comments',filter:'resolved'}).rows.map(r=>r.position),[1]);assert.equal(JSON.stringify(doc),before);
});
test('pagination scans a finite source range without claiming a filtered total',async()=>{
 const m=await contract(),doc={comments:Array.from({length:600},(_,i)=>({resolved:i===550,text:String(i)}))};let p=m.page(doc,{section:'comments',filter:'resolved',limit:20});assert.equal(p.total,600);assert.equal(p.scanned,256);assert.equal(p.nextCursor,256);assert.equal(p.limited,true);assert.equal(p.rows.length,0);
 p=m.page(doc,{section:'comments',filter:'resolved',cursor:512,limit:20});assert.equal(p.rows[0].position,550);assert.equal(p.nextCursor,null);
 const first=m.page({comments:[{resolved:false},{resolved:false},{resolved:false}]},{section:'comments',limit:2});assert.equal(first.nextCursor,2);
});
test('all page output budgets are finite and inert with explicit scalar excerpts',async()=>{
 const m=await contract(),text='<img src=x onerror=alert(1)> javascript:attack() ',row={resolved:false,text:text.repeat(800),author:'x'.repeat(20000),kind:'x'.repeat(20000),at:'x'.repeat(20000),blockId:'x'.repeat(20000)};
 const p=m.page({comments:Array(20).fill(row)},{section:'comments'});assert.equal(p.ok,true);assert.ok(p.rows.length>0&&p.rows.length<20);assert.equal(p.limited,true);assert.ok(p.nextCursor>0);assert.ok(p.rows[0].fields.some(f=>f.text.startsWith('<img')&&f.truncated));
 for(const r of p.rows){assert.ok(r.fields.reduce((n,f)=>n+f.text.length,0)<=m.limits.rowChars);assert.ok(r.fields.every(f=>f.text.length<=m.limits.scalarChars));assert.equal(r.blockId,undefined);}assert.ok(p.rows.reduce((n,r)=>n+r.fields.reduce((s,f)=>s+f.text.length,0),0)<=m.limits.pageChars);
});
test('unsupported entry notices count toward the exact aggregate page budget',async()=>{
 const m=await contract(),row={text:'x'.repeat(4096),author:'x'.repeat(4096),kind:'x'.repeat(4096),at:'x'.repeat(4096)},p=m.page({comments:[...Array(8).fill(row),...Array(12).fill(null)]},{section:'comments'});
 assert.ok(p.rows.reduce((n,r)=>n+r.fields.reduce((s,f)=>s+f.text.length,0),0)<=m.limits.pageChars);assert.equal(p.nextCursor,8);assert.equal(p.limited,true);
});
test('malformed record containers and invalid options refuse rather than invent data',async()=>{
 const m=await contract();for(const doc of [{comments:{}},{comments:null}])assert.equal(m.page(doc,{section:'comments'}).ok,false);
 for(const options of [{section:'bad'},{section:'comments',cursor:-1},{section:'comments',limit:21},{section:'comments',filter:'yes'}])assert.equal(m.page({},options).ok,false);
 assert.deepEqual(m.page({}, {section:'comments'}).rows,[]);
});
test('revision rows retain exact positions and disclose complete comparison availability',async()=>{
 const m=await contract(),p=m.page({revisions:[{id:'same',at:'not-a-date',by:'A',blocks:[block('x')]},{id:'same',blocks:'bad'},null]},{section:'revisions'});
 assert.deepEqual(p.rows.map(r=>[r.position,r.canCompare,r.blockCount]),[[0,true,1],[1,false,undefined],[2,false,undefined]]);assert.ok(p.rows[0].fields.some(f=>f.text==='not-a-date'));
});
test('recorded review combines top-level file provenance, trail and releases without merging',async()=>{
 const m=await contract(),doc={status:'approved',review:{state:'approved',decidedBy:'claimed reviewer',trail:[{at:'y',by:'x',action:'approved'}]},signoffFromFile:{state:'approved',decidedBy:'imported name'},releases:[{version:'1',approvedBy:'claim',fingerprint:'fake'}]},before=JSON.stringify(doc);
 const p=m.page(doc,{section:'review'});assert.deepEqual(p.rows.map(r=>r.kind),['review','trail','release']);assert.deepEqual(p.rows.map(r=>r.position),[0,1,2]);assert.ok(p.rows[0].fields.some(f=>f.key==='signoffFromFile.decidedBy'&&f.text==='imported name'));assert.equal(JSON.stringify(doc),before);
 assert.equal(m.page(doc,{section:'review',cursor:2,limit:1}).rows[0].kind,'release');
});
test('frozen review and release field names expose recorded details and fingerprints',async()=>{
 const m=await contract(),doc={review:{note:'Review note',trail:[{who:'Reviewer claim',detail:'Decision detail'}]},signoffFromFile:{digestHeld:true,trailRows:3,trailLast:{who:'Imported claim',detail:'Imported detail'}},releases:[{seq:2,testingRef:'Evidence reference',fingerprint:{package:'package-hash',prompt:'prompt-hash',knowledge:'knowledge-hash',canon:'canon-version'}}]},p=m.page(doc,{section:'review'}),values=p.rows.flatMap(r=>r.fields).map(f=>f.text);
 for(const text of ['Review note','Reviewer claim','Decision detail','true','3','Imported claim','Imported detail','2','Evidence reference','package-hash','prompt-hash','knowledge-hash','canon-version'])assert.ok(values.includes(text),'Missing recorded value '+text);
});
test('projection never invokes imported getters or coercion',async()=>{
 const m=await contract();let invoked=0;const row={resolved:false};Object.defineProperty(row,'text',{enumerable:true,get(){invoked++;throw Error('getter');}});const doc={comments:[row]};const p=m.page(doc,{section:'comments'});assert.equal(p.ok,true);assert.ok(p.rows[0].fields.some(f=>f.key==='text'&&f.text.includes('Unsupported')));assert.equal(invoked,0);
 const hostile={toString(){invoked++;return'fake';}};assert.equal(m.page({comments:[{text:hostile}]},{section:'comments'}).ok,true);assert.equal(invoked,0);
});
test('comparison is exact over formatting, opaque fields, images and source pointer values',async()=>{
 const m=await contract(),a=[block('x',{format:{bold:true},opaque:{x:1},sourceRef:{version:1},image:{data:'data:old'}})];
 for(const change of [{format:{bold:false}},{opaque:{x:2}},{sourceRef:{version:2}},{image:{data:'data:new'}}]){const b=[{...a[0],...change}],before=JSON.stringify([a,b]);const p=m.compare(a,b);assert.equal(p.ok,true);assert.equal(p.identical,false);assert.equal(p.rows[0].change,'changed');assert.equal(JSON.stringify([a,b]),before);}
});
test('canonical key order is equal and reorder remains a real difference',async()=>{
 const m=await contract(),a=[{id:'x',text:'same',kind:'text'},block('y')],b=[block('y'),block('x')];assert.equal(m.compare([a[0]],[block('x')]).identical,true);
 const p=m.compare(a,b);assert.equal(p.identical,false);assert.equal(p.counts.reordered,2);assert.ok(p.rows.every(r=>r.change==='unchanged'&&r.reordered));
});
test('added removed and malicious valid identifiers retain exact identity',async()=>{
 const m=await contract(),a=[block('__proto__'),block('x]" <script> 😀')],b=[block('__proto__'),block('constructor')],p=m.compare(a,b);
 assert.equal(p.ok,true);assert.deepEqual(p.rows.map(r=>[r.id,r.change]),[['__proto__','unchanged'],['x]" <script> 😀','removed'],['constructor','added']]);assert.equal(p.counts.added,1);assert.equal(p.counts.removed,1);
});
test('invalid duplicate Unicode and absent identities never yield partial equality',async()=>{
 const m=await contract();for(const a of [[block('x'),block('x')],[block('')],[block('\ud800')],[block('x'.repeat(201))],[{kind:'text'}]]){const p=m.compare(a,a);assert.equal(p.ok,false);assert.equal(p.identical,undefined);}
});
test('complete comparison refuses oversized blocks, bytes, nodes and depth',async()=>{
 const m=await contract(),many=Array.from({length:257},(_,i)=>block(String(i)));for(const a of [many,[block('x',{text:'😀'.repeat(140000)})],[block('x',{many:Array(33000).fill(0)})]]){assert.equal(m.compare(a,a).ok,false);}
 let nested={};for(let i=0;i<34;i++)nested={nested};assert.equal(m.compare([block('x',{nested})],[block('x')]).ok,false);
});
test('complete comparison refuses accessors, cycles, non JSON values and container anomalies',async()=>{
 const m=await contract();let invoked=0;const getter=block('x');Object.defineProperty(getter,'text',{enumerable:true,get(){invoked++;return'fake';}});const cyclic=block('x');cyclic.self=cyclic;const sparse=[block('x')];sparse.length=2;const decorated=[block('x')];decorated.other=1;
 for(const a of [[getter],[cyclic],[block('x',{x:NaN})],[block('x',{x:Infinity})],[block('x',{x:undefined})],[block('x',{x:()=>1})],[block('x',{x:new Date()})],sparse,decorated,[block('x',{[Symbol('x')]:1})]]){assert.equal(m.compare(a,a).ok,false);}
 assert.equal(invoked,0);
});
test('locate proves uniqueness within the whole finite range and never normalizes IDs',async()=>{
 const m=await contract(),a=Array.from({length:90},(_,i)=>block(String(i)));a[83].id='x]"😀';assert.deepEqual(m.locate(a,'x]"😀'),{ok:true,index:83});assert.equal(m.locate(a,'absent').code,'BLOCK_MISSING');a[85].id=a[83].id;assert.equal(m.locate(a,a[83].id).code,'BLOCK_AMBIGUOUS');assert.equal(m.locate(a,'').code,'BLOCK_ID_INVALID');
 assert.equal(m.locate(Array.from({length:4097},(_,i)=>block(String(i))),'0').code,'BLOCK_LOOKUP_LIMIT');
});
test('browser injection uses the same finite model without runtime imports',async()=>{
 const m=await contract();let build;try{build=await import('../build/document-activity.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}assert.equal(typeof build?.buildDocumentActivity,'function');const window={};runInNewContext(build.buildDocumentActivity(),{window,TextEncoder});
 const doc={comments:[{resolved:false,text:'literal <b>'}]};assert.equal(JSON.stringify(window.SirenDocumentActivity.page(doc,{section:'comments'})),JSON.stringify(m.page(doc,{section:'comments'})));assert.ok(Object.isFrozen(window.SirenDocumentActivity));assert.ok(Object.isFrozen(m.limits));
});
