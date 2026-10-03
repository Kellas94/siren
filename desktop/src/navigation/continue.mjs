const refused=code=>({ok:false,code});

/** Native continuation orchestration. Resolve before retiring the old project;
 * after selection only its genuine private receipt permits opening a view.
 * No renderer receives a fresh authority, source text or project snapshot. */
export async function continueSavedLocation({scope,location,projects,resolveEntity,selectedProjectId,selectProject,selectionIsCurrent,openView,navigateDiagrams}) {
 try {
  if(!location)return refused('ENTITY_UNAVAILABLE');
  if(!scope.isCurrent())return refused('ACCESS_REFUSED');
  if(location.surface==='diagrams')return location.projectId===selectedProjectId()?navigateDiagrams(scope):selectProject({projectId:location.projectId},scope);
  if(!['code','docs'].includes(location.surface))return refused('UNAVAILABLE');
  let snapshot;try{snapshot=await projects.readProject(location.projectId);}catch{return refused(scope.isCurrent()?'PROJECT_UNAVAILABLE':'ACCESS_REFUSED');}
  if(!scope.isCurrent())return refused('ACCESS_REFUSED');
  const {schema,projectId,...relative}=location;
  const resolved=await resolveEntity({projectId,snapshot,location:relative,isCurrent:scope.isCurrent});
  if(!scope.isCurrent())return refused('ACCESS_REFUSED');
  if(!resolved.ok)return resolved;
  if(!resolved.location.entityId)return refused('ENTITY_UNAVAILABLE');
  if(location.surface==='code'&&!snapshot.sourceRefs?.some(ref=>ref.sourceId===location.entityId&&ref.version===location.sourceRef?.version&&ref.sha256===location.sourceRef?.sha256))return refused('SOURCE_VERSION_UNAVAILABLE');
  const crossProject=projectId!==selectedProjectId();let receipt;
  if(crossProject){
   receipt=await selectProject({projectId},scope);
   if(!receipt?.ok)return receipt??refused('TRANSITION_FAILED');
   if(!selectionIsCurrent(scope.transition,receipt)||selectedProjectId()!==projectId)return refused('ACCESS_REFUSED');
  }
  const current=()=>crossProject?selectionIsCurrent(scope.transition,receipt)&&selectedProjectId()===projectId:scope.isCurrent();
  if(!current())return refused('ACCESS_REFUSED');
  const result=await openView({role:location.surface,entityId:resolved.location.entityId,...(resolved.location.sourceRef?{version:resolved.location.sourceRef.version}:{})});
  if(!current())return refused('ACCESS_REFUSED');
  if(!result?.ok)return result??refused('ENTITY_UNAVAILABLE');
  return crossProject?receipt:{ok:true,epoch:result.view.epoch};
 }catch{return refused('HOME_OPERATION_FAILED');}
}
