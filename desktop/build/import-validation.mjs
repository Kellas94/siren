import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { parse } from 'parse5';
import { readOwnedBytes } from '../src/projects/io.mjs';

const baselineHash='5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const domainHelper = `
        window.sirenDesktopValidateDomainPatch = ({domain,action,payload,before}) => {
          const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
          const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
          if(domain==='docs'&&action==='rename')return typeof payload.title==='string'&&payload.title.length<=160;
          if(domain==='diagram'&&['replace-source','update-model'].includes(action))return typeof payload.source==='string';
          if(domain==='docs'&&action==='replace-blocks') {
            const existing=new Set((before?.blocks||[]).map(block=>JSON.stringify(canonical(block))));
            return payload.blocks.length<=MAX_WP_BLOCKS&&payload.blocks.every(block=>{
              if(existing.has(JSON.stringify(canonical(block))))return true;
              const report=[];return same(sanitizeWorkpaperBlock(block,report),block)&&report.length===0;
            });
          }
          if(domain!=='diagram'||action!=='update-style')return false;
          const validators={nodeStyles:sanitizeNodeStyles,styleClasses:sanitizeStyleClasses,nodeClasses:sanitizeNodeClasses,edgeStyles:sanitizeEdgeStyles,edgeRoutes:sanitizeEdgeRoutes,nodeMetadata:sanitizeNodeMetadata,comments:sanitizeComments,layout:sanitizeLayout,view:sanitizeView,links:sanitizeNodeLinks,icons:sanitizeNodeIcons,rules:sanitizeFormatRules,numbering:sanitizeNumbering,legend:sanitizeLegend,gitBranchColours:sanitizeGitBranchColours,presentation:sanitizePresentation,fontFamily:normalizeFontFamily,fontWeight:normalizeFontWeight};
          return Object.entries(payload).every(([key,value])=>{
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
  const startup="document.addEventListener('DOMContentLoaded', () => {\n        sirenStore.start()";
  if(html.split(startup).length!==2)throw Error('Frozen import startup marker mismatch');
  html=html.replace(startup,()=>"document.addEventListener('DOMContentLoaded', () => {"+importHelper+domainHelper+`
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
