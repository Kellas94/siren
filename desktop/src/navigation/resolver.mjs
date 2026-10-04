import { verifySnapshot } from '../projects/store.mjs';
import { validId } from '../projects/paths.mjs';
import { workspaceEntities, workspaceMetadata } from '../windows/entities.mjs';
import { restoreBounds } from '../windows/geometry.mjs';
import { normalizeLocation } from './contracts.mjs';

const refused=code=>({ok:false,code});
const relative=value=>{const {schema,projectId,...input}=value;return input;};

/** Resolves a location against a verified chosen snapshot and exact retained
 * source versions. Never saves content, creates a view, or grants read access. */
export function createLocationResolver({sources,displays}) {
  return async ({projectId,snapshot,location:input,isCurrent}) => {
    const live=()=>{try{return isCurrent()===true;}catch{return false;}};
    try {
      if(!live())return refused('ACCESS_REFUSED');
      verifySnapshot(snapshot);
      if(snapshot.project.id!==projectId)return refused('PROJECT_UNAVAILABLE');
      const normalized=normalizeLocation(input,{projectId});
      const location=relative(normalized),metadata=workspaceMetadata(snapshot),roster=workspaceEntities(snapshot);
      const diagrams=Array.isArray(metadata.diagrams)?metadata.diagrams.filter(item=>item && validId(item.id)):[];
      const ids={diagrams:diagrams.map(item=>item.id),docs:roster.docs,code:roster.code,present:diagrams.map(item=>item.id)};
      const hasEntity=(surface,id)=>ids[surface].includes(id);
      if(location.entityId!==undefined && !hasEntity(location.surface,location.entityId))return refused('ENTITY_UNAVAILABLE');
      if(location.surface!=='code' && (location.sourceRef!==undefined || location.cursor!==undefined))return refused('INVALID_NAVIGATION');
      if(location.surface==='code') {
        if(location.entityId===undefined) {
          if(location.sourceRef!==undefined || location.cursor!==undefined)return refused('INVALID_NAVIGATION');
        } else {
          const ref=location.sourceRef;
          if(ref===undefined)return refused('SOURCE_VERSION_UNAVAILABLE');
          if(ref.sourceId!==location.entityId)return refused('SOURCE_VERSION_UNAVAILABLE');
          let metrics;
          try {metrics=await sources.getMetrics({projectId,sourceId:ref.sourceId,version:ref.version});}
          catch {return refused(live()?'SOURCE_VERSION_UNAVAILABLE':'ACCESS_REFUSED');}
          if(!live())return refused('ACCESS_REFUSED');
          if(metrics.sourceId!==ref.sourceId || metrics.version!==ref.version || metrics.sha256!==ref.sha256)return refused('SOURCE_VERSION_UNAVAILABLE');
          if(location.cursor && (metrics.encoding!=='utf8' || !Number.isSafeInteger(metrics.utf16Units) || location.cursor.anchor>metrics.utf16Units || location.cursor.head>metrics.utf16Units))return refused('INVALID_NAVIGATION');
          location.sourceRef=ref;
        }
      }
      if(location.layouts) {
        const currentDisplays=displays();
        const layouts=[];
        for(const layout of location.layouts) {
          const surface={diagram:'diagrams',docs:'docs',code:'code',presenter:'present',audience:'present'}[layout.role];
          if(!hasEntity(surface,layout.entityId))return refused('ENTITY_UNAVAILABLE');
          if(layout.role==='code' && layout.version!==undefined) {
            try {await sources.getMetrics({projectId,sourceId:layout.entityId,version:layout.version});}
            catch {return refused(live()?'SOURCE_VERSION_UNAVAILABLE':'ACCESS_REFUSED');}
            if(!live())return refused('ACCESS_REFUSED');
          }
          layouts.push({...layout,...restoreBounds(layout,currentDisplays)});
        }
        location.layouts=layouts;
      }
      return live()?{ok:true,location}:refused('ACCESS_REFUSED');
    } catch(cause) {
      if(!live())return refused('ACCESS_REFUSED');
      return refused(['INVALID_NAVIGATION','NAVIGATION_LIMIT'].includes(cause.code)?cause.code:'PROJECT_UNAVAILABLE');
    }
  };
}
