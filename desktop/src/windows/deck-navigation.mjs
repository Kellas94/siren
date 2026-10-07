import{navigationFields}from'../navigation/contracts.mjs';import{workspaceMetadata,validEntityId}from'./entities.mjs';import{digest}from'../projects/atomic.mjs';
const fail=code=>({ok:false,code}),hash=v=>digest(Buffer.from(JSON.stringify(v)));
/** Finite native routes. A Presenter can edit only its own saved deck; a
 * Diagram can play only its genuinely saved version. No content is transported. */
export class NativeDeckNavigation{
 #registry;#snapshot;#canOpen;#canEdit;#edit;#show;
 constructor({registry,snapshotFor,canOpen,canEdit,openEdit,show}){if(![snapshotFor,canOpen,canEdit,openEdit,show].every(v=>typeof v==='function')||!['capture','capturePrimary','isCurrent','openView','discardViewAsync'].every(k=>typeof registry?.[k]==='function'))throw TypeError('DECK_NAVIGATION_ADAPTERS_REQUIRED');this.#registry=registry;this.#snapshot=snapshotFor;this.#canOpen=canOpen;this.#canEdit=canEdit;this.#edit=openEdit;this.#show=show;}
 async invoke({event,method,payload}){
  let opened;
  try{const native=this.#registry.capture(event),g=native??this.#registry.capturePrimary(event);if(!g||!this.#registry.isCurrent(g)||!this.#canOpen(g))return fail('ACCESS_REFUSED');let p;try{p=navigationFields(payload??{},method==='edit'?(g.role==='workspace'?['entityId']:[]):method==='play'?['expectedVersion','expectedSha256']:['invalid'],method==='edit'?(g.role==='workspace'?['entityId']:[]):method==='play'?['expectedVersion','expectedSha256']:['invalid']);}catch{return fail('REQUEST_REFUSED');}
   if(method==='edit'&&!['workspace','presenter'].includes(g.role)||method==='play'&&g.role!=='diagram'||!['edit','play'].includes(method))return fail('REQUEST_REFUSED');const entityId=g.role==='workspace'?p.entityId:g.entityIds?.length===1?g.entityIds[0]:null;if(!validEntityId(entityId))return fail('REQUEST_REFUSED');
   if(g.role==='workspace'&&!['siren://app/home.html','siren://app/app.html'].includes(g.mainFrameUrl)||g.role!=='workspace'&&g.mainFrameUrl!==`siren://app/windows/${g.role}.html?windowId=${g.windowId}`)return fail('ACCESS_REFUSED');
   const snapshot=this.#snapshot(g),matches=(workspaceMetadata(snapshot).diagrams??[]).filter(v=>v.id===entityId);if(snapshot.project.id!==g.projectId||matches.length!==1)return fail('ENTITY_REFUSED');const diagram=matches[0],sha256=hash(diagram);
   if(method==='play'&&(!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<1||typeof p.expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(p.expectedSha256)))return fail('REQUEST_REFUSED');if(method==='play'&&(p.expectedVersion!==(diagram.sirenNativeVersion??1)||p.expectedSha256!==sha256))return fail('DIAGRAM_VERSION_CHANGED');if(method==='edit'&&!this.#canEdit(g))return fail('ACCESS_REFUSED');
   const current=()=>{const now=g.role==='workspace'?this.#registry.capturePrimary(event):this.#registry.capture(event);if(!now||now.windowId!==g.windowId||now.epoch!==g.epoch||!this.#registry.isCurrent(g)||!this.#canOpen(g)||method==='edit'&&!this.#canEdit(g))return false;const s=this.#snapshot(g),list=(workspaceMetadata(s).diagrams??[]).filter(v=>v.id===entityId);return s.project.id===g.projectId&&list.length===1&&hash(list[0])===sha256;};
   if(method==='edit')return await this.#edit(g,{entityId},{isCurrent:current});
   opened=await this.#registry.openView({role:'presenter',entityId});if(!current())throw Error('Retired');this.#show(opened);return {ok:true,view:{windowId:opened.windowId,role:opened.role,entityId:opened.entityId,epoch:opened.epoch}};
  }catch{if(opened&&!await this.#registry.discardViewAsync(opened.windowId))return fail('WINDOW_DESTROY_FAILED');return fail('ACCESS_REFUSED');}
 }
}
