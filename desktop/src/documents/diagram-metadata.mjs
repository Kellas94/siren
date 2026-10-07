/** Shared finite annotation boundary. Kept self-contained for the isolated
 * frozen validator and native browser bundle; neither receives new authority. */
export function createDiagramMetadataContract(){
 const fields=Object.freeze({risk:180,control:180,owner:100,system:100,evidence:600,reference:220,frequency:80,status:8});
 const statuses=Object.freeze(['','draft','review','approved','issue','resolved']);
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const refuse=()=>{throw TypeError('DIAGRAM_METADATA_REFUSED');};
 function copy(v,budget={nodes:0,chars:0},depth=0){
  if(++budget.nodes>50000||depth>32)refuse();
  if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(typeof v==='string'){if(!v.isWellFormed()||(budget.chars+=v.length)>2*1024*1024)refuse();return v;}
  if(!v||typeof v!=='object')refuse();
  const array=Array.isArray(v),proto=Object.getPrototypeOf(v);if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)refuse();
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(descriptors);
  if(array){const length=descriptors.length.value;if(length>50000||keys.length!==length+1)refuse();return Array.from({length},(_,i)=>{const d=descriptors[i];if(!d||!('value'in d))refuse();return copy(d.value,budget,depth+1);});}
  return Object.fromEntries(keys.map(key=>{const d=descriptors[key];if(typeof key!=='string'||!key.isWellFormed()||!d.enumerable||!('value'in d)||(budget.chars+=key.length)>2*1024*1024)refuse();return[key,copy(d.value,budget,depth+1)];}));
 }
 const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const validId=id=>typeof id==='string'&&id.length<=50000&&/^[A-Za-z_][\w.-]*$/.test(id);
 const managed=key=>Object.hasOwn(fields,key);
 const valid=(key,value)=>managed(key)&&typeof value==='string'&&value.isWellFormed()&&value.length<=fields[key]&&(key!=='status'||statuses.includes(value));
 // Imported unsupported values are opaque even at a managed key. Allowing
 // correction would either lose nested pointers or make historical Undo
 // impossible to save without granting invalid renderer input new authority.
 const retained=(key,value)=>!managed(key)||!valid(key,value);
 function validate(value,before){
  try{
   const next=value===undefined?undefined:copy(value),prior=before===undefined?undefined:copy(before);
   if(same(next,prior))return true;
   if(next!==undefined&&!object(next)||prior!==undefined&&!object(prior))return false;
   if(Object.keys(next??{}).length>500||Object.keys(prior??{}).length>500)return false;
   for(const id of new Set([...Object.keys(prior??{}),...Object.keys(next??{})])){
    const old=prior&&Object.hasOwn(prior,id)?prior[id]:undefined,node=next&&Object.hasOwn(next,id)?next[id]:undefined;
    if(same(old,node))continue;if(!validId(id)||old!==undefined&&!object(old))return false;
    if(node===undefined){if(Object.entries(old??{}).some(([key,value])=>retained(key,value)))return false;continue;}
    if(!object(node))return false;
    const opaque=v=>Object.fromEntries(Object.entries(v??{}).filter(([key,value])=>retained(key,value)));
    if(!same(opaque(old),opaque(node)))return false;
    for(const key of Object.keys(node))if(managed(key)&&(!old||!Object.hasOwn(old,key)||!same(old[key],node[key]))&&!valid(key,node[key]))return false;
   }
   return true;
  }catch{return false;}
 }
 function update(before,operation){
  const op=copy(operation);if(!object(op)||Object.keys(op).length!==2||!Object.hasOwn(op,'id')||!Object.hasOwn(op,'changes')||!validId(op.id)||!object(op.changes)||Object.keys(op.changes).length>8)refuse();
  for(const[key,value]of Object.entries(op.changes))if(!valid(key,value))refuse();
  const prior=before===undefined?undefined:copy(before);if(prior!==undefined&&!object(prior))refuse();
  const old=prior&&Object.hasOwn(prior,op.id)?prior[op.id]:undefined;if(old!==undefined&&!object(old))refuse();
  const node={...old};for(const[key,value]of Object.entries(op.changes)){if(value==='')delete node[key];else Object.defineProperty(node,key,{value,enumerable:true,writable:true,configurable:true});}
  const next={...prior};if(Object.keys(node).length)Object.defineProperty(next,op.id,{value:node,enumerable:true,writable:true,configurable:true});else delete next[op.id];
  const result=prior===undefined&&!Object.keys(next).length?undefined:next;
  if(!validate(result,prior))refuse();return result;
 }
 return Object.freeze({fields,statuses,update,validate,canEditField:(key,value)=>managed(key)&&(value===undefined||valid(key,value))});
}
