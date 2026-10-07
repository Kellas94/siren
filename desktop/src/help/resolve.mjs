import {validateHelpCatalog,freezeHelpData} from './catalog.mjs';
const plain=value=>value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function fields(value,required,optional=[]){
 if(!plain(value))return null;const keys=Reflect.ownKeys(value);
 if(keys.some(k=>typeof k!=='string'||![...required,...optional].includes(k))||required.some(k=>!keys.includes(k)))return null;
 const result=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;
}
export function createHelpResolver(articles){
 if(!validateHelpCatalog(articles).ok)throw Error('INVALID_HELP_CATALOG');
 const snapshot=freezeHelpData(JSON.parse(JSON.stringify(articles))),byId=new Map(snapshot.map(a=>[a.id,a])),mapped=new Map();
 for(const a of snapshot)for(const m of a.mappings)mapped.set([m.namespace,m.operation,m.code].join('\0'),a);
 const unknown=byId.get('unknown-error');
 return Object.freeze({
  get(id){return typeof id==='string'?byId.get(id)??null:null;},
  resolve(identity){try{const v=fields(identity,['namespace','operation','code']);if(!v||!['namespace','operation','code'].every(k=>typeof v[k]==='string'&&v[k].length<=96&&!v[k].includes('\0')))return unknown;return mapped.get([v.namespace,v.operation,v.code].join('\0'))??unknown;}catch{return unknown;}},
  search(input){try{
   const v=fields(input,['query'],['category']);if(!v||typeof v.query!=='string'||v.query.length>200||Object.hasOwn(v,'category')&&typeof v.category!=='string')return [];
   const q=v.query.trim().toLowerCase(),results=[];
   for(const a of snapshot){if(v.category&&a.category!==v.category)continue;let rank=3;
    if(q&&a.mappings.some(m=>m.code.toLowerCase()===q))rank=0;
    else if(q&&a.title.toLowerCase().includes(q))rank=1;
    else if(q&&![a.title,a.summary,a.observed,a.causes,a.checks,a.recovery,a.dataImpact,a.technical,...a.mappings.map(m=>m.code)].join('\n').toLowerCase().includes(q))continue;
    results.push({id:a.id,rank});
   }return Object.freeze(results.sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id,'en')).map(a=>a.id));
  }catch{return [];}},
  flow(id){return typeof id==='string'?byId.get(id)?.flow??null:null;},
 });
}
