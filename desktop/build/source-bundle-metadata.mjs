// Installed inside the hash-pinned frozen validator's lexical scope. Native
// preflight owns manifest/reference/byte verification; this gate owns metadata
// semantics. It never returns the detached placeholder/sanitizer projection.
function installBundleMetadata(){
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const clone=value=>JSON.parse(JSON.stringify(value));
 const refuse=path=>{throw Error('Source bundle metadata refused: '+path);};
 const put=(target,key,value)=>Object.defineProperty(target,key,{value,enumerable:true,writable:true,configurable:true});
 const words=value=>value.split(' ').filter(Boolean);
 function pick(value,keys,children={}){
  if(!object(value))refuse('record');const result={};
  for(const key of words(keys))if(own(value,key))put(result,key,children[key]?children[key](value[key]):clone(value[key]));
  return result;
 }
 const list=fn=>value=>{if(!Array.isArray(value))refuse('list');return value.map(fn);};
 // Unknown keys are intentionally excluded only from the validation projection.
 // Explicit known fields must survive; added defaults for absent fields may vary.
 function unchanged(before,after,path='metadata'){
  if(Array.isArray(before)){
   if(!Array.isArray(after)||before.length!==after.length)refuse(path+' array');
   before.forEach((value,index)=>unchanged(value,after[index],path+'['+index+']'));return;
  }
  if(object(before)){
   if(!object(after))refuse(path+' record');
   for(const key of Object.keys(before)){if(!own(after,key))refuse(path+'.'+key);unchanged(before[key],after[key],path+'.'+key);}return;
  }
  if(before!==after)refuse(path);
 }
 const pointer=value=>{
  if(!object(value)||Object.keys(value).length!==3||!words('sourceId version sha256').every(key=>own(value,key))||typeof value.sourceId!=='string'||!value.sourceId||!Number.isSafeInteger(value.version)||value.version<1||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256))refuse('source pointer');
 };
 const entity=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
 function identities(values,path,required=true){
  if(values===undefined)return;if(!Array.isArray(values))refuse(path);const seen=new Set();
  for(const value of values){if(!object(value))refuse(path);if(own(value,'id')||required){if(!entity(value.id)||seen.has(value.id))refuse(path+' identity');seen.add(value.id);}}
 }
 const review=value=>pick(value,'state submittedBy submittedAt decidedBy decidedAt note approvedDigest trail',{trail:list(value=>pick(value,'at who action detail'))});
 const agent=value=>pick(value,'schema agentId agentVersion platform environment incompleteFields oversight data',{
  oversight:value=>pick(value,'mode how exceptions'),data:value=>pick(value,'types confidential personal sensitive restrictions')
 });
 function linked(value,field){
  if(own(value,'sourceRef')){pointer(value.sourceRef);if(own(value,field))refuse('inline '+field);return true;}
  if(own(value,field))refuse('inline '+field);return false;
 }
 function knowledge(value,release=false){
  const result=pick(value,release?'name role fileType sourceOrigin confirmedAt reasoningEffort sha256':'name source fileType role notes sourceOrigin confirmedAt sourceId');
  linked(value,'content');put(result,'content','');return result;
 }
 const blockFields={heading:'level text',text:'html',image:'dataUri caption fileName src url href',table:'rows headerRow',checklist:'items',prompt:'label model text reasoningEffort updatedAt copiedAt history',settings:'rows',knowledge:'rows reasoningEffort',testruns:'label rows'};
 function block(value){
  if(!object(value))refuse('block');
  if(own(value,'kind')&&!own(blockFields,value.kind))refuse('block kind');
  const kind=value.kind??'text',children={};
  if(kind==='knowledge'){identities(value.rows,'knowledge rows',false);children.rows=list(value=>knowledge(value));}
  if(kind==='checklist')children.items=list(value=>pick(value,'text done'));
  if(kind==='prompt')children.history=list(value=>pick(value,'at text'));
  if(kind==='settings')children.rows=list(value=>pick(value,'key value'));
  if(kind==='testruns')children.rows=list(value=>pick(value,'at input output verdict notes by testCaseId agentVersion'));
  return pick(value,'id kind role '+blockFields[kind],children);
 }
 const blocks=value=>{identities(value,'blocks');return list(block)(value);};
 const revision=value=>pick(value,'at author blocks',{blocks});
 const releaseSnapshot=value=>pick(value,'canon agent oversight data prompts settings capabilities boundaries knowledge',{
  agent:value=>pick(value,'agentId agentVersion platform environment'),oversight:value=>pick(value,'mode how exceptions'),data:value=>pick(value,'types confidential personal sensitive restrictions'),
  prompts:list(value=>pick(value,'label model text reasoningEffort')),knowledge:list(value=>knowledge(value,true))
 });
 const releases=value=>{identities(value,'releases',false);return list(value=>pick(value,'id seq version status createdAt createdBy approvedAt approvedBy notes testingRef fingerprint snapshot',{
  fingerprint:value=>pick(value,'package prompt knowledge canon'),snapshot:releaseSnapshot
 }))(value);};
 const governance=value=>value===null?null:pick(value,'schema answers outcome reviewedBy reviewedAt',{answers:list(value=>pick(value,'id answer rationale'))});
 const link=value=>pick(value,'kind diagramId nodeId label afterBlockId dangling documentId docId blockId');
 function document(value){
  return pick(value,'id ref title type status review owner createdAt updatedAt links comments revisions blocks agent governanceReview releases',{
   review,links:list(link),comments:list(value=>pick(value,'id blockId author kind text at resolved resolvedAt resolvedBy')),revisions:list(revision),blocks,
   agent:value=>value===null?null:agent(value),releases,
   governanceReview:governance
  });
 }
 function code(value){
  if(!object(value)||!own(value,'sourceRef'))refuse('Code source');linked(value,'content');
  // Keep opaque fields in this projection: validateCodeFiles' 4 MiB budget
  // includes metadata. Its validator returns these unchanged, not sanitized.
  const result=clone(value);delete result.sourceRef;delete result.baseSourceRef;put(result,'content','');return result;
 }
 function draft(value){
  if(!object(value)||!entity(value.id)||!own(value,'sourceRef'))refuse('draft');linked(value,'text');
  if(own(value,'baseSourceRef'))pointer(value.baseSourceRef);
  if(own(value,'base')||own(value,'history'))refuse('inline draft history');
  if(own(value,'generation')&&(!Number.isSafeInteger(value.generation)||value.generation<0))refuse('draft generation');
  for(const [key,max]of [['name',160],['language',32]])if(own(value,key)&&(typeof value[key]!=='string'||value[key].length>max))refuse('draft '+key);
  if(own(value,'ref')&&value.ref!==null){
   const ref=value.ref;if(!object(ref))refuse('draft link');
   const keys={docs:'kind docId blockId sourceId',release:'kind docId releaseId rowIndex',standalone:'kind fileId'}[ref.kind];
   if(!keys||Object.keys(ref).some(key=>!words(keys).includes(key))||!words(keys).every(key=>own(ref,key)))refuse('draft link');
   for(const key of words(keys).filter(key=>!['kind','rowIndex'].includes(key)))if(typeof ref[key]!=='string'||!ref[key]||ref[key].length>200)refuse('draft link identity');
   if(ref.kind==='release'&&(!Number.isSafeInteger(ref.rowIndex)||ref.rowIndex<0))refuse('draft release row');
  }
 }
 function drafts(value){identities(value,'drafts');if(value.length>65536)refuse('draft budget');value.forEach(draft);}
 const diagramValidators={nodeStyles:()=>sanitizeNodeStyles,styleClasses:()=>sanitizeStyleClasses,nodeClasses:()=>sanitizeNodeClasses,edgeStyles:()=>sanitizeEdgeStyles,edgeRoutes:()=>sanitizeEdgeRoutes,nodeMetadata:()=>sanitizeNodeMetadata,comments:()=>sanitizeComments,layout:()=>sanitizeLayout,view:()=>sanitizeView,links:()=>sanitizeNodeLinks,icons:()=>sanitizeNodeIcons,rules:()=>sanitizeFormatRules,numbering:()=>sanitizeNumbering,legend:()=>sanitizeLegend,gitBranchColours:()=>sanitizeGitBranchColours,fontFamily:()=>normalizeFontFamily,fontWeight:()=>normalizeFontWeight};
 const cardFields='id kind x y w h eyebrow title html body textScale align reveal rows headerRow assetId fit url embedKind embedId embedStart docId blockIds diagramId nodeIds';
 function presentation(value){
  const projected=pick(value,'sequence notes cameraMode transition decisionMode scenarios activeScenario autoplaySeconds autoplayLoop',{
   sequence:list(value=>pick(value,'id type title nodeId reveal chapterId card',{card:value=>pick(value,cardFields)})),
   notes:value=>{if(!object(value))refuse('presentation notes');const out={};for(const key of Object.keys(value))put(out,key,pick(value[key],'text owner source duration checkpointEnabled checkpointText'));return out;}
  });
  identities(projected.sequence,'presentation entries');
  // Current native edits intentionally retain a plain mirror's whitespace and
  // inactive headerRow:false on title/text cards. Validate those exact authored
  // fields before excluding only these derived/inactive values from comparison.
  for(const entry of projected.sequence??[]){
   const card=entry.card;if(entry.type!=='card'||!card||!['title','text','table'].includes(card.kind))continue;
   if(own(card,'body')){
    if(typeof card.body!=='string'||card.body.length>8000)refuse('presentation body');
    if(typeof card.html!=='string')refuse('presentation html');
    const escaped=card.body?'<p>'+card.body.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>')+'</p>':'';
    if(card.html===escaped&&sanitizeWorkpaperHtml(card.html)===card.html)delete card.body;
   }
   if(card.kind!=='table'&&Array.isArray(card.rows)&&card.rows.length===0&&typeof card.headerRow==='boolean')delete card.headerRow;
  }
  unchanged(projected,sanitizePresentation(clone(projected)),'presentation');
 }
 function styles(diagram){
  for(const [key,get]of Object.entries(diagramValidators))if(own(diagram,key)){
   const candidate=clone(diagram[key]),clean=get()(clone(candidate));unchanged(candidate,clean,'diagram.'+key);
  }
  if(own(diagram,'presentation'))presentation(diagram.presentation);
  for(const [key,max]of [['name',300],['diagramTitle',300]])if(own(diagram,key)&&(typeof diagram[key]!=='string'||diagram[key].length>max))refuse('diagram '+key);
  for(const key of ['fontSize'])if(own(diagram,key)&&(!Number.isFinite(diagram[key])||diagram[key]<10||diagram[key]>28))refuse('diagram '+key);
  if(own(diagram,'diagramTitleTouched')&&typeof diagram.diagramTitleTouched!=='boolean')refuse('diagram title flag');
  if(own(diagram,'direction')&&!['TD','TB','BT','LR','RL'].includes(diagram.direction))refuse('diagram direction');
  if(own(diagram,'curve')&&!['basis','linear','cardinal','monotoneX','monotoneY','step','stepBefore','stepAfter'].includes(diagram.curve))refuse('diagram curve');
 }
 let busy=false;
 window.sirenDesktopValidateBundleMetadata=async(text,fileName)=>{
  if(busy)refuse('busy');busy=true;const previous=state;
  try{
   if(typeof text!=='string'||new TextEncoder().encode(text).length>64*1024*1024)refuse('metadata budget');
   const bag=JSON.parse(text);if(!object(bag))refuse('metadata');let workspace,mode;
   if(bag.kind==='siren-desktop'){
    if(![1,2].includes(bag.schema)||!object(bag.storage)||typeof bag.storage[STORAGE_KEY]!=='string')refuse('primary workspace');workspace=JSON.parse(bag.storage[STORAGE_KEY]);mode='storage';
   }else if(own(bag,'state')){workspace=bag.state;mode='state';}else{workspace=bag;mode='direct';}
   if(!object(workspace))refuse('workspace');identities(workspace.diagrams,'diagrams');identities(workspace.workpapers,'documents');
   const projected=pick(workspace,'version activeDiagramId diagrams workpapers codeFiles',{
    diagrams:list(value=>pick(value,'id source')),workpapers:list(document),codeFiles:list(code)
   });
   if(object(workspace.codeWorkspace)&&own(workspace.codeWorkspace,'drafts'))drafts(workspace.codeWorkspace.drafts);
   else if(own(workspace,'codeWorkspace')&&!object(workspace.codeWorkspace))refuse('Code workspace');
   if(object(bag.storage)&&own(bag.storage,'siren-code-drafts-v1')){
    if(typeof bag.storage['siren-code-drafts-v1']!=='string')refuse('stored drafts');drafts(JSON.parse(bag.storage['siren-code-drafts-v1']));
   }
   state={...projected,diagrams:projected.diagrams??[],workpapers:projected.workpapers??[]};
   const before=clone(projected);
   const payload={type:PROJECT_TYPE,version:workspace.version||APP_VERSION,state:projected};
   if(Array.isArray(projected.diagrams)&&projected.diagrams.length===0){
    // Native source manifests may contain Code/Docs without a diagram. The
    // legacy portable gate requires one, so retain its actual version, Code
    // and Docs validators here without inventing a validation/stored diagram.
    const currentMajor=Number(String(APP_VERSION).split('.')[0])||1,importedMajor=portableProjectMajorVersion(payload);
    if(importedMajor!==null&&importedMajor>currentMajor)refuse('newer major version');
    if(projected.activeDiagramId)refuse('active diagram');
    validateCodeFiles(projected.codeFiles);assertPortableProjectWorkpapersFit(projected.workpapers);
    // There is no Mermaid source in this branch. Every nonempty diagram list
    // still runs the unchanged full frozen parser below.
   }else await validatePortableProjectForImport(payload,fileName);
   unchanged(before,projected,'workspace');
   const prepared=prepareProjectWorkpapers(projected.workpapers,fileName);
   unchanged(before.workpapers??[],prepared,'documents');
   for(const diagram of workspace.diagrams??[])styles(diagram);
   // Optional agent/release fields also remain bounded on non-agent documents;
   // the frozen document pass intentionally leaves those foreign fields opaque.
   for(const doc of workspace.workpapers??[]){
    if(doc.agent!==undefined&&doc.agent!==null){const candidate=agent(doc.agent);unchanged(candidate,sanitizeAgentMeta(clone(candidate)),'agent');}
    if(doc.releases!==undefined){const candidate=releases(doc.releases);unchanged(candidate,sanitizeAgentReleases(clone(candidate)),'releases');}
    if(doc.governanceReview!==undefined){const candidate=governance(doc.governanceReview);unchanged(candidate,sanitizeGovernanceReview(clone(candidate)),'governance review');}
   }
   // No defaults/projections are merged into file metadata. Only the established
   // file-claim stamp is allowed to alter original admitted documents.
   const originalWorkspaceJson=JSON.stringify(workspace);
   for(const doc of workspace.workpapers??[])stampWorkpaperFileSignoff(doc,{review:doc.review});
   if(mode==='storage'&&JSON.stringify(workspace)!==originalWorkspaceJson)put(bag.storage,STORAGE_KEY,JSON.stringify(workspace));
   return JSON.stringify(bag);
  }finally{state=previous;busy=false;}
 };
}
export const bundleMetadataHelper=`(${installBundleMetadata.toString()})();`;
