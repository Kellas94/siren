import {parseFragment} from 'parse5';
import {createHash} from 'node:crypto';
import {navigationFields} from '../navigation/contracts.mjs';
import {documentContentVersion} from '../windows/docs.mjs';
import {normalizeDiagramEmbed} from './diagram-embeds.mjs';
import {verifyDiagramEmbedAsset,formatDiagramEmbed,packageDiagramMarkdown,embedAssetPath} from './diagram-embed-export.mjs';

const reject=code=>{throw Object.assign(Error(code),{code});};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const md=value=>String(value).replace(/[\\`*_{}\[\]()#+.!|<>~\-]/g,'\\$&').replaceAll('\r','').replaceAll('\n',' ↵ ');
const indented=value=>value.replace(/\r\n?/g,'\n').split('\n').map(line=>'    '+line).join('\n');
const css=':root{color-scheme:light}body{max-width:80ch;margin:48px auto;padding:0 28px 64px;font:16px/1.65 system-ui,sans-serif;color:#202633;background:#fff}h1,h2,h3{line-height:1.2;letter-spacing:-.02em}h1{font-size:36px}section{margin:28px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#f3f5f9;border-radius:12px;font:13px/1.6 ui-monospace,monospace}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #cbd2df;padding:9px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.notice,summary{font-size:13px;color:#526079}details{border-top:1px solid #cbd2df;padding-top:24px}@media print{body{margin:0;max-width:none}details{display:block}pre{break-inside:auto}}';
const policy="default-src 'none'; style-src 'sha256-"+createHash('sha256').update(css).digest('base64')+"'; base-uri 'none'; form-action 'none'; object-src 'none'";
const disclosure='Saved document only. Linked code, diagrams and other documents are references only; their bytes are not embedded. Use a project backup to preserve linked assets. Visual formatting may differ. Exact original fields and claims are retained in Preserved data; this archive has no qualified single-document import yet.';
const tags=new Set('p br strong b em i u s ul ol li blockquote pre code h1 h2 h3 h4 h5 h6 span div'.split(' '));

// Independent bounded plain-data copy: no getter/toJSON/prototype execution.
function copy(value,depth=0,budget={nodes:0,bytes:0}){
 if(depth>32||++budget.nodes>50000)reject('DOCUMENT_BUDGET');
 if(typeof value==='string'){if(!value.isWellFormed()||(budget.bytes+=Buffer.byteLength(value))>8*1024*1024)reject('DOCUMENT_BUDGET');return value;}
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(!value||typeof value!=='object')reject('DOCUMENT_REFUSED');
 const array=Array.isArray(value),proto=Object.getPrototypeOf(value);if(array?proto!==Array.prototype:![Object.prototype,null].includes(proto))reject('DOCUMENT_REFUSED');
 const fields=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(fields);
 if(array){const length=fields.length.value;if(length>50000||keys.length!==length+1)reject('DOCUMENT_BUDGET');return Array.from({length},(_,i)=>{if(!fields[i]||!('value'in fields[i]))reject('DOCUMENT_REFUSED');return copy(fields[i].value,depth+1,budget);});}
 return Object.fromEntries(keys.map(key=>{if(typeof key!=='string'||!key.isWellFormed()||!fields[key].enumerable||!('value'in fields[key]))reject('DOCUMENT_REFUSED');budget.bytes+=Buffer.byteLength(key);if(budget.bytes>8*1024*1024)reject('DOCUMENT_BUDGET');return [key,copy(fields[key].value,depth+1,budget)];}));
}
function rich(value){
 const fallback=()=>({html:'<p class="notice">Rich formatting is preserved as exact data below.</p><pre>'+escape(value)+'</pre>',text:value,notice:true});
 if(value.length>131072)return fallback();
 try{
  const root=parseFragment(value);let count=0,notice=false;
  const visit=(node,depth)=>{
   if(++count>4096||depth>32)throw Error('Rich budget');
   if(node.nodeName==='#text')return {html:escape(node.value),text:node.value};
   if(node.nodeName==='#document-fragment'){const children=(node.childNodes??[]).map(n=>visit(n,depth+1));return {html:children.map(n=>n.html).join(''),text:children.map(n=>n.text).join('')};}
   if(!tags.has(node.tagName)||node.namespaceURI!=='http://www.w3.org/1999/xhtml')throw Error('Unsafe rich structure');
   if(node.attrs.some(a=>!['style','class'].includes(a.name)))throw Error('Unsafe rich attributes');
   if(node.attrs.length)notice=true;const children=(node.childNodes??[]).map(n=>visit(n,depth+1)),text=children.map(n=>n.text).join('');
   return {html:'<'+node.tagName+'>'+children.map(n=>n.html).join('')+(node.tagName==='br'?'':'</'+node.tagName+'>'),text:text+(node.tagName==='br'||['p','div','li','pre','blockquote'].includes(node.tagName)?'\n':'')};
  };
  return {...visit(root,0),notice};
 }catch{return fallback();}
}
const textValue=value=>typeof value==='string'?value:JSON.stringify(value??null);
function block(value,format,budget){
 if(!value||typeof value!=='object')return {html:'<p class="notice">Unrecognized block · Exact data preserved below.</p>',markdown:'Unrecognized block · Exact data preserved below.'};
 const kind=value.kind;
 if(kind==='heading'&&typeof value.text==='string'){const level=Math.max(2,Math.min(6,Number.isSafeInteger(value.level)?value.level:2));return {html:`<h${level}>${escape(value.text)}</h${level}>`,markdown:'#'.repeat(level)+' '+md(value.text)};}
 if(kind==='text'&&typeof value.html==='string'){const rendered=rich(value.html);return {html:rendered.html+(rendered.notice?'<p class="notice">Formatting details are preserved below.</p>':''),markdown:rendered.notice?'Rich formatting preserved as data:\n\n'+indented(value.html):md(rendered.text.trim())};}
 if(kind==='prompt'&&typeof value.text==='string')return {html:'<h3>'+escape(typeof value.label==='string'?value.label:'Agent instructions')+'</h3><pre>'+escape(value.text)+'</pre>',markdown:'### '+md(typeof value.label==='string'?value.label:'Agent instructions')+'\n\n'+indented(value.text)};
 if(kind==='image')return {html:'<p class="notice">Image '+escape(typeof value.caption==='string'?value.caption:typeof value.fileName==='string'?value.fileName:'evidence')+' · Original image data retained in Preserved data; not rendered in this export.</p>',markdown:'Image evidence · '+md(typeof value.caption==='string'?value.caption:'')+' · Original image data retained in Preserved data; not rendered.'};
 if(kind==='checklist'&&Array.isArray(value.items)){const items=value.items.filter(item=>item&&typeof item.text==='string');return {html:'<ul>'+items.map(item=>'<li>'+escape((item.done?'✓ ':'○ ')+item.text)+'</li>').join('')+'</ul>',markdown:items.map(item=>'- ['+(item.done?'x':' ')+'] '+md(item.text)).join('\n')};}
 if(kind==='table'&&Array.isArray(value.rows)&&value.rows.every(Array.isArray)){
  const rows=value.rows.map(row=>row.map(textValue)),columns=Math.max(0,...rows.map(row=>row.length));
  // Markdown is rectangular: a tiny jagged input could otherwise amplify to
  // rows*maxColumns work before the final byte limit. HTML keeps original rows
  // and never builds the unused padded Markdown intermediate.
  budget.cells+=format==='markdown'?rows.length*columns:rows.reduce((n,row)=>n+row.length,0);
  if(budget.cells>50000)reject('EXPORT_BUDGET');
  if(format==='html')return {html:'<table><tbody>'+rows.map((row,index)=>'<tr>'+row.map(cell=>{const tag=index===0&&value.headerRow?'th':'td';return '<'+tag+'>'+escape(cell)+'</'+tag+'>';}).join('')+'</tr>').join('')+'</tbody></table>',markdown:''};
  const lines=rows.map(row=>'| '+Array.from({length:columns},(_,i)=>md(row[i]??'')).join(' | ')+' |');
  if(lines.length)lines.splice(1,0,'| '+Array(columns).fill('---').join(' | ')+' |');
  return {html:'',markdown:lines.join('\n')};
 }
 // Structured records, future blocks and agent claims are preserved rather than
 // guessed into a new schema. This is explicit in both the reading section and archive.
 return {html:'<h3>'+escape(typeof kind==='string'?kind:'Preserved block')+'</h3><p class="notice">Structured or unrecognized content · Exact fields preserved.</p><pre>'+escape(JSON.stringify(value,null,2))+'</pre>',markdown:'### '+md(typeof kind==='string'?kind:'Preserved block')+'\n\nStructured or unrecognized content · Exact fields preserved.\n\n'+indented(JSON.stringify(value,null,2))};
}
export function formatSavedDocument(input,{diagramAssets=[]}={}){
 const data=navigationFields(input,['format','projectId','document','version','sha256','projectRevision','exportedAt']);
 if(!['json','markdown','html'].includes(data.format)||!Number.isSafeInteger(data.projectRevision)||data.projectRevision<1||typeof data.exportedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(data.exportedAt)||!Number.isFinite(Date.parse(data.exportedAt)))reject('REQUEST_REFUSED');
 const document=copy(data.document),raw=JSON.stringify(document);if(Buffer.byteLength(raw)>8*1024*1024)reject('DOCUMENT_BUDGET');
 if(digest(Buffer.from(raw))!==data.sha256||documentContentVersion(data.projectId,document)!==data.version)reject('DOCUMENT_VERSION_CHANGED');
 const embeds=(document.blocks??[]).filter(b=>b?.kind==='diagram-embed').map(normalizeDiagramEmbed),records=new Map();if(!Array.isArray(diagramAssets)||diagramAssets.length>128)reject('EXPORT_BUDGET');for(const value of diagramAssets){const record=verifyDiagramEmbedAsset(value),key=record.ref.kind+':'+record.ref.sha256;if(records.has(key))reject('DIAGRAM_EMBED_ASSET_CORRUPT');records.set(key,record);}for(const b of embeds)for(const ref of [b.snapshot.sourceAsset,b.snapshot.visualAsset]){const actual=records.get(ref.kind+':'+ref.sha256);if(!actual||actual.ref.bytes!==ref.bytes)reject('DIAGRAM_EMBED_ASSET_UNKNOWN');}
 const required=new Set(embeds.flatMap(b=>[b.snapshot.sourceAsset,b.snapshot.visualAsset]).map(r=>r.kind+':'+r.sha256));if(records.size!==required.size)reject('DIAGRAM_EMBED_ASSET_UNKNOWN');
 const expanded=[...records.values()].reduce((n,r)=>n+4*Math.ceil(r.bytes.length/3),0)+(data.format==='html'?embeds.reduce((n,b)=>n+4*Math.ceil(b.snapshot.visualAsset.bytes/3),0):0);if(expanded+Buffer.byteLength(raw)>16*1024*1024)reject('EXPORT_BUDGET');
 const archive={format:'siren-document-archive',schema:embeds.length?2:1,exporter:'SIREN saved document export v1',projectId:data.projectId,documentId:document.id,projectRevision:data.projectRevision,version:data.version,documentSha256:data.sha256,exportedAt:data.exportedAt,sourcePolicy:embeds.length?'embedded-diagram-snapshots; other links references-only':'references-only',document,...(embeds.length?{diagramAssets:[...records.values()].map(({ref,bytes})=>data.format==='markdown'?{ref,path:embedAssetPath(ref)}:{ref,base64:bytes.toString('base64')})}:{})};
 const archival=JSON.stringify(archive,null,2);let output=archival,extension='json';
 if(data.format!=='json'){
  const title=typeof document.title==='string'?document.title:'Untitled document',budget={cells:0},blocks=Array.isArray(document.blocks)?document.blocks.map(value=>value?.kind==='diagram-embed'?formatDiagramEmbed(value,records.get(value.snapshot.visualAsset.kind+':'+value.snapshot.visualAsset.sha256),{format:data.format}):block(value,data.format,budget)):[],notice=embeds.length?'Saved diagram snapshots are included. Other linked code, diagrams and documents remain references only. Exact original fields and claims are retained in Preserved data.':disclosure;
  if(data.format==='markdown'){extension='md';output='# '+md(title)+'\n\n'+notice+'\n\n'+blocks.map(b=>b.markdown).join('\n\n')+'\n\nPreserved data (JSON archive)\n\n'+indented(archival);}
  else{extension='html';const styles=css+(embeds.length?'.diagram-context{margin:24px 0}.diagram-context img{display:block;max-width:100%;max-height:900px;object-fit:contain}':'');const exportPolicy=embeds.length?policy.replace(/style-src 'sha256-[^']+'/,"style-src 'sha256-"+createHash('sha256').update(styles).digest('base64')+"'")+"; img-src data:":policy;output='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+escape(exportPolicy)+'"><title>'+escape(title)+'</title><style>'+styles+'</style></head><body><h1>'+escape(title)+'</h1><p class="notice">'+escape(notice)+'</p>'+blocks.map(b=>'<section>'+b.html+'</section>').join('')+'<details><summary>Preserved data (JSON archive)</summary><pre id="siren-archive">'+escape(archival)+'</pre></details></body></html>';}
 }
 let bytes=Buffer.from(output);if(bytes.length>16*1024*1024)reject('EXPORT_BUDGET');if(data.format==='markdown'&&embeds.length){bytes=packageDiagramMarkdown([{path:'document.md',bytes},...[...records.values()].map(({ref,bytes})=>({path:embedAssetPath(ref),bytes}))]);extension='zip';}return Object.freeze({bytes,extension});
}
