const refuse=()=>{throw Object.assign(Error('PRESENTATION_EDIT_REFUSED'),{code:'PRESENTATION_EDIT_REFUSED'});};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function fields(v,allowed,required=[]){if(!object(v))refuse();const d=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(d);if(!keys.length||keys.some(k=>typeof k!=='string'||!allowed.includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],'value'))||required.some(k=>!Object.hasOwn(d,k)))refuse();return Object.fromEntries(keys.map(k=>[k,d[k].value]));}
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,90}$/.test(v),text=(v,max)=>{if(typeof v!=='string'||!v.isWellFormed()||v.length>max)refuse();return v;};
export function normalizePresentationEdits(input){
 if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length<1||input.length>120||Reflect.ownKeys(input).length!==input.length+1)refuse();
 return Array.from({length:input.length},(_,i)=>{const descriptor=Object.getOwnPropertyDescriptor(input,i);if(!descriptor||!Object.hasOwn(descriptor,'value'))refuse();const op=fields(descriptor.value,['action','id','kind','nodeId','offset','newId','changes'],['action','id']);if(!id(op.id))refuse();
  const keys={add:['action','id','kind','nodeId'],move:['action','id','offset'],duplicate:['action','id','newId'],remove:['action','id'],update:['action','id','changes']}[op.action];if(!keys||Object.keys(op).some(k=>!keys.includes(k)))refuse();
  if(op.action==='add'&&(!['overview','section','title','text','node'].includes(op.kind)||op.id.length>40||op.kind==='node'&&(typeof op.nodeId!=='string'||!/^[A-Za-z_][\w.-]{0,79}$/.test(op.nodeId))||op.kind!=='node'&&Object.hasOwn(op,'nodeId')))refuse();
  if(op.action==='move'&&![-1,1].includes(op.offset)||op.action==='duplicate'&&(!id(op.newId)||op.newId.length>40))refuse();
  if(op.action==='update'){op.changes=fields(op.changes,['title','eyebrow','body','note']);for(const [k,v]of Object.entries(op.changes))text(v,{title:120,eyebrow:80,body:8000,note:5000}[k]);}return op;
 });
}
export const presentationNoteKey=entry=>entry.type==='node'?'node:'+entry.nodeId:entry.type==='chapter'?'chapter:'+entry.chapterId:entry.type==='overview'?'overview':entry.type+':'+entry.id;
const html=v=>v?'<p>'+v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>')+'</p>':'';
function newEntry(op){if(['overview','section'].includes(op.kind))return {id:op.id,type:op.kind,title:op.kind==='overview'?'Overview':'Section'};if(op.kind==='node')return {id:op.id,type:'node',nodeId:op.nodeId,reveal:false};return {id:op.id,type:'card',title:op.kind==='title'?'Title':'Text slide',card:{id:op.id,kind:op.kind,x:0,y:0,w:560,h:340,eyebrow:'',title:op.kind==='title'?'Title':'Text slide',html:'',body:'',textScale:1,align:'left',reveal:false,rows:[],headerRow:false,assetId:'',fit:'contain',url:'',embedKind:'link',embedId:'',embedStart:0,docId:'',blockIds:[],diagramId:'',nodeIds:[]}};}
export function applyPresentationEdits(before,input){
 const edits=normalizePresentationEdits(input);if(before!==undefined&&before!==null&&!object(before))refuse();const result=structuredClone(before??{sequence:[],notes:{},cameraMode:'context',transition:'cinematic',decisionMode:'continue',scenarios:{},activeScenario:'',autoplaySeconds:5,autoplayLoop:false});
 if(result.sequence===undefined)result.sequence=[];if(!Array.isArray(result.sequence)||result.sequence.length>600)refuse();if(result.notes===undefined)result.notes={};if(!object(result.notes)||Object.keys(result.notes).length>600)refuse();
 const unique=()=>{const ids=new Set();for(const entry of result.sequence){if(!object(entry)||!id(entry.id)||ids.has(entry.id))refuse();ids.add(entry.id);}};unique();
 for(const op of edits){
  const index=result.sequence.findIndex(v=>v.id===op.id),entry=result.sequence[index];
  if(op.action==='add'){if(index>=0||result.sequence.length>=600)refuse();result.sequence.push(newEntry(op));continue;}if(index<0)refuse();
  if(op.action==='remove'){result.sequence.splice(index,1);continue;}
  if(op.action==='move'){const at=index+op.offset;if(at<0||at>=result.sequence.length)continue;result.sequence.splice(index,1);result.sequence.splice(at,0,entry);continue;}
  if(op.action==='duplicate'){if(result.sequence.length>=600||result.sequence.some(v=>v.id===op.newId))refuse();const copy=structuredClone(entry);copy.id=op.newId;if(copy.type==='card'&&object(copy.card))copy.card.id=op.newId;result.sequence.splice(index+1,0,copy);const oldKey=presentationNoteKey(entry),newKey=presentationNoteKey(copy);if(oldKey!==newKey&&Object.hasOwn(result.notes,oldKey)){if(Object.keys(result.notes).length>=600||Object.hasOwn(result.notes,newKey))refuse();Object.defineProperty(result.notes,newKey,{value:structuredClone(result.notes[oldKey]),enumerable:true,writable:true,configurable:true});}continue;}
  const changes=op.changes,card=entry.type==='card'&&object(entry.card)&&['title','text'].includes(entry.card.kind);
  if(Object.hasOwn(changes,'title')){if(card){entry.card.title=changes.title;entry.title=(entry.card.title||entry.card.eyebrow||'Slide').slice(0,120);}else if(['overview','section','chapter'].includes(entry.type))entry.title=changes.title;else refuse();}
  if(Object.hasOwn(changes,'eyebrow')){if(!card)refuse();entry.card.eyebrow=changes.eyebrow;entry.title=(entry.card.title||entry.card.eyebrow||'Slide').slice(0,120);}
  if(Object.hasOwn(changes,'body')){if(!card)refuse();entry.card.body=changes.body;entry.card.html=html(changes.body);}
  if(Object.hasOwn(changes,'note')){const key=presentationNoteKey(entry);if(typeof key!=='string'||key.length>140||!Object.hasOwn(result.notes,key)&&Object.keys(result.notes).length>=600||Object.hasOwn(result.notes,key)&&!object(result.notes[key]))refuse();const note=structuredClone(result.notes[key]??{owner:'',source:'',duration:0,checkpointEnabled:false,checkpointText:''});note.text=changes.note;Object.defineProperty(result.notes,key,{value:note,enumerable:true,writable:true,configurable:true});}
 }
 unique();return result;
}
