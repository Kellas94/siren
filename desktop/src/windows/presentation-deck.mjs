import {WindowRegistry} from './registry.mjs';
import {verifySnapshot} from '../projects/store.mjs';
import {digest} from '../projects/atomic.mjs';
import {validId} from '../projects/paths.mjs';
import {workspaceMetadata} from './entities.mjs';

const error=code=>Object.assign(Error(code),{code});
const text=(value,limit)=>typeof value==='string'&&value.isWellFormed()&&value.length<=limit;
const refuse=()=>{throw error('PRESENTATION_DECK_REFUSED');};
const styleKeys=['diagramTitle','direction','curve','fontFamily','fontSize','fontWeight','nodeStyles','styleClasses','nodeClasses','edgeStyles','edgeRoutes','gitBranchColours','legend','numbering'];
function projection(snapshot,diagramId){
 const diagrams=workspaceMetadata(snapshot).diagrams??[],matches=diagrams.filter(diagram=>diagram?.id===diagramId);if(matches.length!==1)refuse();const diagram=matches[0];
 if(typeof diagram.source!=='string'||!diagram.source.isWellFormed()||Buffer.byteLength(diagram.source)>2*1024*1024)refuse();
 const title=diagram.diagramTitle||diagram.name||'Untitled presentation';if(!text(title,256))refuse();
 const presentation=diagram.presentation??{};if(!presentation||typeof presentation!=='object'||Array.isArray(presentation)||presentation.sequence!==undefined&&!Array.isArray(presentation.sequence))refuse();
 const entries=presentation.sequence?.length?presentation.sequence:[{id:'overview',type:'overview',title}];if(entries.length>600)refuse();
 const ids=new Set(),slides=entries.map(entry=>{
  if(!entry||!validId(entry.id)||ids.has(entry.id)||!['node','overview','section','chapter','card'].includes(entry.type))refuse();ids.add(entry.id);
  if(entry.type==='node'&&(!text(entry.nodeId,128)||! /^[A-Za-z_][\w.-]*$/.test(entry.nodeId))||entry.type==='chapter'&&(!text(entry.chapterId,90)||!entry.chapterId)||entry.type==='card'&&(!entry.card||typeof entry.card!=='object'||Array.isArray(entry.card)))refuse();
  const label=entry.title||(entry.type==='node'?entry.nodeId:entry.type==='chapter'?entry.chapterId:entry.type==='overview'?'Overview':entry.type==='card'?'Content slide':'Section');if(!text(label,256))refuse();
  const noteKey=entry.type==='node'?`node:${entry.nodeId}`:entry.type==='chapter'?`chapter:${entry.chapterId}`:entry.type==='overview'?'overview':`${entry.type}:${entry.id}`;
  const note=presentation.notes?.[noteKey],notes=note?.text??'';if(!text(notes,65536))refuse();
  return {id:entry.id,title:label,notes,render:{entry:structuredClone(entry)}};
 });
 // One shared native render context, not 600 copies of a potentially large
 // diagram. Private node/agent metadata and other project entities stay out.
 const render={source:diagram.source};for(const key of styleKeys)if(Object.hasOwn(diagram,key))render[key]=structuredClone(diagram[key]);
 const deck={projectId:snapshot.project.id,deckId:diagramId,version:digest(Buffer.from(JSON.stringify(diagram))),title,slides,render};if(Buffer.byteLength(JSON.stringify(deck))>8*1024*1024)refuse();return deck;
}
/** Read-only native loader. A deck is immutable until explicit refresh; its
 * hash covers the exact selected diagram, including real presenter notes.
 * This object is private to main's transport/render adapters, never Audience. */
export class NativePresentationDecks{
 #registry;#snapshot;
 constructor({registry,snapshotFor}){if(!(registry instanceof WindowRegistry)||typeof snapshotFor!=='function')throw TypeError('NATIVE_PRESENTATION_DECK_ADAPTERS_REQUIRED');this.#registry=registry;this.#snapshot=snapshotFor;}
 async read(grant,scope){
  const current=()=>{try{return grant?.role==='presenter'&&grant.entityIds.length===1&&this.#registry.isCurrent(grant)&&grant.mainFrameUrl===`siren://app/windows/presenter.html?windowId=${grant.windowId}`&&scope?.isCurrent()===true;}catch{return false;}};
  if(!current())throw error('ACCESS_REFUSED');
  try{
   const before=verifySnapshot(await this.#snapshot(grant));if(!current()||before.project.id!==grant.projectId)throw error('ACCESS_REFUSED');
   const deck=projection(before,grant.entityIds[0]),after=verifySnapshot(await this.#snapshot(grant));if(!current()||after.project.id!==grant.projectId)throw error('ACCESS_REFUSED');
   if(before.schema!==after.schema||before.revision!==after.revision||before.sha256!==after.sha256||JSON.stringify(before.sourceRefs)!==JSON.stringify(after.sourceRefs))throw error('PRESENTATION_DECK_CHANGED');
   return deck;
  }catch(cause){throw error(!current()?'ACCESS_REFUSED':['ACCESS_REFUSED','PRESENTATION_DECK_CHANGED'].includes(cause.code)?cause.code:'PRESENTATION_DECK_REFUSED');}
 }
}
