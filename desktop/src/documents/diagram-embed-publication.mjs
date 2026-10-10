// Main-only issuance; IPC/structured clones cannot create this private brand.
import {navigationFields} from '../navigation/contracts.mjs';
import {validId} from '../projects/paths.mjs';
import {normalizeDiagramEmbed} from './diagram-embeds.mjs';
const publications=new WeakMap(),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export function createDiagramEmbedPublication(value){
 const r=navigationFields(value,['documentId','expectedVersion','operationId','action','afterBlockId','block']);
 if(!id(r.documentId)||!hash(r.expectedVersion)||!validId(r.operationId)||!['insert','replace','mode','refresh','status'].includes(r.action)||r.afterBlockId!==null&&!id(r.afterBlockId)||r.action!=='insert'&&r.afterBlockId!==null)throw Object.assign(Error('DIAGRAM_EMBED_PUBLICATION_REFUSED'),{code:'DIAGRAM_EMBED_PUBLICATION_REFUSED'});
 const request=freeze({...r,block:normalizeDiagramEmbed(r.block)}),token=Object.freeze({});publications.set(token,request);return token;
}
export function readDiagramEmbedPublication(value){return value&&typeof value==='object'?publications.get(value)??null:null;}
