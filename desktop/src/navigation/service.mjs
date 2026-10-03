import { normalizeLocation } from './contracts.mjs';

const refused = code => ({ok:false,code});
const accessError = () => Object.assign(new Error('Home access changed'), {code:'ACCESS_REFUSED'});
function relative(location) {
  const {schema,projectId,...input}=location;
  return input;
}
function sameSource(first,second) {
  return first===undefined && second===undefined || first!==undefined && second!==undefined &&
    first.sourceId===second.sourceId && first.version===second.version && first.sha256===second.sha256;
}

/** Native service boundary. Catalog metadata does not verify content or grant
 * source access. Domain resolution is required before recording an entity. */
export class HomeService {
  constructor({navigation,catalog,projects,resolveEntity,selection,clock=()=>new Date().toISOString()}) {
    Object.assign(this,{navigation,catalog,projects,resolveEntity,selection,clock});
  }
  current(scope,{write=false}={}) {
    try {
      const state=this.selection.state();
      return scope.isCurrent()===true && state.projectId===scope.projectId && state.mode===scope.mode &&
        (!write || scope.projectId!==null && !state.readonly && state.mode==='normal');
    } catch {return false;}
  }
  guard(scope,options) {if(!this.current(scope,options))throw accessError();}
  async getHomeState(input,scope) {
    this.guard(scope);
    const record=await this.navigation.read();this.guard(scope);
    const projects=await this.catalog.list(record);this.guard(scope);
    const state=this.selection.state();
    const entry=[...record.entries].sort((a,b)=>b.visitedAt.localeCompare(a.visitedAt)).find(entry=>projects.some(project=>project.projectId===entry.projectId));
    const project=entry && projects.find(project=>project.projectId===entry.projectId);
    return {
      mode:state.mode,selectedProjectId:state.projectId,projects,
      continuation:entry ? {location:entry.location,availability:project.availability==='missing'?'missing':'cached',...(project.availability==='missing'?{reason:'PROJECT_UNAVAILABLE'}:{})} : null,
      views:structuredClone(state.views),capabilities:structuredClone(state.capabilities)
    };
  }
  async recordLocation(input,scope) {
    try {
      this.guard(scope,{write:true});
      const location=normalizeLocation(input,{projectId:scope.projectId});
      let snapshot;
      try {snapshot=await this.projects.readProject(scope.projectId);}catch {this.guard(scope,{write:true});return refused('PROJECT_UNAVAILABLE');}
      this.guard(scope,{write:true});
      const result=await this.resolveEntity({projectId:scope.projectId,snapshot,location:structuredClone(relative(location)),purpose:'record',isCurrent:()=>this.current(scope,{write:true})});
      this.guard(scope,{write:true});
      if(result?.ok!==true)return refused(['ENTITY_UNAVAILABLE','SOURCE_VERSION_UNAVAILABLE'].includes(result?.code)?result.code:'ENTITY_UNAVAILABLE');
      const resolved=normalizeLocation(result.location,{projectId:scope.projectId});
      if(!sameSource(location.sourceRef,resolved.sourceRef))return refused('SOURCE_VERSION_UNAVAILABLE');
      if(location.surface!==resolved.surface || location.entityId!==resolved.entityId)return refused('ENTITY_UNAVAILABLE');
      const receipt=await this.navigation.record({projectId:scope.projectId,label:snapshot.project.label,location:relative(resolved),visitedAt:this.clock()}, {isCurrent:()=>this.current(scope,{write:true})});
      this.guard(scope,{write:true});return receipt;
    } catch(cause) {return refused(['ACCESS_REFUSED','INVALID_NAVIGATION','NAVIGATION_LIMIT'].includes(cause.code)?cause.code:'NAVIGATION_WRITE_FAILED');}
  }
}
