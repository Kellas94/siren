/** Read-only, bounded views of saved records. Claims are never approvals. */
export function createDocumentActivityContract(){
 const limits=Object.freeze({scalarChars:4096,rowChars:16384,pageChars:131072,pageRows:20,scanRows:256,compareBlocks:256,compareBytes:1048576,compareNodes:32768,compareDepth:32,lookupBlocks:4096,idChars:200});
 const own=(value,key)=>value!==null&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key):undefined;
 const get=(value,key)=>{const d=own(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const validId=value=>typeof value==='string'&&value.length>0&&value.length<=limits.idChars&&value.isWellFormed();
 const failure=code=>({ok:false,code});
 function locate(blocks,id){
  if(!validId(id))return failure('BLOCK_ID_INVALID');
  if(!Array.isArray(blocks))return failure('BLOCKS_INVALID');
  const length=get(blocks,'length');if(length>limits.lookupBlocks)return failure('BLOCK_LOOKUP_LIMIT');
  let index=-1;for(let i=0;i<length;i++)if(get(get(blocks,String(i)),'id')===id){if(index!==-1)return failure('BLOCK_AMBIGUOUS');index=i;}
  return index<0?failure('BLOCK_MISSING'):{ok:true,index};
 }
 function page(document,options={}){
  const {section='comments',filter='all',cursor=0,limit=20}=options;
  if(!['comments','revisions','review'].includes(section)||!['all','open','resolved'].includes(filter)||!Number.isSafeInteger(cursor)||cursor<0||!Number.isSafeInteger(limit)||limit<1||limit>limits.pageRows)return failure('ACTIVITY_OPTIONS_INVALID');
  if(!record(document))return failure('DOCUMENT_INVALID');
  const review=get(document,'review'),arrayField=(value,key)=>{const d=own(value,key);if(!d)return[];return Object.hasOwn(d,'value')&&Array.isArray(d.value)?d.value:null;};
  const values=section==='comments'?arrayField(document,'comments'):section==='revisions'?arrayField(document,'revisions'):null;
  const trail=section==='review'?arrayField(review,'trail'):[],releases=section==='review'?arrayField(document,'releases'):[];
  if(section==='review'&&(trail===null||releases===null)||section!=='review'&&values===null)return failure('ACTIVITY_RECORDS_INVALID');
  const trailLength=trail?.length??0,total=section==='review'?1+trailLength+releases.length:values.length;
  const rows=[];let position=Math.min(cursor,total),scanned=0,chars=0,limited=false;
  const scalar=value=>typeof value==='string'?value:value===null?'null':typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)?String(value):'[Unsupported recorded value; see Preserved fields]';
  while(position<total&&scanned<limits.scanRows&&rows.length<limit){
   const sourcePosition=position;let kind=section==='comments'?'comment':section==='revisions'?'revision':'review';
   const value=section!=='review'?get(values,String(position)):position===0?document:position<=trailLength?(kind='trail',get(trail,String(position-1))):(kind='release',get(releases,String(position-1-trailLength)));
   const resolution=get(value,'resolved'),state=resolution===true?'resolved':resolution===false?'open':'unsupported';
   if(section==='comments'&&filter!=='all'&&state!==filter){position++;scanned++;continue;}
   const fields=[];let rowChars=0;
   function add(owner,key,label=key){const descriptor=own(owner,key);if(!descriptor)return;const raw=Object.hasOwn(descriptor,'value')?scalar(descriptor.value):'[Unsupported recorded accessor]';const max=Math.min(limits.scalarChars,limits.rowChars-rowChars);if(max<=0){limited=true;return;}const text=raw.slice(0,max),truncated=text.length<raw.length;fields.push({key:label,text,truncated});rowChars+=text.length;if(truncated)limited=true;}
   const keys=kind==='comment'?['id','author','kind','text','at','blockId','resolved','resolvedAt','resolvedBy']:kind==='revision'?['id','label','title','at','by','author','note']:kind==='trail'?['state','action','at','by','who','author','note','detail','digest']:kind==='release'?['id','seq','sequence','version','status','createdAt','createdBy','approvedAt','approvedBy','notes','testing','testingRef','testReference','fingerprint','digest']:['status'];
   for(const key of keys)add(value,key);
   if(kind==='review'){
    for(const key of ['state','submittedBy','submittedAt','decidedBy','decidedAt','approvedDigest','note','notes'])add(review,key,'review.'+key);
    const provenance=get(document,'signoffFromFile');if(own(document,'signoffFromFile')){
     if(record(provenance)){add(document,'signoffFromFile');for(const key of ['status','state','submittedBy','submittedAt','decidedBy','decidedAt','approvedDigest','digestHeld','trailRows','matchesAtImport','namesCutAtDoor','at'])add(provenance,key,'signoffFromFile.'+key);const last=get(provenance,'trailLast');for(const key of ['at','who','action','detail'])add(last,key,'signoffFromFile.trailLast.'+key);}
     else add(document,'signoffFromFile');
    }
   }
   if(kind==='release'){const fingerprint=get(value,'fingerprint');for(const key of ['package','prompt','knowledge','canon'])add(fingerprint,key,'fingerprint.'+key);}
   if(!record(value)){const text='Unsupported recorded entry; see Preserved fields'.slice(0,limits.rowChars-rowChars);fields.push({key:'record',text,truncated:text.length<47});rowChars+=text.length;}
   if(chars+rowChars>limits.pageChars&&rows.length){limited=true;break;}
   const row={position:sourcePosition,kind,title:kind==='review'?'Recorded document review':(kind==='comment'?'Comment ':kind==='revision'?'Revision ':kind==='trail'?'Review event ':'Release ')+(kind==='trail'?sourcePosition:kind==='release'?sourcePosition-trailLength:sourcePosition+1),fields};
   if(kind==='comment'){row.state=state;const id=get(value,'blockId');if(validId(id))row.blockId=id;}
   if(kind==='revision'){const blocks=get(value,'blocks');row.canCompare=Array.isArray(blocks)&&blocks.length<=limits.compareBlocks;if(Array.isArray(blocks))row.blockCount=blocks.length;}
   rows.push(row);chars+=rowChars;position++;scanned++;
  }
  if(position<total&&scanned>=limits.scanRows)limited=true;
  return {ok:true,rows,nextCursor:position<total?position:null,total,scanned,limited};
 }
 function compare(beforeBlocks,afterBlocks){
  const budget={nodes:0,bytes:0},active=new Set(),encoder=new TextEncoder();
  const refuse=code=>{throw code;};
  const charge=text=>{budget.bytes+=encoder.encode(text).length;if(budget.bytes>limits.compareBytes)refuse('COMPARISON_BYTE_LIMIT');return text;};
  function string(value){if(!value.isWellFormed())refuse('COMPARISON_JSON_INVALID');if(value.length>limits.compareBytes-budget.bytes)refuse('COMPARISON_BYTE_LIMIT');return charge(JSON.stringify(value));}
  function canonical(value,depth=0){
   if(++budget.nodes>limits.compareNodes)refuse('COMPARISON_NODE_LIMIT');if(depth>limits.compareDepth)refuse('COMPARISON_DEPTH_LIMIT');
   if(value===null)return charge('null');if(typeof value==='boolean')return charge(String(value));if(typeof value==='number'){if(!Number.isFinite(value))refuse('COMPARISON_JSON_INVALID');return charge(JSON.stringify(value));}if(typeof value==='string')return string(value);
   if(!value||typeof value!=='object'||active.has(value))refuse('COMPARISON_JSON_INVALID');
   const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)refuse('COMPARISON_JSON_INVALID');
   const keys=Reflect.ownKeys(value);if(keys.length>limits.compareNodes-budget.nodes+1)refuse('COMPARISON_NODE_LIMIT');if(keys.some(key=>typeof key!=='string'))refuse('COMPARISON_JSON_INVALID');
   const descriptors=Object.getOwnPropertyDescriptors(value);active.add(value);let result;
   if(array){const length=descriptors.length.value;if(keys.length!==length+1)refuse('COMPARISON_JSON_INVALID');const pieces=[];charge('[');for(let i=0;i<length;i++){const d=descriptors[i];if(!d||!d.enumerable||!Object.hasOwn(d,'value'))refuse('COMPARISON_JSON_INVALID');if(i)charge(',');pieces.push(canonical(d.value,depth+1));}charge(']');result='['+pieces.join(',')+']';}
   else{const pieces=[];charge('{');for(const key of keys.sort()){const d=descriptors[key];if(!d.enumerable||!Object.hasOwn(d,'value'))refuse('COMPARISON_JSON_INVALID');if(pieces.length)charge(',');pieces.push(string(key)+charge(':')+canonical(d.value,depth+1));}charge('}');result='{'+pieces.join(',')+'}';}
   active.delete(value);return result;
  }
  try{
   if(!Array.isArray(beforeBlocks)||!Array.isArray(afterBlocks))return failure('COMPARISON_BLOCKS_INVALID');
   if(beforeBlocks.length>limits.compareBlocks||afterBlocks.length>limits.compareBlocks)return failure('COMPARISON_BLOCK_LIMIT');
   // Validate array containers too, not just the visible block values.
   const beforeJson=canonical(beforeBlocks),afterJson=canonical(afterBlocks);
   const index=blocks=>{const map=new Map();for(let i=0;i<blocks.length;i++){const id=get(blocks[i],'id');if(!validId(id))refuse('COMPARISON_ID_INVALID');if(map.has(id))refuse('COMPARISON_ID_AMBIGUOUS');map.set(id,i);}return map;};
   const before=index(beforeBlocks),after=index(afterBlocks),rows=[],counts={added:0,removed:0,changed:0,unchanged:0,reordered:0};
   // Already validated JSON is bounded; parse once to compare canonical block strings without re-charging the input budget.
   const left=JSON.parse(beforeJson),right=JSON.parse(afterJson);
   for(const [id,beforeIndex] of before){const afterIndex=after.get(id),change=afterIndex===undefined?'removed':JSON.stringify(left[beforeIndex])===JSON.stringify(right[afterIndex])?'unchanged':'changed',reordered=afterIndex!==undefined&&beforeIndex!==afterIndex;rows.push({id,change,reordered,beforeIndex,afterIndex:afterIndex??null});counts[change]++;if(reordered)counts.reordered++;}
   for(const [id,afterIndex]of after)if(!before.has(id)){rows.push({id,change:'added',reordered:false,beforeIndex:null,afterIndex});counts.added++;}
   return {ok:true,identical:beforeJson===afterJson,rows,counts};
  }catch(code){return failure(typeof code==='string'?code:'COMPARISON_JSON_INVALID');}
 }
 return Object.freeze({limits,page,compare,locate});
}
