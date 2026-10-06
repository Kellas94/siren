import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// Unit tests exercise the adapter boundary with deliberately observable frozen
// dependencies. Actual sanitizer/Mermaid coverage belongs to the native probe.
async function fixture({prepare,validate,stamp}={}){
 let script;try{script=(await import('../build/source-bundle-metadata.mjs')).bundleMetadataHelper;}catch(cause){if(cause.code!=='ERR_MODULE_NOT_FOUND')throw cause;}
 assert.equal(typeof script,'string','Dedicated source-aware metadata helper must exist');
 const calls=[],context=vm.createContext({window:{},TextEncoder,structuredClone,console,PROJECT_TYPE:'t-industries-siren-project',APP_VERSION:'1.131.0',STORAGE_KEY:'t-industries-siren-v23-state',state:{diagrams:[],workpapers:[]},
  validatePortableProjectForImport:async value=>{calls.push(['validate',structuredClone(value)]);if(validate)return validate(value);return value;},
  portableProjectMajorVersion:value=>{const match=String(value.version??value.state?.version??'').match(/^(\d+)/);return match?Number(match[1]):null;},
  validateCodeFiles:value=>{calls.push(['code',structuredClone(value)]);if(value!==undefined&&(!Array.isArray(value)||value.length>80))throw Error('Frozen Code capacity');return value??[];},
  assertPortableProjectWorkpapersFit:value=>{calls.push(['docs-fit',structuredClone(value)]);},
  prepareProjectWorkpapers:docs=>{calls.push(['prepare',structuredClone(docs)]);return prepare?prepare(docs):structuredClone(docs??[]);},
  stampWorkpaperFileSignoff:(doc,door)=>{calls.push(['stamp',structuredClone(doc),structuredClone(door)]);if(stamp)stamp(doc,door);},
  sanitizePresentation:value=>structuredClone(value),sanitizeAgentReleases:value=>structuredClone(value),sanitizeAgentMeta:value=>structuredClone(value),sanitizeGovernanceReview:value=>structuredClone(value),
  sanitizeWorkpaperHtml:value=>value,sanitizeMapCard:value=>structuredClone(value),
 });
 vm.runInContext(script,context);return {context,calls,run:async value=>JSON.parse(await context.window.sirenDesktopValidateBundleMetadata(JSON.stringify(value),'chosen.siren-backup'))};
}
const pointer={sourceId:'source-a',version:1,sha256:'a'.repeat(64)};
const workspace=()=>({diagrams:[{id:'diagram-a',source:'flowchart TD\nA-->B'}],workpapers:[{id:'doc-a',title:'Sparse native',blocks:[],agent:null,releases:[]}],codeFiles:[]});

test('dedicated gate preserves sparse native metadata and unknown opaque data',async()=>{
 const f=await fixture(),input={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify(workspace()),other:'opaque'},opaque:{author:'file claim'}};
 assert.deepEqual(await f.run(input),input);assert.equal(f.calls.filter(v=>v[0]==='validate').length,1);
});
test('only validation projection receives placeholders; pointers and opaque row fields survive',async()=>{
 const f=await fixture(),input=workspace();input.workpapers[0].blocks=[{id:'knowledge-a',kind:'knowledge',rows:[{id:'row-a',name:'Exact.py',sourceRef:pointer,unknown:{agent:'external'}}]}];input.codeFiles=[{id:'file-a',name:'Exact.py',sourceRef:pointer,provenance:{future:true}}];
 const result=await f.run(input);assert.deepEqual(result,input);
 const projected=f.calls.find(v=>v[0]==='validate')[1].state;assert.equal(projected.codeFiles[0].content,'');assert.equal(projected.workpapers[0].blocks[0].rows[0].content,'');assert.equal(JSON.stringify(projected).includes('sourceRef'),false);
 const stamped=f.calls.find(v=>v[0]==='stamp')[1];assert.deepEqual(stamped.blocks[0].rows[0].sourceRef,pointer);assert.equal(Object.hasOwn(stamped.blocks[0].rows[0],'content'),false);
});
test('explicit known loss and array dropping are rejected; original input stays unchanged',async()=>{
 for(const prepare of [docs=>{docs[0].title='cut';return docs;},docs=>{docs[0].blocks=[];return docs;}]){
  const f=await fixture({prepare}),input=workspace();input.workpapers[0].blocks=[{id:'text-a',kind:'text',html:'<p>Original</p>'}];const before=JSON.stringify(input);await assert.rejects(f.run(input));assert.equal(JSON.stringify(input),before);assert.equal(f.calls.some(v=>v[0]==='stamp'),false);
 }
});
test('absent defaults are allowed without replacing original document or review',async()=>{
 const f=await fixture({prepare:docs=>docs.map(doc=>({...doc,status:'draft',review:{state:'draft',trail:[]}})),stamp:(doc,door)=>{doc.signoffFromFile={copied:door.review?.decidedBy??''};}}),input=workspace();
 const result=await f.run(input);assert.equal(Object.hasOwn(result.workpapers[0],'status'),false);assert.equal(Object.hasOwn(result.workpapers[0],'review'),false);assert.deepEqual(result.workpapers[0].signoffFromFile,{copied:''});
});
test('frozen workspace context is candidate-bound and restored after rejection',async()=>{
 const f=await fixture({validate:()=>{throw Error('actual validation refusal');}}),prior=JSON.stringify(f.context.state);await assert.rejects(f.run(workspace()));assert.equal(JSON.stringify(f.context.state),prior);
});
test('inline source collision, malformed pointer and invalid draft cannot cross the gate',async()=>{
 for(const mutate of [v=>v.codeFiles.push({id:'f',name:'x.py',sourceRef:pointer,content:'hidden source'}),v=>v.codeFiles.push({id:'f',name:'x.py',sourceRef:{...pointer,extra:true}}),v=>v.codeWorkspace={drafts:[{id:'draft-a',name:'x.py',sourceRef:pointer,generation:-1}]},v=>v.codeWorkspace={drafts:[{id:'draft-a',name:'x.py',sourceRef:pointer,history:['lost text']}] }]){
  const f=await fixture(),input=workspace();mutate(input);await assert.rejects(f.run(input));assert.equal(f.calls.some(v=>v[0]==='stamp'),false);
 }
});
test('historical linked release/revision sources and private draft pointers are preserved',async()=>{
 const f=await fixture(),input=workspace();input.workpapers[0].type='agent-spec';input.workpapers[0].revisions=[{at:'2026-10-06',author:'File Author',blocks:[{id:'k',kind:'knowledge',rows:[{name:'old.py',sourceRef:pointer,opaque:'revision'}]}]}];input.workpapers[0].releases=[{id:'r',status:'superseded',snapshot:{knowledge:[{name:'released.py',sourceRef:pointer,opaque:'release'}]}}];input.codeWorkspace={drafts:[{id:'draft-a',name:'x.py',language:'python',generation:2,sourceRef:pointer,baseSourceRef:{...pointer,version:2},opaque:{future:true}}]};
 assert.deepEqual(await f.run(input),input);assert.equal(JSON.stringify(f.calls.find(v=>v[0]==='validate')[1]).includes('sourceRef'),false);
});
test('prototype-named opaque keys remain data without changing object prototypes',async()=>{
 const f=await fixture(),input=workspace();input.opaque=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');input.workpapers[0].opaque=input.opaque;
 assert.deepEqual(await f.run(input),input);assert.equal({}.polluted,undefined);
});
test('concurrent invocation is refused while frozen validation awaits, and can retry after completion',async()=>{
 let release,entered;const barrier=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 const f=await fixture({validate:async value=>{entered();await barrier;return value;}}),pending=f.run(workspace());await started;await assert.rejects(f.run(workspace()),/busy/);release();await pending;await f.run(workspace());
});
test('source-aware zero-diagram path keeps Code and Docs gates without inventing a diagram',async()=>{
 const f=await fixture({validate:value=>{if(value.state.diagrams.length===0)throw Error('Legacy empty-diagram refusal');return value;}}),input=workspace();input.diagrams=[];input.codeFiles=[{id:'file-a',name:'Exact.py',sourceRef:pointer}];
 assert.deepEqual(await f.run(input),input);assert.equal(f.calls.some(v=>v[0]==='validate'),false);assert.equal(f.calls.filter(v=>v[0]==='code').length,1);assert.equal(f.calls.filter(v=>v[0]==='docs-fit').length,1);assert.equal(f.calls.find(v=>v[0]==='code')[1][0].content,'');
 for(const mutate of [v=>{v.version='999.0.0';},v=>{v.activeDiagramId='missing';},v=>{v.codeFiles=Array.from({length:81},(_,i)=>({id:'f'+i,name:'x.py',sourceRef:pointer}));}]){const changed=structuredClone(input);mutate(changed);await assert.rejects(f.run(changed));}
});
