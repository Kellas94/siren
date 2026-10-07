(() => {
 'use strict';
 const same=(a,b)=>a&&b&&a.sourceId===b.sourceId&&a.version===b.version&&a.sha256===b.sha256;
 const explanations={selection:'The selected stored code range.',class:'Groups related data and behavior.',function:'Defines a reusable block of code.',loop:'Repeats a block of code.',branch:'Selects a branch using a condition.',call:'A call expression; its runtime target and result are not evaluated.',assignment:'Stores a value in a name or attribute.',annotation:'Adds a type annotation without assigning a value here. Static analysis does not check runtime types.',return:'Returns a result from the current function.',yield:'Produces a value from a generator.',try:'Groups error-handling clauses.',match:'Matches a value against patterns.',with:'Uses a managed context.',raise:'Raises an exception.',await:'Waits for an asynchronous result.',lambda:'Creates an anonymous function.',break:'Exits the enclosing loop.',continue:'Moves to the next loop iteration.'};
 window.SirenNativeAnalysis=Object.freeze({create({button,compareButton,panel,editorFor,bridge,languageFor=()=> 'python',nameFor=()=>null}){
  let disposed=false,paused=false,generation=0,choiceGeneration=0,active=null,cancelling=null,result=null,bound=null,page=0,choices=[],refreshing=false;const collapsed=new Set();
  const make=(tag,text,id)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(id)e.id=id;return e;};
  const title=make('h2','Source structure'),description=make('p','Classes and functions from the stored Python source. Static analysis does not run the code.'),controls=make('div'),scope=make('select',null,'analysisScope');
  scope.setAttribute('aria-label','Analysis range');for(const [value,label] of [['source','Source overview'],['selection','Selected code'],['map','Selected code map'],['compare','Compare sources']]){const option=make('option',label);option.value=value;scope.append(option);}
  const compareControls=make('div'),compareWindow=make('select',null,'analysisCompareWindow'),refresh=make('button','Refresh windows','refreshAnalysisWindows'),identity=make('details',null,'analysisIdentity');refresh.type='button';compareWindow.setAttribute('aria-label','Stored source B in another Code window');compareControls.className='analysis-controls';compareControls.append(compareWindow,refresh);compareControls.hidden=true;
  const run=make('button','Analyze','analyzeSource'),cancel=make('button','Cancel','cancelAnalysis'),message=make('p','Choose Analyze to inspect this version.','analysisStatus'),filter=make('input',null,'analysisFilter'),list=make('div',null,'analysisDefinitions'),paging=make('div'),previous=make('button','Previous'),next=make('button','Next');
  for(const b of [run,cancel,previous,next])b.type='button';cancel.hidden=true;filter.type='search';filter.placeholder='Find a class or function';filter.maxLength=128;filter.setAttribute('aria-label','Filter source definitions');message.setAttribute('role','status');list.setAttribute('aria-label','Source definitions or comparison hunks');controls.className='analysis-controls';paging.className='analysis-paging';controls.append(scope,run,cancel);paging.append(previous,next);panel.append(title,description,controls,compareControls,message,identity,filter,list,paging);panel.hidden=true;
  const state=()=>editorFor()?.getStatus(),ready=value=>value?.ready&&!value.paused&&!value.fenced&&!value.pending&&!value.saving&&!value.dirty&&!disposed&&!paused;
  const clearResult=()=>{result=null;bound=null;collapsed.clear();identity.textContent='';identity.hidden=true;list.replaceChildren();filter.hidden=true;previous.hidden=next.hidden=true;};
  const choice=()=>choices.find(item=>item.windowId===compareWindow.value);
  async function refreshChoices(){
   if(disposed||paused||active||cancelling)return;const token=++choiceGeneration,ref=state()?.sourceRef;refreshing=true;reconcile();
   try{const answer=await bridge.listComparisons({});if(token!==choiceGeneration||disposed||paused||!same(ref,state()?.sourceRef))return;
    choices=answer?.ok===true&&Array.isArray(answer.items)?answer.items.slice(0,64):[];compareWindow.replaceChildren();
    for(const item of choices){const option=make('option',`${item.displayName?item.displayName+' · ':''}${item.sourceRef.sourceId.slice(0,8)} · v${item.sourceRef.version} · ${item.sourceRef.sha256.slice(0,8)}`);option.value=item.windowId;compareWindow.append(option);}
    if(!choices.length)message.textContent='Open another stored source or version in a Code window to compare.';
   }catch{if(token===choiceGeneration){choices=[];compareWindow.replaceChildren();message.textContent='Code windows are unavailable. Refresh to try again.';}}
   finally{if(token===choiceGeneration){refreshing=false;reconcile();}}
  }
  const cancelActive=()=>{generation++;const job=active;active=null;cancel.hidden=true;if(job){const pending=Promise.resolve().then(()=>bridge.cancel({jobId:job.id})).catch(()=>{}).finally(()=>{if(cancelling===pending)cancelling=null;if(!disposed&&!paused)reconcile();});cancelling=pending;}};
  function paint(){
   if(result?.result?.semantics==='syntax-containment'){
    list.replaceChildren();const nodes=result.result.nodes,byId=new Map(nodes.map(node=>[node.id,node]));
    list.setAttribute('role','tree');
    for(const node of nodes){
     let ancestor=byId.get(node.parent),depth=0,hidden=false;while(ancestor){depth++;if(collapsed.has(ancestor.id)){hidden=true;break;}ancestor=byId.get(ancestor.parent);}if(hidden)continue;
     const row=make('div');row.className='analysis-map-node';row.dataset.mapDepth=String(Math.min(depth,6));row.dataset.mapKind=node.kind;const select=make('button');select.type='button';select.dataset.mapNodeId=String(node.id);select.className='analysis-map-select';select.title=`${node.label}\n${explanations[node.kind]??'A syntax block from the selected code.'}`;
     select.append(make('strong',node.label),make('span',`${node.kind} · line ${node.line}`));select.addEventListener('click',()=>{const editor=editorFor();if(!ready(state())||!same(state().sourceRef,bound)||node.from<0||node.to>editor.getState().doc.length)return;editor.select(node.from,node.to);});
     if(nodes.some(child=>child.parent===node.id)){const fold=make('button',collapsed.has(node.id)?'▸':'▾');fold.type='button';fold.dataset.collapseId=String(node.id);fold.className='analysis-map-fold';fold.setAttribute('aria-label',`${collapsed.has(node.id)?'Expand':'Collapse'} ${node.label}`);fold.setAttribute('aria-expanded',String(!collapsed.has(node.id)));fold.addEventListener('click',()=>{if(collapsed.has(node.id))collapsed.delete(node.id);else collapsed.add(node.id);paint();});row.append(fold);}
     row.append(select);list.append(row);
    }
    filter.hidden=previous.hidden=next.hidden=true;return;
   }
   list.setAttribute('role','list');
   if(result?.rightRef){
    list.replaceChildren();const hunks=result.result.hunks??[];page=Math.min(page,Math.max(0,Math.ceil(hunks.length/64)-1));
    for(const hunk of hunks.slice(page*64,(page+1)*64)){
     const item=make('section');item.className='analysis-hunk';const a=make('strong',`A · lines ${hunk.left.fromLine}–${hunk.left.toLine}`),before=make('pre',hunk.left.preview||'(empty)'),b=make('strong',`B · lines ${hunk.right.fromLine}–${hunk.right.toLine}`),after=make('pre',hunk.right.preview||'(empty)'),show=make('button','Show in A');show.type='button';show.dataset.hunkFrom=String(hunk.left.from);
     show.addEventListener('click',()=>{const editor=editorFor();if(!ready(state())||!same(state().sourceRef,bound)||hunk.left.from<0||hunk.left.to>editor.getState().doc.length)return;editor.select(hunk.left.from,hunk.left.to);});
     if(hunk.approximate)item.append(make('span','Approximate region'));item.append(a,before,b,after,show);list.append(item);
    }
    filter.hidden=true;previous.hidden=next.hidden=hunks.length<=64;previous.disabled=page===0;next.disabled=(page+1)*64>=hunks.length;return;
   }
   list.replaceChildren();const defs=result?.result?.definitions??[],query=filter.value.toLocaleLowerCase(),rows=defs.filter(def=>def.name.toLocaleLowerCase().includes(query));page=Math.min(page,Math.max(0,Math.ceil(rows.length/64)-1));
   for(const def of rows.slice(page*64,(page+1)*64)){
    const item=make('button');item.type='button';item.className='analysis-definition';item.dataset.definitionFrom=String(def.nameFrom);const label=make('strong',def.name),caption=make('span',`${def.async?'Async ':''}${def.kind} · line ${def.line}${def.parent!==null?' · nested':''}`);item.append(label,caption);
    item.addEventListener('click',()=>{const editor=editorFor(),value=state();if(!ready(value)||!same(value.sourceRef,bound))return;const length=editor.getState().doc.length;if(def.nameFrom<0||def.nameTo>length)return;editor.select(def.nameFrom,def.nameTo);});list.append(item);
   }
   filter.hidden=!result;previous.hidden=next.hidden=rows.length<=64;previous.disabled=page===0;next.disabled=(page+1)*64>=rows.length;
  }
  function reconcile(){
   if(disposed)return;const value=state(),busy=Boolean(active)||Boolean(cancelling)||refreshing;run.disabled=!ready(value)||busy||(scope.value==='compare'?!choice():languageFor()!=='python');scope.disabled=busy||paused;refresh.disabled=compareWindow.disabled=busy||paused;if(compareButton)compareButton.disabled=busy||!ready(value);cancel.hidden=false;cancel.textContent=active?'Cancel':'Clear';cancel.disabled=Boolean(cancelling)||paused||(!active&&!result);
   if((active||result)&&(!ready(value)||!same(value?.sourceRef,active?.ref??bound))){cancelActive();clearResult();message.textContent='Source changed. Save it, then analyze the current version.';}
   if(!active&&!result&&!ready(value))message.textContent=value?.dirty||value?.pending?'Save source before analyzing this version.':'Source is not ready for analysis.';
   else if(!active&&!result&&scope.value!=='compare'&&languageFor()!=='python')message.textContent='Structure and code maps require owner-recorded Python. This source uses plain text; saved-source comparison remains available.';
  }
  async function analyze(){
   const editor=editorFor(),value=state();if(!ready(value)||active||cancelling||refreshing)return;const ref=value.sourceRef,selection=editor.getState().selection.main,right=scope.value==='compare'?choice():null;
   if(scope.value!=='compare'&&languageFor()!=='python'){reconcile();return;}
   if(scope.value==='compare'&&!right){message.textContent='Open another Code window, then refresh the window list.';return;}
   if(['selection','map'].includes(scope.value)&&selection.from===selection.to){message.textContent='Select a code range in the editor first.';return;}
   const map=scope.value==='map',token=++generation,id=crypto.randomUUID(),range=['selection','map'].includes(scope.value)?{from:selection.from,to:selection.to}:undefined;
   clearResult();active={id,ref};reconcile();message.textContent='Analyzing in the background…';panel.dataset.analysisState='running';
   try{
    const answer=await bridge.submit({...ref,kind:right?'diff':map?'map':'index',jobId:id,...(range?{range}:{}),...(right?{rightWindowId:right.windowId,rightRef:right.sourceRef}:{})});
    if(token!==generation||disposed||paused||!ready(state())||!same(state().sourceRef,ref))return;
    if(answer?.ok!==true||!['complete','partial'].includes(answer.status)||!answer.result||!answer.coverage){message.textContent=answer?.status==='budget-exceeded'?'Analysis reached its time or memory budget. Select a smaller range to inspect.':answer?.status==='cancelled'?'Analysis cancelled.':'Analysis unavailable. Stored source was retained.';panel.dataset.analysisState=answer?.status??'error';return;}
    if(answer.sourceId!==ref.sourceId||answer.version!==ref.version||answer.jobId!==id){message.textContent='Analysis version changed. Analyze again.';return;}
    if(right&&!same(answer.rightRef,right.sourceRef)){message.textContent='Comparison version changed. Refresh the windows and compare again.';return;}
    result=answer;bound=ref;page=0;filter.value='';paint();panel.dataset.analysisState=answer.status;
    if(right){
     identity.hidden=false;
     identity.replaceChildren(make('summary',`A ${nameFor()||ref.sourceId.slice(0,8)} · v${ref.version} / B ${right.displayName||right.sourceRef.sourceId.slice(0,8)} · v${right.sourceRef.version}`),make('p',`Stored A: ${ref.sourceId} · v${ref.version} · SHA ${ref.sha256}\nStored B snapshot: ${right.sourceRef.sourceId} · v${right.sourceRef.version} · SHA ${right.sourceRef.sha256}`));
     message.textContent=`${answer.result.identical?'Identical stored sources':`${answer.result.hunks.length.toLocaleString()} changed regions`} · ${answer.result.approximate?'Approximate comparison':'Exact comparison'}${answer.result.previewTruncated?' · preview limited':''}. B is the stored version shown above; unsaved drafts are excluded.`;return;
    }
    if(map){const coverage=answer.coverage;message.textContent=`${answer.result.nodes.length.toLocaleString()} blocks · ${answer.status==='complete'?'Complete range':'Partial map'} · syntax nesting${coverage.limited?' · map limit reached':''}${coverage.syntaxErrors?' · syntax errors found':''}${coverage.labelTruncated?' · labels shortened':''}`;identity.hidden=false;identity.replaceChildren(make('summary',`Version ${ref.version} · range details`),make('p',`Stored source ${ref.sourceId}\nSHA ${ref.sha256}\nCharacters ${coverage.from.toLocaleString()}–${coverage.to.toLocaleString()} of ${coverage.totalUnits.toLocaleString()}. Edges describe syntax containment. Static analysis does not execute Python or resolve runtime call targets.`));return;}
    const coverage=answer.coverage;message.textContent=`${answer.result.definitions.length.toLocaleString()} definitions · version ${ref.version} · ${answer.status==='complete'?'Complete range':'Partial analysis'} · characters ${coverage.from.toLocaleString()}–${coverage.to.toLocaleString()} of ${coverage.totalUnits.toLocaleString()}${coverage.syntaxErrors?' · syntax errors found':''}${coverage.limited?' · index limit reached':''}`;
   }catch{if(token===generation&&!disposed&&!paused){message.textContent='Analysis unavailable. Stored source was retained.';panel.dataset.analysisState='error';}}
   finally{if(token===generation&&!disposed){active=null;cancel.hidden=true;reconcile();}}
  }
  const toggle=()=>{if(paused||disposed)return;panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));document.getElementById('codeLayout')?.classList.toggle('has-analysis',!panel.hidden);if(!panel.hidden){reconcile();run.focus();}};
  button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panel.id);button.addEventListener('click',toggle);run.addEventListener('click',()=>void analyze());cancel.addEventListener('click',()=>{cancelActive();clearResult();message.textContent='Analysis cancelled.';panel.dataset.analysisState='cancelled';reconcile();});filter.addEventListener('input',()=>{page=0;paint();});previous.addEventListener('click',()=>{page--;paint();});next.addEventListener('click',()=>{page++;paint();});
  const changeScope=()=>{cancelActive();clearResult();compareControls.hidden=scope.value!=='compare';title.textContent=scope.value==='map'?'Selected code map':scope.value==='compare'?'Source comparison':'Source structure';description.textContent=scope.value==='map'?'Static Python syntax. Click a block to select code, fold a branch, or hover for its meaning.':scope.value==='compare'?'Compare immutable stored sources in two open Code windows. Limited previews preserve the complete stored sources.':'Classes and functions from the stored Python source. Static analysis does not run the code.';message.textContent=scope.value==='compare'?'Choose stored source B.':'Choose Analyze to inspect this version.';reconcile();if(scope.value==='compare')void refreshChoices();};scope.addEventListener('change',changeScope);
  const openCompare=()=>{if(disposed||paused||!ready(state())||active||cancelling||refreshing)return;panel.hidden=false;button.setAttribute('aria-expanded','true');document.getElementById('codeLayout')?.classList.toggle('has-analysis',true);scope.value='compare';changeScope();};compareButton?.addEventListener('click',openCompare);
  refresh.addEventListener('click',()=>{clearResult();void refreshChoices();});compareWindow.addEventListener('change',()=>{clearResult();reconcile();});
  const shortcut=event=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='o'){event.preventDefault();toggle();}};document.addEventListener('keydown',shortcut);clearResult();reconcile();
  return Object.freeze({reconcile,reset(){choiceGeneration++;refreshing=false;choices=[];compareWindow.replaceChildren();cancelActive();clearResult();panel.dataset.analysisState='idle';reconcile();},pause(){paused=true;choiceGeneration++;refreshing=false;cancelActive();clearResult();},resume(){paused=false;reconcile();},dispose(){disposed=true;choiceGeneration++;cancelActive();clearResult();document.removeEventListener('keydown',shortcut);button.removeEventListener('click',toggle);compareButton?.removeEventListener('click',openCompare);}});
 }});
})();
