(() => {
 'use strict';
 const same=(a,b)=>a&&b&&a.sourceId===b.sourceId&&a.version===b.version&&a.sha256===b.sha256;
 window.SirenNativeAnalysis=Object.freeze({create({button,panel,editorFor,bridge}){
  let disposed=false,paused=false,generation=0,active=null,cancelling=null,result=null,bound=null,page=0;
  const make=(tag,text,id)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(id)e.id=id;return e;};
  const title=make('h2','Source structure'),description=make('p','Classes and functions from the stored Python source. Static analysis does not run the code.'),controls=make('div'),scope=make('select',null,'analysisScope');
  scope.setAttribute('aria-label','Analysis range');for(const [value,label] of [['source','Source overview'],['selection','Selected code']]){const option=make('option',label);option.value=value;scope.append(option);}
  const run=make('button','Analyze','analyzeSource'),cancel=make('button','Cancel','cancelAnalysis'),message=make('p','Choose Analyze to inspect this version.','analysisStatus'),filter=make('input',null,'analysisFilter'),list=make('div',null,'analysisDefinitions'),paging=make('div'),previous=make('button','Previous'),next=make('button','Next');
  for(const b of [run,cancel,previous,next])b.type='button';cancel.hidden=true;filter.type='search';filter.placeholder='Find a class or function';filter.maxLength=128;filter.setAttribute('aria-label','Filter source definitions');message.setAttribute('role','status');list.setAttribute('aria-label','Source definitions');controls.className='analysis-controls';paging.className='analysis-paging';controls.append(scope,run,cancel);paging.append(previous,next);panel.append(title,description,controls,message,filter,list,paging);panel.hidden=true;
  const state=()=>editorFor()?.getStatus(),ready=value=>value?.ready&&!value.paused&&!value.fenced&&!value.pending&&!value.saving&&!value.dirty&&!disposed&&!paused;
  const clearResult=()=>{result=null;bound=null;list.replaceChildren();filter.hidden=true;previous.hidden=next.hidden=true;};
  const cancelActive=()=>{generation++;const job=active;active=null;cancel.hidden=true;if(job){const pending=Promise.resolve().then(()=>bridge.cancel({jobId:job.id})).catch(()=>{}).finally(()=>{if(cancelling===pending)cancelling=null;if(!disposed&&!paused)reconcile();});cancelling=pending;}};
  function paint(){
   list.replaceChildren();const defs=result?.result?.definitions??[],query=filter.value.toLocaleLowerCase(),rows=defs.filter(def=>def.name.toLocaleLowerCase().includes(query));page=Math.min(page,Math.max(0,Math.ceil(rows.length/64)-1));
   for(const def of rows.slice(page*64,(page+1)*64)){
    const item=make('button');item.type='button';item.className='analysis-definition';item.dataset.definitionFrom=String(def.nameFrom);const label=make('strong',def.name),caption=make('span',`${def.async?'Async ':''}${def.kind} · line ${def.line}${def.parent!==null?' · nested':''}`);item.append(label,caption);
    item.addEventListener('click',()=>{const editor=editorFor(),value=state();if(!ready(value)||!same(value.sourceRef,bound))return;const length=editor.getState().doc.length;if(def.nameFrom<0||def.nameTo>length)return;editor.select(def.nameFrom,def.nameTo);});list.append(item);
   }
   filter.hidden=!result;previous.hidden=next.hidden=rows.length<=64;previous.disabled=page===0;next.disabled=(page+1)*64>=rows.length;
  }
  function reconcile(){
   if(disposed)return;const value=state();run.disabled=!ready(value)||Boolean(active)||Boolean(cancelling);scope.disabled=Boolean(active)||Boolean(cancelling)||paused;
   if((active||result)&&(!ready(value)||!same(value?.sourceRef,active?.ref??bound))){cancelActive();clearResult();message.textContent='Source changed. Save it, then analyze the current version.';}
   if(!active&&!result&&!ready(value))message.textContent=value?.dirty||value?.pending?'Save source before analyzing this version.':'Source is not ready for analysis.';
  }
  async function analyze(){
   const editor=editorFor(),value=state();if(!ready(value)||active||cancelling)return;const ref=value.sourceRef,selection=editor.getState().selection.main;
   if(scope.value==='selection'&&selection.from===selection.to){message.textContent='Select a code range in the editor first.';return;}
   const token=++generation,id=crypto.randomUUID(),range=scope.value==='selection'?{from:selection.from,to:selection.to}:undefined;
   clearResult();active={id,ref};run.disabled=true;cancel.hidden=false;scope.disabled=true;message.textContent='Analyzing in the background…';panel.dataset.analysisState='running';
   try{
    const answer=await bridge.submit({...ref,kind:'index',jobId:id,...(range?{range}:{})});
    if(token!==generation||disposed||paused||!ready(state())||!same(state().sourceRef,ref))return;
    if(answer?.ok!==true||!['complete','partial'].includes(answer.status)||!answer.result||!answer.coverage){message.textContent=answer?.status==='budget-exceeded'?'Analysis reached its time or memory budget. Select a smaller range to inspect.':answer?.status==='cancelled'?'Analysis cancelled.':'Analysis unavailable. Stored source was retained.';panel.dataset.analysisState=answer?.status??'error';return;}
    if(answer.sourceId!==ref.sourceId||answer.version!==ref.version||answer.jobId!==id){message.textContent='Analysis version changed. Analyze again.';return;}
    result=answer;bound=ref;page=0;filter.value='';paint();panel.dataset.analysisState=answer.status;
    const coverage=answer.coverage;message.textContent=`${answer.result.definitions.length.toLocaleString()} definitions · version ${ref.version} · ${answer.status==='complete'?'Complete range':'Partial analysis'} · characters ${coverage.from.toLocaleString()}–${coverage.to.toLocaleString()} of ${coverage.totalUnits.toLocaleString()}${coverage.syntaxErrors?' · syntax errors found':''}${coverage.limited?' · index limit reached':''}`;
   }catch{if(token===generation&&!disposed&&!paused){message.textContent='Analysis unavailable. Stored source was retained.';panel.dataset.analysisState='error';}}
   finally{if(token===generation&&!disposed){active=null;cancel.hidden=true;reconcile();}}
  }
  const toggle=()=>{if(paused||disposed)return;panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));document.getElementById('codeLayout')?.classList.toggle('has-analysis',!panel.hidden);if(!panel.hidden){reconcile();run.focus();}};
  button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panel.id);button.addEventListener('click',toggle);run.addEventListener('click',()=>void analyze());cancel.addEventListener('click',()=>{cancelActive();clearResult();message.textContent='Analysis cancelled.';panel.dataset.analysisState='cancelled';reconcile();});filter.addEventListener('input',()=>{page=0;paint();});previous.addEventListener('click',()=>{page--;paint();});next.addEventListener('click',()=>{page++;paint();});
  const shortcut=event=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='o'){event.preventDefault();toggle();}};document.addEventListener('keydown',shortcut);clearResult();reconcile();
  return Object.freeze({reconcile,reset(){cancelActive();clearResult();panel.dataset.analysisState='idle';reconcile();},pause(){paused=true;cancelActive();clearResult();},resume(){paused=false;reconcile();},dispose(){disposed=true;cancelActive();clearResult();document.removeEventListener('keydown',shortcut);button.removeEventListener('click',toggle);}});
 }});
})();
