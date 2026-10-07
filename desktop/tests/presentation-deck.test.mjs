import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp} from './fixtures/temporary.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ProjectStore} from '../src/projects/store.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
const module=await import('../src/windows/presentation-deck.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-presentation-deck-')),projects=new ProjectStore(root);
 const diagram={id:'diagram-a',name:'Exact deck',source:'flowchart TD\nA[Public label]-->B',nodeStyles:{A:{fill:'#ff3366'}},nodeMetadata:{A:{privateAgent:'PRIVATE_AGENT'}},presentation:{sequence:[{id:'step-a',type:'node',nodeId:'A'},{id:'section-b',type:'section',title:'Context'}],notes:{'node:A':{text:'PRIVATE_NOTES_A',owner:'Actual owner'},'section:section-b':{text:'PRIVATE_NOTES_B'}}}};
 const metadata={diagrams:[diagram],workpapers:[{id:'doc-a',title:'PRIVATE_DOCUMENT'}],unrelated:'PRIVATE_UNRELATED'},snapshot=await projects.createProject({label:'Private project',json:JSON.stringify(metadata)});let current=snapshot;
 const windows=[],registry=new WindowRegistry({authorize:request=>({projectId:snapshot.project.id,mode:'normal',access:request.role==='audience'?'presentation':'read',entityIds:['diagram-a','doc-a']}),createWindow:async options=>{
  const w=new EventEmitter();w.id=windows.length+1;w.isDestroyed=()=>Boolean(w.destroyed);w.isMinimized=()=>false;w.restore=()=>{};w.focus=()=>{};w.destroy=()=>{w.destroyed=true;w.webContents.emit('destroyed');w.emit('closed');};w.close=w.destroy;w.webContents=new EventEmitter();Object.assign(w.webContents,{id:w.id+100,mainFrame:{url:options.mainFrameUrl},getURL:()=>options.mainFrameUrl,isDestroyed:w.isDestroyed});windows.push(w);return w;
 }});
 for(const role of ['presenter','audience','docs'])await registry.openView({role,entityId:role==='docs'?'doc-a':'diagram-a'});
 const grants=windows.map(w=>registry.capture({sender:w.webContents,senderFrame:w.webContents.mainFrame}));assert.equal(typeof module.NativePresentationDecks,'function');
 const decks=new module.NativePresentationDecks({registry,snapshotFor:async()=>current});
 return {root,projects,snapshot,diagram,metadata,registry,windows,grants,decks,setSnapshot:value=>current=value};
}

test('public render context carries only a finite saved layout preference and never opaque layout payloads',async()=>{
 for(const value of ['auto','dagre','elk',{private:'PRIVATE_LAYOUT'},'future',null]){
  const f=await fixture(),diagram={...f.diagram,sirenNativeLayoutEngine:value};assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'})).ok,true);const saved=await f.projects.readProject(f.snapshot.project.id);f.setSnapshot(saved);
  const deck=await f.decks.read(f.grants[0],{isCurrent:()=>true});assert.equal(Object.hasOwn(deck.render,'sirenNativeLayoutEngine'),typeof value==='string'&&['auto','dagre','elk'].includes(value));if(['auto','dagre','elk'].includes(value))assert.equal(deck.render.sirenNativeLayoutEngine,value);assert.equal(JSON.stringify(deck.render).includes('PRIVATE_'),false);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),saved);
 }
});
test('native deck reads the exact selected diagram and genuine notes while excluding other project/private node metadata',async()=>{
 const f=await fixture(),deck=await f.decks.read(f.grants[0],{isCurrent:()=>true});assert.equal(deck.projectId,f.snapshot.project.id);assert.equal(deck.deckId,'diagram-a');assert.equal(deck.version,createHash('sha256').update(JSON.stringify(f.diagram)).digest('hex'));
 assert.deepEqual(deck.slides.map(s=>[s.id,s.title,s.notes]),[['step-a','A','PRIVATE_NOTES_A'],['section-b','Context','PRIVATE_NOTES_B']]);assert.equal(deck.render.source,f.diagram.source);assert.deepEqual(deck.render.nodeStyles,f.diagram.nodeStyles);assert.equal('source' in deck.slides[0].render,false);
 for(const forbidden of ['PRIVATE_AGENT','PRIVATE_DOCUMENT','PRIVATE_UNRELATED','Actual owner'])assert.equal(JSON.stringify(deck).includes(forbidden),false,forbidden);
 assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);assert.deepEqual(f.registry.presentationScope(f.grants[1]),{deckId:'diagram-a'});assert.deepEqual(f.grants[1].entityIds,[]);assert.equal(f.registry.presentationScope({...f.grants[1]}),null);
});
test('Audience/Docs/copied and revoked frames cannot load a deck or inherit source authority',async()=>{
 const f=await fixture();for(const grant of [f.grants[1],f.grants[2],{...f.grants[0]}])await assert.rejects(f.decks.read(grant,{isCurrent:()=>true}),{code:'ACCESS_REFUSED'});
 await assert.rejects(f.decks.read(f.grants[0],{isCurrent:()=>false}),{code:'ACCESS_REFUSED'});f.windows[0].webContents.mainFrame={url:f.windows[0].webContents.mainFrame.url};await assert.rejects(f.decks.read(f.grants[0],{isCurrent:()=>true}),{code:'ACCESS_REFUSED'});
});
test('exact readback refusal detects corrupted snapshots and a selection change during load',async()=>{
 const f=await fixture();f.setSnapshot({...f.snapshot,json:f.snapshot.json+' '});await assert.rejects(f.decks.read(f.grants[0],{isCurrent:()=>true}),{code:'PRESENTATION_DECK_REFUSED'});
 let calls=0;const decks=new module.NativePresentationDecks({registry:f.registry,snapshotFor:async()=>{if(++calls===1)return f.snapshot;assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,unrelated:'changed'}),purpose:'workspace'})).ok,true);return f.projects.readProject(f.snapshot.project.id);}});
 await assert.rejects(decks.read(f.grants[0],{isCurrent:()=>true}),{code:'PRESENTATION_DECK_CHANGED'});
});
test('empty authored sequence produces a deterministic overview without changing the stored diagram',async()=>{
 const f=await fixture(),diagram={...f.diagram,presentation:{sequence:[],notes:{overview:{text:'PRIVATE_OVERVIEW'}}}};
 const selected=await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'});assert.equal(selected.ok,true);const snapshot=await f.projects.readProject(f.snapshot.project.id);f.setSnapshot(snapshot);
 const deck=await f.decks.read(f.grants[0],{isCurrent:()=>true});assert.equal(deck.slides.length,1);assert.deepEqual(deck.slides[0].render.entry,{id:'overview',type:'overview',title:'Exact deck'});assert.equal(deck.slides[0].notes,'PRIVATE_OVERVIEW');assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),snapshot);
});
test('unsupported/malformed or duplicate authored slides and oversized notes are refused without replacement',async()=>{
 for(const sequence of [[{id:'x',type:'unknown'}],[{id:'x',type:'node'}],[{id:'x',type:'section'},{id:'x',type:'overview'}],null]){
  const f=await fixture(),diagram={...f.diagram,presentation:sequence===null?{...f.diagram.presentation,notes:{'node:A':{text:'x'.repeat(65537)}}}:{...f.diagram.presentation,sequence}};assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'})).ok,true);const saved=await f.projects.readProject(f.snapshot.project.id);f.setSnapshot(saved);
  await assert.rejects(f.decks.read(f.grants[0],{isCurrent:()=>true}),{code:'PRESENTATION_DECK_REFUSED'});assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),saved);
 }
});
test('native deck projects the actual title visibility/font/style flags without copying private metadata',async()=>{
 const f=await fixture(),diagram={...f.diagram,diagramTitleTouched:true,diagramTitle:'Visible title',fontFamily:'Georgia',fontSize:20,fontWeight:600,nodeStyles:{A:{fill:'#ff3366'},B:{fill:'#12ab34'}}};
 assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'})).ok,true);const snapshot=await f.projects.readProject(f.snapshot.project.id);f.setSnapshot(snapshot);const deck=await f.decks.read(f.grants[0],{isCurrent:()=>true});
 assert.equal(deck.render.diagramTitleTouched,true);assert.equal(deck.render.diagramTitle,'Visible title');assert.equal(deck.render.fontFamily,'Georgia');assert.equal(deck.render.fontSize,20);assert.deepEqual(deck.render.nodeStyles,diagram.nodeStyles);assert.equal(JSON.stringify(deck.render).includes('PRIVATE_'),false);assert.deepEqual(await f.projects.readProject(snapshot.project.id),snapshot);
});
test('saved Title/Text cards expose only finite public fields and prefer authored HTML over stale body',async()=>{
 const f=await fixture(),card={id:'card-public',kind:'text',title:'Public card',eyebrow:'Context',html:'<p>Public paragraph</p>',body:'PRIVATE_STALE_BODY',textScale:1.2,align:'left',notes:'PRIVATE_CARD_NOTES',assetId:'PRIVATE_ASSET',agent:'PRIVATE_CARD_AGENT'},diagram={...f.diagram,presentation:{sequence:[{id:'card-step',type:'card',card}],notes:{'card:card-step':{text:'PRIVATE_PRESENTER_NOTES'}}}};
 assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'})).ok,true);const snapshot=await f.projects.readProject(f.snapshot.project.id);f.setSnapshot(snapshot);const deck=await f.decks.read(f.grants[0],{isCurrent:()=>true});
 assert.equal(deck.slides[0].title,'Public card');assert.equal(deck.slides[0].notes,'PRIVATE_PRESENTER_NOTES');const projected=deck.slides[0].render.entry.card;assert.deepEqual(projected,{kind:'text',title:'Public card',eyebrow:'Context',html:'<p>Public paragraph</p>',textScale:1.2,align:'left'});assert.equal(JSON.stringify(deck.slides[0].render).includes('PRIVATE_'),false);assert.deepEqual(await f.projects.readProject(snapshot.project.id),snapshot);
});
test('unsupported card kinds retain their public label without projecting private live-content or asset authority',async()=>{
 const f=await fixture(),diagram={...f.diagram,presentation:{sequence:[{id:'unsupported-card',type:'card',card:{kind:'image',title:'Public image label',assetId:'PRIVATE_ASSET',docId:'PRIVATE_DOC',notes:'PRIVATE_NOTES',html:'PRIVATE_HTML',body:'PRIVATE_BODY'}}]}};
 assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'})).ok,true);const saved=await f.projects.readProject(f.snapshot.project.id);f.setSnapshot(saved);const deck=await f.decks.read(f.grants[0],{isCurrent:()=>true});assert.equal(deck.slides[0].title,'Public image label');assert.deepEqual(deck.slides[0].render.entry.card,{kind:'image',title:'Public image label'});assert.equal(JSON.stringify(deck.slides[0].render).includes('PRIVATE_'),false);assert.deepEqual(await f.projects.readProject(saved.project.id),saved);
});
test('malformed public text-card fields are refused without changing actual saved content',async()=>{
 for(const card of [{kind:'text',title:'x'.repeat(257)},{kind:'text',html:'x'.repeat(32769)},{kind:'text',body:'x'.repeat(8001)},{kind:'text',textScale:999},{kind:'text',align:'outside'}]){const f=await fixture(),diagram={...f.diagram,presentation:{sequence:[{id:'bad-card',type:'card',card}]}};assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'})).ok,true);const saved=await f.projects.readProject(f.snapshot.project.id);f.setSnapshot(saved);await assert.rejects(f.decks.read(f.grants[0],{isCurrent:()=>true}),{code:'PRESENTATION_DECK_REFUSED'});assert.deepEqual(await f.projects.readProject(saved.project.id),saved);}
});

test('saved tables project exact public cells without private asset, notes or future fields',async()=>{
 const f=await fixture(),card={kind:'table',title:'Public table',rows:[['Name','Value'],['Ș <script>','2']],headerRow:true,assetId:'PRIVATE_ASSET',future:'PRIVATE_FIELD'},diagram={...f.diagram,presentation:{sequence:[{id:'table-step',type:'card',card}],notes:{'card:table-step':{text:'PRIVATE_TABLE_NOTE'}}}};
 assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'})).ok,true);f.setSnapshot(await f.projects.readProject(f.snapshot.project.id));const deck=await f.decks.read(f.grants[0],{isCurrent:()=>true});assert.deepEqual(deck.slides[0].render.entry.card,{kind:'table',title:'Public table',rows:card.rows,headerRow:true});assert.equal(JSON.stringify(deck.slides[0].render).includes('PRIVATE_'),false);assert.equal(deck.slides[0].notes,'PRIVATE_TABLE_NOTE');
});

test('table public projection retains reveal refusal rather than silently exposing an authored reveal table',async()=>{const f=await fixture(),diagram={...f.diagram,presentation:{sequence:[{id:'table-reveal',type:'card',card:{kind:'table',title:'Reveal table',rows:[['Hidden until reveal']],headerRow:false,reveal:true}}]}};assert.equal((await f.projects.saveProject({projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,json:JSON.stringify({...f.metadata,diagrams:[diagram]}),purpose:'workspace'})).ok,true);f.setSnapshot(await f.projects.readProject(f.snapshot.project.id));const deck=await f.decks.read(f.grants[0],{isCurrent:()=>true});assert.equal(deck.slides[0].render.entry.card.reveal,true);});
