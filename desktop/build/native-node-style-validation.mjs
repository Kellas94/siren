/** Validate only changed managed block styles. Imported opaque siblings may be
 * retained byte-for-byte as JSON values, never newly authored or removed here.
 * This function is embedded in the isolated validator's existing CSP script. */
export function validateNativeNodeStyles(value,before,sanitize){
 const managed=new Set(['fill','border','text','fontFamily','fontSize','fontWeight']);
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(!object(value)||typeof sanitize!=='function')return false;const prior=object(before)?before:{};if(Object.keys(value).length>250)return same(value,prior);
 for(const id of new Set([...Object.keys(prior),...Object.keys(value)])){
  const old=Object.hasOwn(prior,id)?prior[id]:undefined,next=Object.hasOwn(value,id)?value[id]:undefined;if(same(old,next))continue;
  if(next===undefined){if(!object(old)||Object.keys(old).some(k=>!managed.has(k)))return false;continue;}
  if(!object(next)||old!==undefined&&!object(old))return false;
  const opaque=v=>Object.fromEntries(Object.entries(v||{}).filter(([k])=>!managed.has(k)));
  if(!same(opaque(old),opaque(next)))return false;
  const patch=Object.fromEntries(Object.entries(next).filter(([k])=>managed.has(k)));
  const admitted=sanitize({[id]:patch});if(!object(admitted)||!Object.hasOwn(admitted,id)||!same(admitted[id],patch))return false;
 }
 return true;
}
