import {verifySnapshot} from '../projects/store.mjs';
import {workspaceMetadata} from '../windows/entities.mjs';
import {digest} from '../projects/atomic.mjs';
import {normalizeDiagramEmbed,normalizeDiagramEmbedAssetRef,validateDiagramEmbedWorkspace} from './diagram-embeds.mjs';
const reject=code=>{throw Object.assign(Error(code),{code});};
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const md=v=>String(v).replace(/[\\`*_{}\[\]()#+.!|<>~\-]/g,'\\$&').replaceAll('\r','').replaceAll('\n',' ↵ ');
export const embedAssetPath=ref=>'assets/'+ref.sha256+'.'+(ref.kind==='diagram-source'?'json':ref.kind);
export function verifyDiagramEmbedAsset(record){
 const ref=normalizeDiagramEmbedAssetRef(record?.ref),bytes=record?.bytes;if(!Buffer.isBuffer(bytes)||bytes.length!==ref.bytes||digest(bytes)!==ref.sha256)reject('DIAGRAM_EMBED_ASSET_CORRUPT');return {ref,bytes:Buffer.from(bytes)};
}
/** Resolve immutable saved references, never the current diagram or a draft.
 * Byte integrity is distinct from native SVG qualification at admission. */
export async function collectDiagramEmbedAssets({snapshot,assets,isCurrent,documentId}){
 let revoked=false;const current=()=>{try{if(typeof isCurrent!=='function'||isCurrent()!==true)revoked=true;}catch{revoked=true;}if(revoked)reject('ACCESS_REFUSED');};current();verifySnapshot(snapshot);validateDiagramEmbedWorkspace(JSON.parse(snapshot.json));const workspace=workspaceMetadata(snapshot),refs=new Map();
 const docs=(workspace.workpapers??[]).filter(d=>documentId===undefined||d.id===documentId);if(documentId!==undefined&&docs.length!==1)reject('DIAGRAM_EMBED_REFUSED');
 for(const doc of docs)for(const value of doc.blocks??[]){if(value?.kind!=='diagram-embed')continue;const block=normalizeDiagramEmbed(value);if(block.snapshot.sourceHash!==block.snapshot.sourceAsset.sha256)reject('DIAGRAM_EMBED_ASSET_CORRUPT');for(const ref of [block.snapshot.sourceAsset,block.snapshot.visualAsset]){const key=ref.kind+':'+ref.sha256,previous=refs.get(key);if(previous&&previous.bytes!==ref.bytes)reject('DIAGRAM_EMBED_ASSET_CORRUPT');refs.set(key,ref);}}
 if(refs.size&&typeof assets?.read!=='function')reject('DIAGRAM_EMBED_ASSET_UNKNOWN');const records=[];for(const ref of refs.values()){current();const bytes=await assets.read({projectId:snapshot.project.id,ref,isCurrent:()=>{current();return true;}});current();records.push(verifyDiagramEmbedAsset({ref,bytes}));}return records;
}
export function formatDiagramEmbed(value,visual,{format}){
 const block=normalizeDiagramEmbed(value),record=verifyDiagramEmbedAsset(visual),ref=block.snapshot.visualAsset;if(!['html','markdown'].includes(format)||record.ref.kind!==ref.kind||record.ref.sha256!==ref.sha256||record.ref.bytes!==ref.bytes)reject('DIAGRAM_EMBED_ASSET_CORRUPT');const path=embedAssetPath(ref),label=block.caption||'Diagram context',detail=(block.mode==='fixed'?'Fixed':'Live')+' · Version '+block.snapshot.sourceVersion+' · '+(block.scope==='whole'?'Whole diagram':'Selected steps: '+block.nodeIds.join(', '))+' · '+block.status;
 // SVG stays a passive image resource, never inline document markup.
 return {html:format==='html'?'<figure class="diagram-context"><img alt="'+escape(label)+'" src="data:image/'+(ref.kind==='svg'?'svg+xml':'png')+';base64,'+record.bytes.toString('base64')+'"><figcaption>'+escape(label)+'</figcaption><p class="notice">'+escape(detail)+'</p></figure>':'',markdown:'!['+md(label)+']('+path+')\n\n'+md(detail),assets:[{path,bytes:record.bytes}]};
}
// Finite uncompressed ZIP writer: only our ASCII document/hash asset names.
// No extraction, filesystem paths, compression provider or executable content.
export function packageDiagramMarkdown(entries,maximum=16*1024*1024){
 if(!Array.isArray(entries)||entries.length>4097)reject('EXPORT_BUDGET');const seen=new Set();let total=22;for(const e of entries){if(!e||!Buffer.isBuffer(e.bytes)||typeof e.path!=='string'||!(e.path==='document.md'||/^assets\/[a-f0-9]{64}\.(svg|png|json)$/.test(e.path))||seen.has(e.path))reject('DIAGRAM_EMBED_REFUSED');seen.add(e.path);total+=e.bytes.length+76+Buffer.byteLength(e.path)*2;}if(total>maximum)reject('EXPORT_BUDGET');
 const table=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;}),crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};const chunks=[],central=[];let offset=0;
 for(const e of entries){const name=Buffer.from(e.path),checksum=crc(e.bytes),local=Buffer.alloc(30),index=Buffer.alloc(46);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(checksum,14);local.writeUInt32LE(e.bytes.length,18);local.writeUInt32LE(e.bytes.length,22);local.writeUInt16LE(name.length,26);index.writeUInt32LE(0x02014b50);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt32LE(checksum,16);index.writeUInt32LE(e.bytes.length,20);index.writeUInt32LE(e.bytes.length,24);index.writeUInt16LE(name.length,28);index.writeUInt32LE(offset,42);chunks.push(local,name,e.bytes);central.push(index,name);offset+=local.length+name.length+e.bytes.length;}
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,directory,end],total);
}
