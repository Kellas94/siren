import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { parse } from 'parse5';
import { readOwnedBytes } from '../src/projects/io.mjs';
import {buildPresentationEdits} from './document-context.mjs';
import {bundleMetadataHelper} from './source-bundle-metadata.mjs';
import {validateNativeNodeStyles} from './native-node-style-validation.mjs';

const baselineHash='5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const domainHelper = `
        window.sirenDesktopValidateDomainPatch = ({domain,action,payload,before}) => {
          const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
          const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
          if(domain==='docs'&&action==='rename')return typeof payload.title==='string'&&payload.title.length<=160;
          if(domain==='docs'&&action==='update-context'){
            return Object.entries(payload).every(([key,value])=>{
              if(key==='type')return normalizeWorkpaperType(value)===value;
              if(key==='owner')return typeof value==='string'&&value.length<=80;
              if(key==='references')return Object.entries(value).every(([operation,list])=>['add','remove'].includes(operation)&&Array.isArray(list)&&list.length<=60&&list.every(ref=>['diagram','document'].includes(ref.kind)&&typeof ref.id==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(ref.id)));
              if(key!=='agent')return false;const clean=sanitizeAgentMeta(value);
              return Object.entries(value).every(([field,v])=>['oversight','data'].includes(field)?Object.entries(v).every(([name,item])=>same(clean[field]?.[name],item)):same(clean[field],v));
            });
          }
          if(domain==='diagram'&&['replace-source','update-model'].includes(action))return typeof payload.source==='string';
          if(domain==='diagram'&&action==='edit-presentation'){
            try{return same(window.SirenPresentationEdits.applyPresentationEdits(before?.presentation,payload.edits),payload.presentation);}catch{return false;}
          }
          if(domain==='docs'&&action==='replace-blocks') {
            const existing=new Set((before?.blocks||[]).map(block=>JSON.stringify(canonical(block))));
            // Native linked rows carry immutable references that the frozen web
            // sanitizer predates. Admit only name/notes changes; everything else
            // must match the actual saved block, including every source pointer.
            const labelsOnly=block=>{
              const prior=(before?.blocks||[]).filter(item=>item?.id===block?.id);
              if(prior.length!==1||block?.kind!=='knowledge'||prior[0].kind!=='knowledge'||!Array.isArray(block.rows)||!Array.isArray(prior[0].rows)||block.rows.length!==prior[0].rows.length)return false;
              const without=(value,keys)=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));
              if(!same(without(block,['rows']),without(prior[0],['rows'])))return false;
              return block.rows.every((row,index)=>{
                const old=prior[0].rows[index];if(same(row,old))return true;
                if(!row||!old||typeof row.id!=='string'||!row.id||!same(without(row,['name','notes']),without(old,['name','notes'])))return false;
                const ref=old.sourceRef;
                if(!ref||Object.keys(ref).length!==3||typeof ref.sourceId!=='string'||!ref.sourceId||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256))return false;
                for(const key of ['name','notes'])if(Object.hasOwn(old,key)&&!Object.hasOwn(row,key)||Object.hasOwn(row,key)&&typeof row[key]!=='string')return false;
                const projected={id:block.id,kind:'knowledge',reasoningEffort:'',rows:[{name:row.name??'',fileType:'txt',role:'',notes:row.notes??'',content:'',sourceOrigin:'',confirmedAt:'',sourceId:''}]},report=[];
                return same(sanitizeWorkpaperBlock(projected,report),projected)&&report.length===0;
              });
            };
            const imageFieldsOnly=block=>{
              const matches=(before?.blocks||[]).filter(item=>item?.id===block?.id);if(matches.length!==1||block?.kind!=='image'||matches[0].kind!=='image')return false;
              const allowed=['dataUri','caption','fileName'],without=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!allowed.includes(key)));if(!same(without(block),without(matches[0])))return false;
              const projected={id:block.id,kind:'image',dataUri:block.dataUri??'',caption:block.caption??'',fileName:block.fileName??''},report=[];return same(sanitizeWorkpaperBlock(projected,report),projected)&&report.length===0;
            };
            return payload.blocks.length<=MAX_WP_BLOCKS&&payload.blocks.every(block=>{
              if(existing.has(JSON.stringify(canonical(block))))return true;
              if(labelsOnly(block)||imageFieldsOnly(block))return true;
              const report=[];return same(sanitizeWorkpaperBlock(block,report),block)&&report.length===0;
            });
          }
          if(domain!=='diagram'||action!=='update-style')return false;
          const validators={nodeStyles:sanitizeNodeStyles,styleClasses:sanitizeStyleClasses,nodeClasses:sanitizeNodeClasses,edgeStyles:sanitizeEdgeStyles,edgeRoutes:sanitizeEdgeRoutes,nodeMetadata:sanitizeNodeMetadata,comments:sanitizeComments,layout:sanitizeLayout,view:sanitizeView,links:sanitizeNodeLinks,icons:sanitizeNodeIcons,rules:sanitizeFormatRules,numbering:sanitizeNumbering,legend:sanitizeLegend,gitBranchColours:sanitizeGitBranchColours,presentation:sanitizePresentation,fontFamily:normalizeFontFamily,fontWeight:normalizeFontWeight};
          return Object.entries(payload).every(([key,value])=>{
            if(key==='nodeStyles')return (${validateNativeNodeStyles.toString()})(value,before?.nodeStyles,sanitizeNodeStyles);
            if(key==='fontSize')return Number.isFinite(value)&&value>=10&&value<=28;
            if(key==='diagramTitle')return typeof value==='string'&&value.length<=300;
            if(key==='diagramTitleTouched')return typeof value==='boolean';
            if(key==='direction')return ['TD','TB','BT','LR','RL'].includes(value);
            if(key==='curve')return ['basis','linear','cardinal','monotoneX','monotoneY','step','stepBefore','stepAfter'].includes(value);
            return typeof validators[key]==='function'&&same(validators[key](value),value);
          });
        };
`;

// Shared with the module renderer: the same frozen workpaper/signoff functions
// run in both doors. Do not replace them with migration-only JSON parsing.
export const importHelper = `
        window.sirenDesktopValidateImport = async (text, fileName) => {
          const original = parseMainImportJson(text, fileName);
          let payload = original;
          let bag = null;
          if (original?.kind === 'siren-desktop' && original.schema === 1) {
            bag = original;
            const raw = bag.storage?.[STORAGE_KEY];
            if (typeof raw !== 'string') throw new Error('Backup has no workspace');
            const importedState = parseMainImportJson(raw, fileName);
            payload = {type:PROJECT_TYPE,version:importedState.version || APP_VERSION,state:importedState};
          } else if (!original.state && (Array.isArray(original.diagrams) || original.source)) {
            throw new Error('Import a complete .siren export, rather than an internal workspace cache');
          }
          if (payload.type === 'siren-project') payload = {...payload,type:PROJECT_TYPE};
          const clean = await validatePortableProjectForImport(payload, fileName);
          const workpapers = prepareProjectWorkpapers(clean.state.workpapers, fileName);
          workpapers.forEach(doc => stampWorkpaperFileSignoff(doc, workpaperProjectReviewInput.get(doc)));
          const importedState = {...clean.state,workpapers};
          return JSON.stringify(bag ? {...bag,storage:{...bag.storage,[STORAGE_KEY]:JSON.stringify(importedState)}} : {...clean,state:importedState});
        };
    `;

/** Isolated, hidden on-demand validation entry. Retain the complete frozen
 * dependency closure while disabling workspace startup. Never loaded by Home. */
export async function buildImportValidation({baselinePath,outputDir}) {
  const bytes=await readFile(baselinePath);
  if(digest(bytes)!==baselineHash)throw Error('Frozen import baseline SHA-256 mismatch');
  let html=bytes.toString('utf8');
  const presentationEdits=await buildPresentationEdits();
  const startup="document.addEventListener('DOMContentLoaded', () => {\n        sirenStore.start()";
  if(html.split(startup).length!==2)throw Error('Frozen import startup marker mismatch');
  html=html.replace(startup,()=>"document.addEventListener('DOMContentLoaded', () => {"+presentationEdits+importHelper+domainHelper+bundleMetadataHelper+`
        if (!window.mermaid || typeof window.mermaid.parse !== 'function') throw new Error('Embedded import engine unavailable');
        window.mermaid.initialize({startOnLoad:false,securityLevel:'strict'});
        rendererMode = 'mermaid';
        window.sirenImportValidationReady = true;
        return;
        sirenStore.start()`);
  const nodes=[];const visit=node=>{nodes.push(node);for(const child of node.childNodes||[])visit(child);};visit(parse(html,{sourceCodeLocationInfo:true}));
  const scripts=nodes.filter(node=>node.tagName==='script');
  if(!scripts.length || scripts.some(node=>node.attrs.some(attr=>attr.name==='src')))throw Error('Unexpected import script');
  const hashes=[];
  for(const script of scripts) {
    const text=script.childNodes.map(child=>child.value||'').join('');new Script(text);
    hashes.push("'sha256-"+createHash('sha256').update(text).digest('base64')+"'");
  }
  const metas=nodes.filter(node=>node.tagName==='meta' && node.attrs.some(attr=>attr.name==='http-equiv' && attr.value.toLowerCase()==='content-security-policy'));
  if(metas.length!==1)throw Error('Frozen import CSP marker mismatch');
  const csp=`default-src 'none'; script-src ${[...new Set(hashes)].join(' ')}; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src data:; worker-src blob:; base-uri 'none'; form-action 'none'; object-src 'none';`;
  const location=metas[0].sourceCodeLocation;
  html=html.slice(0,location.startOffset)+`<meta http-equiv="Content-Security-Policy" content="${csp}" />`+html.slice(location.endOffset);
  await mkdir(outputDir,{recursive:true});
  // New output only: an existing entry or hard-link is never overwritten.
  const path=join(outputDir,'import-validation.html');
  try {await writeFile(path,html,{encoding:'utf8',flag:'wx'});}
  catch(cause) {
    if(cause.code!=='EEXIST' || !(await readOwnedBytes(path,32*1024*1024)).equals(Buffer.from(html)))throw Error('Existing import validation entry differs; use a fresh build directory');
  }
  return {schema:1,baselineSha256:baselineHash,entrySha256:digest(Buffer.from(html)),scriptCount:scripts.length};
}
