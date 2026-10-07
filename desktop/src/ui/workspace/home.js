(() => {
  'use strict';
  const modules=[['diagrams','Diagrams','Connections made clear.'],['docs','Docs','Context, decisions and agents.'],['code','⌘ Code','Explore how your code works.'],['present','Present','Share the bigger picture.']];
  const moduleIcon=(card,surface)=>window.SirenModuleIcon(card,surface);
  const make=(tag,parent,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;parent?.append(node);return node;};
  window.installSirenHomeCommands=({desktop,commands,enabled})=>{
    const allowed=new Set(['desktopPinSettings','desktopLockPin','desktopOpenProject','desktopCheckUpdates','desktopRecovery','desktopGuide','desktopExportProject']);
    if(typeof desktop?.onCommand!=='function')return()=>{};
    let disposed=false;const off=desktop.onCommand(id=>{
      if(disposed||!allowed.has(id)||!Object.hasOwn(commands,id)||typeof commands[id]!=='function'||enabled(id)!==true)return;
      try{Promise.resolve(commands[id]()).catch(()=>{});}catch{/* Each UI action retains its own failure status. */}
    });return()=>{if(disposed)return;disposed=true;off?.();};
  };
  window.renderSirenHome=({container,bridge,desktop,bootstrap})=>{
    let serial=0,busy=false,disposed=false,blocked=bootstrap?.mode==='locked',state=null,off,offCommands,offNavigation;
    const events=[];
    const listen=(node,event,callback)=>{node.addEventListener(event,callback);events.push(()=>node.removeEventListener(event,callback));};
    const clear=()=>{for(const dispose of events.splice(0))dispose();container.replaceChildren();state=null;};
    const cover=()=>{blocked=true;serial++;clear();container.hidden=true;};
    const message=result=>({MIGRATION_INCOMPLETE:'The desktop copy could not be completed. Your original and any partial copy were retained.',SOURCE_BUDGET:'This source exceeds the 32 MiB import limit.',UNSUPPORTED_ENCODING:'Save this file as UTF-8 before importing it.',SOURCE_IMPORT_FAILED:'The source could not be imported. Your existing work was retained.',DOCUMENT_CREATE_FAILED:'The document could not be created. Review Docs before trying again.',NAVIGATION_LIMIT:'The document catalog has reached its limit. Existing work was retained.',REVISION_CONFLICT:'Your project changed. Refresh Home before trying again.'}[result?.code]||window.SirenHomeMessages?.[result?.code]||'The action could not complete. Your work was retained.');
    const button=(parent,text,fn,{disabled=false,className='',id}={})=>{
      const node=make('button',parent,text,className);node.type='button';node.disabled=disabled;if(id)node.id=id;
      listen(node,'click',fn);return node;
    };
    const status=()=>container.querySelector('#homeStatus');
    const say=text=>{const target=status();if(target)target.textContent=text;};
    const controls=()=>{container.setAttribute('aria-busy',String(busy));for(const node of container.querySelectorAll('button'))node.disabled=busy&&node.id!=='homeLock'||node.dataset.unavailable==='true';};
    const unavailable=(node,value)=>{node.dataset.unavailable=String(value);node.disabled=value;};
    const perform=async(method,payload)=>{
      if(disposed||blocked||busy)return;
      const turn=serial;busy=true;controls();say('Preparing your workspace…');
      try{
        const result=await bridge?.[method]?.(payload);
        if(disposed||blocked||turn!==serial)return;
        if(result?.ok===true){if(location.href==='siren://app/home.html')await refresh();else say('Opening your workspace…');return;}
        if(result?.code==='CANCELLED'){say('');return;}
        say(message(result));
      }catch{if(!disposed&&!blocked&&turn===serial)say('The action could not complete. Your work was retained.');}
      finally{if(!disposed&&!blocked&&turn===serial){busy=false;controls();}}
    };
    const exportSavedBackup=async()=>{
      if(disposed||blocked||busy)return;
      const turn=serial;busy=true;controls();say('Exporting the saved version. Unsaved working copies are excluded.');
      try{
        const result=await bridge?.exportSavedBackup?.();
        if(disposed||blocked||turn!==serial)return;
        if(result?.ok===true){say(`Saved backup exported · revision ${result.revision}. Unsaved working copies remain in their windows.`);return;}

        say(window.SirenHomeMessages?.[result?.code]||message(result));
      }catch{if(!disposed&&!blocked&&turn===serial)say('The backup could not be confirmed. Check the chosen destination before trying again.');}
      finally{if(!disposed&&!blocked&&turn===serial){busy=false;controls();}}
    };
    const create=()=>{
      if(blocked||busy||disposed)return;
      const dialog=make('dialog',container,undefined,'home-create');dialog.setAttribute('aria-labelledby','homeCreateTitle');
      const form=make('form',dialog);make('h2',form,'Create a project').id='homeCreateTitle';
      const label=make('label',form,'Project name');label.htmlFor='homeProjectName';
      const input=make('input',form);input.id='homeProjectName';input.maxLength=200;input.required=true;input.autocomplete='off';
      const formatLabel=make('label',form,'Workspace');formatLabel.htmlFor='homeProjectFormat';
      const format=make('select',form);format.id='homeProjectFormat';
      for(const [value,text] of [['classic','Diagram studio'],['desktop','Desktop workspace']]){const option=make('option',format,text);option.value=value;}
      const note=make('p',form,'Stored on this computer.');note.id='homeCreateStatus';note.setAttribute('role','status');
      listen(format,'change',()=>{note.textContent=format.value==='desktop'?'Separate windows for Docs, Code, diagrams and Present. Mermaid offers Text, Guided, flowchart Build and Style. Save before Export SVG; imported colours stay intact.':'Build, Guided and diagram export. Create a desktop copy later.';});
      const actions=make('div',form,undefined,'home-create-actions');const cancel=button(actions,'Cancel',()=>dialog.close());
      const submit=make('button',actions,'Create','home-primary');submit.type='submit';
      let creating=false;
      listen(dialog,'cancel',event=>{if(creating)event.preventDefault();});
      listen(dialog,'close',()=>dialog.remove());
      listen(form,'submit',async event=>{
        event.preventDefault();if(creating||busy||blocked||disposed||!input.value.trim())return;
        const turn=serial;creating=true;busy=true;controls();submit.disabled=cancel.disabled=true;input.disabled=format.disabled=true;
        try{
          const result=await bridge.createProject({label:input.value.trim(),format:format.value});
          if(disposed||blocked||turn!==serial)return;
          if(result?.ok===true){dialog.close();await refresh();return;}
          note.textContent=message(result);
        }catch{if(!disposed&&!blocked&&turn===serial)note.textContent='Creation failed. Your existing projects were retained.';}
        finally{if(!disposed&&!blocked&&turn===serial){creating=false;busy=false;controls();submit.disabled=cancel.disabled=false;input.disabled=format.disabled=false;input.focus();}}
      });dialog.showModal();input.focus();
    };
    const lockWorkspace=async()=>{
      if(blocked||disposed)return;cover();
      const operation=Promise.resolve().then(()=>desktop.lockPin());
      const animation=window.sirenHomeCloseVault?.();let result;try{result=await operation;}catch{}
      await animation;if(disposed)return;
      if(result?.ok===true){location.reload();return;}
      document.getElementById('sirenLockVault').hidden=true;blocked=false;await refresh();say(message(result));
    };
    const infoDialog=(title,id)=>{
      const existing=document.getElementById(id);if(existing?.open)return null;
      const dialog=make('dialog',container,undefined,'home-create');dialog.id=id;
      const heading=make('h2',dialog,title);heading.id=id+'Title';dialog.setAttribute('aria-labelledby',heading.id);
      listen(dialog,'close',()=>dialog.remove());return dialog;
    };
    const done=dialog=>button(dialog,'Done',()=>dialog.close(),{className:'home-secondary'});
    const createDocument=()=>{
      if(blocked||busy||disposed||state?.projectFormat!=='desktop'||state.mode!=='normal')return;
      const dialog=infoDialog('New document','homeNewDocument');if(!dialog)return;
      const form=make('form',dialog),label=make('label',form,'Document title');label.htmlFor='homeDocumentTitle';
      const title=make('input',form);title.id='homeDocumentTitle';title.maxLength=160;title.required=true;title.autocomplete='off';
      const note=make('p',form,'Stored in the current project. Open it from Docs to add text, headings and saved code.');note.setAttribute('role','status');
      const actions=make('div',form,undefined,'home-create-actions'),cancel=button(actions,'Cancel',()=>dialog.close(),{id:'homeDocumentCancel',className:'home-secondary'}),submit=make('button',actions,'Create document','home-primary');submit.id='homeDocumentSubmit';submit.type='submit';let creating=false;
      listen(dialog,'cancel',event=>{if(creating)event.preventDefault();});
      listen(form,'submit',async event=>{
        event.preventDefault();if(creating||busy||blocked||disposed||!title.value.trim())return;
        const turn=serial;creating=true;busy=true;controls();cancel.disabled=submit.disabled=title.disabled=true;
        try{const result=await bridge.createDocument({title:title.value.trim()});if(disposed||blocked||turn!==serial)return;if(result?.ok===true){dialog.close();await refresh();return;}note.textContent=message(result);}
        catch{if(!disposed&&!blocked&&turn===serial)note.textContent='The action could not complete. Review Docs before trying again.';}
        finally{if(!disposed&&!blocked&&turn===serial){creating=false;busy=false;controls();cancel.disabled=submit.disabled=title.disabled=false;title.focus();}}
      });dialog.showModal();title.focus();
    };
    const convert=()=>{
      if(blocked||busy||disposed)return;const dialog=infoDialog('Create a desktop copy','homeConvert');if(!dialog)return;
      make('p',dialog,'Keep your original in Diagram studio. The desktop copy opens Docs, Code and diagrams in separate windows.');
      make('p',dialog,'Code, agents and history stay intact. Use Text, Guided, Build and Style; Export SVG saves a vector in the copy’s exports folder.');
      button(dialog,'Cancel',()=>dialog.close(),{className:'home-secondary'});
      button(dialog,'Create desktop copy',()=>{dialog.close();void perform('convertProject',{});},{id:'homeConfirmConvert',className:'home-primary'});dialog.showModal();
    };
    const showGuide=()=>{
      if(blocked||disposed)return;const dialog=infoDialog('Your SIREN workspace','homeGuide');if(!dialog)return;
      make('h3',dialog,'Present');make('p',dialog,'Open a saved diagram from Present. Presenter keeps your notes private; Audience receives only the public slide. Use the slide list, arrows or Space to move through saved overview, node, section, plain chapter, Title/Text and Table card slides. Title/Text cards show a safe text snapshot of paragraphs and lists; inline rich formatting is not reproduced yet. Public tables show all cells when the complete layout fits; split dense tables across slides. Choose an Audience display, use Fullscreen and Escape, or restore minimized windows from Home. Refresh saved deck adopts saved changes explicitly. Images, live Docs/facts, progressive card reveals and deck export are still being developed; an unsupported slide retains the last public frame. Mermaid preview uses the bundled version 12 engine with its current bounded rendering limits.');
      for(const [title,text] of window.SirenHomeGuideSections){make('h3',dialog,title);make('p',dialog,text);}
      done(dialog);dialog.showModal();
    };
    const showUpdates=async()=>{
      if(blocked||disposed)return;const dialog=infoDialog('SIREN updates','homeUpdates');if(!dialog)return;const turn=serial;
      const note=make('p',dialog,'Checking update status…');note.id='homeUpdateStatus';note.setAttribute('role','status');
      const paintUpdate=value=>{if(disposed||blocked||serial!==turn||!dialog.open)return;const phase=value?.phase;
        note.textContent={unconfigured:'Updates are not configured for this development build.',idle:'Check for a signed SIREN update.',checking:'Checking for updates…',current:'This version is up to date.',available:`SIREN ${value?.version||''} is available.`,downloading:'An update is downloading.',ready:'The update is verified. Installation is not yet qualified in this development build.',applying:'Preparing to restart…',error:'Updates could not be checked. Try again.'}[phase]||'Update status unavailable.';};
      const check=button(dialog,'Check for updates',async()=>{check.disabled=true;try{paintUpdate(await desktop.checkForUpdates());}catch{paintUpdate({phase:'error'});}finally{if(dialog.open)check.disabled=false;}},{id:'homeCheckUpdates',className:'home-primary'});
      done(dialog);dialog.showModal();try{paintUpdate(await desktop.getUpdate());}catch{paintUpdate({phase:'error'});}
      if(disposed||blocked||serial!==turn||!dialog.open)return;
      const unsubscribe=desktop.onStatus?.(value=>{if(value?.kind==='updates')paintUpdate(value.state);});
      listen(dialog,'close',()=>unsubscribe?.());events.push(()=>unsubscribe?.());
    };
    const showSettings=()=>{
      if(blocked||busy||disposed)return;const dialog=infoDialog('Settings','homeSettingsPanel');if(!dialog)return;
      button(dialog,'Change PIN',()=>{dialog.close();window.sirenDesktopShowPin?.('change');},{id:'homePinSettings',className:'home-project-row'});
      button(dialog,'Check for updates',()=>{dialog.close();void showUpdates();},{id:'homeSettingsUpdates',className:'home-project-row'});
      button(dialog,'Quick guide',()=>{dialog.close();showGuide();},{id:'homeQuickGuide',className:'home-project-row'});
      done(dialog);dialog.showModal();
    };
    const paint=value=>{
      clear();state=value;container.hidden=false;container.className='home-root';
      const selected=value.projects.find(p=>p.projectId===value.selectedProjectId),context=value.selectedProjectId!==null;
      const top=make('header',container,undefined,'home-topbar');make('span',top,'SIREN','home-brand');const current=make('span',top,context?'Home · '+(selected?.label||'Local project'):'Home','home-current');current.title=current.textContent;
      const tools=make('div',top,undefined,'home-topbar-tools');
      if(value.mode!=='normal'&&typeof bridge?.showRecovery==='function')button(tools,'Recovery',()=>perform('showRecovery',{}),{id:'homeRecovery'});
      const settings=button(tools,'Settings',showSettings,{id:'homeSettings'});unavailable(settings,typeof window.sirenDesktopShowPin!=='function'||typeof desktop?.changePin!=='function');
      const lock=button(tools,'Lock',lockWorkspace,{id:'homeLock'});unavailable(lock,typeof desktop?.lockPin!=='function');
      const content=make('div',container,undefined,'home-content');
      const greeting=make('div',content,undefined,'home-greeting');make('p',greeting,'YOUR WORKSPACE','home-eyebrow');make('h1',greeting,'Where ideas connect.');make('p',greeting,'Pick up where you left off, or start something new.','home-subtitle');
      if(value.mode!=='normal'){const warning=make('p',content,value.mode==='recovery'?'Recovery mode · Existing work is retained. Review recovery before editing.':'Read-only mode · You can inspect existing work. Editing is unavailable.','home-warning');warning.setAttribute('role','status');}
      const hero=make('section',content,undefined,'home-resume');
      const previous=value.continuation,project=previous&&value.projects.find(p=>p.projectId===previous.location.projectId);
      if(previous){make('span',hero,'CONTINUE WORK','home-eyebrow');make('h2',hero,project?.label||'Local project');const surface=modules.find(m=>m[0]===previous.location.surface)?.[1]||'Project overview';make('p',hero,previous.reason?message({code:previous.reason}):`${surface} · Your last recorded location`,'home-subtitle');const resume=button(hero,'Continue work',()=>perform('continueWork',{}),{className:'home-primary',id:'homeContinue'});unavailable(resume,previous.availability==='missing'||typeof bridge?.continueWork!=='function');}
      else{make('span',hero,context?'CURRENT PROJECT':'A FRESH START','home-eyebrow');make('h2',hero,context?(selected?.label||'Local project'):'Make room for your next idea.');make('p',hero,context?'Choose Diagrams, Docs, Code or Present below.':'Create a local project or open your existing work.','home-subtitle');}
      const start=make('div',hero,undefined,'home-start-actions');const newProject=button(start,'New project',create,{id:'homeNewProject',className:previous||context?'home-secondary':'home-primary'});unavailable(newProject,value.mode!=='normal'||typeof bridge?.createProject!=='function');
      const open=button(start,'Open project…',()=>perform('importProject',{}),{id:'homeImportProject',className:'home-secondary'});unavailable(open,value.mode!=='normal'||typeof bridge?.importProject!=='function');
      if(value.projectFormat==='classic'){const upgrade=button(start,'Create desktop copy…',convert,{id:'homeConvertProject',className:'home-secondary'});unavailable(upgrade,value.mode!=='normal'||typeof bridge?.convertProject!=='function');}
      const moduleHeading=make('div',content,undefined,'home-section-heading');make('h2',moduleHeading,'Explore your project');make('span',moduleHeading,'One context. Four perspectives.');
      const diagramWindow=button(moduleHeading,'Open diagram window…',()=>library('diagram'),{id:'homeDiagramWindows'});unavailable(diagramWindow,value.selectedProjectId===null||typeof bridge?.getCatalog!=='function');
      const grid=make('div',content,undefined,'home-module-grid');
      for(const [surface,title,description] of modules){const enabled=value.selectedProjectId!==null&&value.capabilities[surface]===true&&typeof bridge?.openModule==='function';
        const card=button(grid,'',()=>surface==='present'?library('presenter'):['code','docs'].includes(surface)?library(surface):surface==='diagrams'&&value.projectFormat==='desktop'?library('diagram'):perform('openModule',{surface}),{className:'home-module',id:'homeModule-'+surface});
        moduleIcon(card,surface);make('strong',card,title);make('span',card,description,'home-module-description');
        // A visible limitation does not advertise an unconnected editor.
        const available=enabled===true;unavailable(card,!available);if(!available)make('small',card,value.selectedProjectId===null?'Open a project first':'Not available in this build');
      }
      if(value.views.length){const views=make('section',content,undefined,'home-projects');const heading=make('div',views,undefined,'home-section-heading');make('h2',heading,'Open windows');make('span',heading,'Across your displays');button(heading,'Refresh',()=>{void refresh();},{id:'homeRefreshWindows',className:'home-secondary'});
        for(const view of value.views){const row=button(views,`${view.label} · ${view.state==='minimized'?'Minimized':'Open'} ↗`,()=>perform('focusView',{windowId:view.windowId}),{className:'home-project-row'});row.dataset.windowId=view.windowId;unavailable(row,typeof bridge?.focusView!=='function');}}
      const projects=make('section',content,undefined,'home-projects');const heading=make('div',projects,undefined,'home-section-heading');make('h2',heading,'Recent projects');make('span',heading,'On this computer');
      if(!value.projects.length)make('p',projects,'Your projects will appear here after you open them.','home-empty');
      for(const project of value.projects){const row=button(projects,'',()=>perform('openProject',{projectId:project.projectId}),{className:'home-project-row'});row.dataset.projectId=project.projectId;const details=make('span',row,undefined,'home-project-details');make('strong',details,project.label||'Local project');make('small',details,project.availability==='missing'?'Unavailable':project.availability==='recovery'?'Needs recovery':project.availability==='cached'?'Recorded locally · checked when opened':'Local project');make('span',row,'↗','home-project-arrow');unavailable(row,project.availability==='missing'||typeof bridge?.openProject!=='function');}
      const footer=make('footer',content);const currentStatus=make('p',footer,'','home-status');currentStatus.id='homeStatus';currentStatus.setAttribute('role','status');currentStatus.setAttribute('aria-live','polite');make('small',footer,'Your work stays on this computer.');
      controls();
    };
    const refresh=async()=>{
      if(disposed||blocked)return false;
      const turn=++serial;busy=true;controls();
      try{const result=await bridge?.getHomeState?.({});if(disposed||blocked||turn!==serial)return false;
        if(!result?.ok||!result.state){clear();container.hidden=false;make('h1',container,'Home');make('p',container,message(result)).setAttribute('role','status');return false;}
        paint(result.state);return true;
      }catch{if(!disposed&&!blocked&&turn===serial){clear();container.hidden=false;make('p',container,'Home could not load. Existing work was retained.').setAttribute('role','status');}return false;}
      finally{if(!disposed&&!blocked&&turn===serial){busy=false;controls();}}
    };
    const library=async(surface,selected=null)=>{
      if(disposed||blocked||busy)return;const turn=serial;busy=true;controls();
      const dialog=make('dialog',container,undefined,'home-create home-library');dialog.setAttribute('aria-labelledby','homeLibraryTitle');
      make('h2',dialog,surface==='code'?'⌘ Code':surface==='diagram'?'Diagrams':surface==='presenter'?'Present':'Docs').id='homeLibraryTitle';make('p',dialog,surface==='code'?'Open saved code; Edit working copy opens its editor.':surface==='diagram'?'Open a diagram; Edit working copy changes Mermaid.':surface==='presenter'?'Presenter keeps notes private; Audience shows the public slide.':'Open saved Docs; Edit working copy updates text and links.');
      const search=make('form',dialog,undefined,'home-library-search'),searchLabel=make('label',search,'Find by name');searchLabel.htmlFor='homeLibraryQuery';
      const queryInput=make('input',search);queryInput.id='homeLibraryQuery';queryInput.type='search';queryInput.maxLength=160;queryInput.autocomplete='off';
      const submit=make('button',search,'Search');submit.id='homeLibrarySearch';submit.type='submit';
      const filterFields=[];if(['docs','code'].includes(surface)){
        const register=make('details',search);register.className='home-docs-filters';make('summary',register,'Filter register');const grid=make('div',register);grid.style.cssText='display:flex;flex-wrap:wrap;gap:10px';
        const definitions=surface==='code'?[['language','Language',['python','text','unknown']],['links','Docs links',['linked','earlier','unlinked','unknown']],['document','Document',null],['agent','Agent metadata',null]]:[['type','Type',['agent-spec','narrative','control','note']],['status','Status',['draft','in-review','approved']],['links','References',['linked','unlinked']],['owner','Owner',null]];
        for(const [key,title,choices]of definitions){const label=make('label',grid,title),field=make(choices?'select':'input',label);field.id=(surface==='code'?'homeCodeFilter-':'homeDocsFilter-')+key;field.dataset.registerFilter=key;field.setAttribute('aria-label',title);if(choices){const any=make('option',field,'All');any.value='';for(const value of choices){const option=make('option',field,value);option.value=value;}}else{field.maxLength=80;field.autocomplete='off';}filterFields.push(field);}
      }
      const rows=make('div',dialog,undefined,'home-library-items'),note=make('p',dialog,'Loading…');note.setAttribute('role','status');
      let cursor=0,found=0,query=selected?.label??'',loading=false,opening=false,handingOff=false,active=true;queryInput.value=query;
      const rowEvents=[],clearRows=()=>{for(const off of rowEvents.splice(0))off();rows.replaceChildren();};events.push(clearRows);
      const more=button(dialog,'Load more',()=>{void loadPage();},{id:'homeLibraryMore',className:'home-secondary'});more.hidden=true;
      const finish=()=>{active=false;clearRows();if(!handingOff&&turn===serial){busy=false;controls();}dialog.remove();};
      if(surface==='code'&&state?.projectFormat==='desktop'&&state.mode==='normal'&&typeof bridge?.importSource==='function')button(dialog,'Import code…',()=>{finish();void perform('importSource',{});},{id:'homeLibraryImportSource',className:'home-primary'});
      if(surface==='docs'&&state?.projectFormat==='desktop'&&state.mode==='normal'&&typeof bridge?.createDocument==='function')button(dialog,'New document',()=>{finish();createDocument();},{id:'homeLibraryNewDocument',className:'home-primary'});
      button(dialog,'Done',()=>dialog.close(),{className:'home-secondary'});listen(dialog,'close',finish);dialog.showModal();
      const loadPage=async()=>{
      if(loading||opening||blocked||disposed||turn!==serial||!active||!dialog.open)return;loading=true;more.disabled=submit.disabled=queryInput.disabled=true;for(const field of filterFields)field.disabled=true;
      try{
        const filters=Object.fromEntries(filterFields.filter(f=>f.value).map(f=>[f.dataset.registerFilter,f.value]));const result=await bridge.getCatalog({cursor,role:surface,...(query?{query}:{}),...(['docs','code'].includes(surface)?{details:true,filters}:{})});if(disposed||blocked||turn!==serial||!active||!dialog.open)return;
        if(!result?.ok){note.textContent=message(result);return;}
        for(const item of result.items.filter(item=>item.role===surface)){found++;const row=make('button',rows,item.label,'home-project-row');row.type='button';if(item.context){row.style.display='block';row.style.textAlign='left';}if(surface==='docs'&&item.context){const facts=make('small',row,[item.context.type,item.context.status,item.context.owner,item.context.agentId,item.context.agentVersion,item.context.referenceCount+' references'].filter(Boolean).join(' · '));facts.style.cssText='display:block;font-weight:400;opacity:.72;margin-top:5px;overflow-wrap:anywhere';}if(surface==='code'&&item.context){const c=item.context,links=[...c.exactLinks.map(link=>link.title+' · this version'),...c.earlierLinks.map(link=>link.title+' · v'+link.version+' only')],agents=[...new Set([...c.exactLinks,...c.earlierLinks].filter(link=>link.agentId).map(link=>link.agentId+(link.agentVersion?' v'+link.agentVersion:'')))];const facts=make('small',row,['Selected v'+item.sourceRef.version,item.sourceRef.sourceId.slice(0,8),c.language==='unknown'?'Language unclassified':c.language,c.exactCount+' exact Docs references',c.earlierCount?c.earlierCount+' earlier-version references':'',...links,agents.length?'Agent metadata: '+agents.join(', '):'',c.linksTruncated?'Relationship preview limited':''].filter(Boolean).join(' · '));facts.style.cssText='display:block;font-weight:400;opacity:.72;margin-top:5px;overflow-wrap:anywhere';}const open=async()=>{
          if(blocked||disposed||turn!==serial||opening||!active)return;opening=true;row.disabled=true;note.textContent='Opening…';
          try{const opened=await bridge.openView({role:item.role,entityId:item.entityId,...(item.sourceRef?{version:item.sourceRef.version}:{})});
            if(blocked||disposed||turn!==serial||!active)return;
            if(opened?.ok){
              // Closing the dialog must not enable a second Home action before
              // this callback finishes recording and refreshing its location.
              handingOff=true;dialog.close();
              const recorded=await bridge.recordLocation({surface:surface==='diagram'?'diagrams':surface==='presenter'?'present':surface,entityId:item.entityId,...(item.sourceRef?{sourceRef:item.sourceRef}:{})});
              if(blocked||disposed||turn!==serial)return;await refresh();if(recorded?.ok!==true)say('The window opened, but Continue work could not be updated.');
            }
            else{note.textContent=message(opened);row.disabled=false;}
          }catch{if(!blocked&&!disposed&&turn===serial){if(handingOff){await refresh();say('The window opened, but Continue work could not be updated.');}else if(active){note.textContent='The window could not open. Your work was retained.';row.disabled=false;}}}
          finally{opening=false;}
        };row.addEventListener('click',open);rowEvents.push(()=>row.removeEventListener('click',open));row.dataset.entityId=item.entityId;
        if(surface==='presenter'&&state?.projectFormat==='desktop'&&state.mode==='normal'&&typeof bridge?.editDeck==='function'){const edit=make('button',rows,'Edit deck · '+item.label,'home-secondary');edit.type='button';edit.dataset.editDeck=item.entityId;const run=async()=>{if(loading||opening||blocked||disposed||turn!==serial||!active)return;opening=true;edit.disabled=true;try{const result=await bridge.editDeck({entityId:item.entityId});if(blocked||disposed||turn!==serial||!active)return;if(result?.ok)dialog.close();else note.textContent=message(result);}catch{if(!blocked&&!disposed&&turn===serial&&active)note.textContent='Deck editor could not open. Your saved work is retained.';}finally{opening=false;if(active)edit.disabled=false;}};edit.addEventListener('click',run);rowEvents.push(()=>edit.removeEventListener('click',run));}
        if(selected&&selected.entityId===item.entityId&&(!selected.sourceRef||['sourceId','version','sha256'].every(key=>selected.sourceRef[key]===item.sourceRef?.[key]))){selected=null;queueMicrotask(()=>row.click());}}
        cursor=result.nextCursor;more.hidden=result.hasMore!==true;
        note.textContent=(found?`${found.toLocaleString()} of ${Math.min(result.total,4096).toLocaleString()} ${query?'matching names':'items'} · Select an item.`:query?'No matching names.':'No saved items in this project yet.')+(result.truncated?' Only the first 4,096 items can be searched here.':'');
      }catch{if(!blocked&&turn===serial)note.textContent='The library could not load. Your work was retained.';}
      finally{loading=false;if(active&&dialog.open){more.disabled=submit.disabled=queryInput.disabled=false;for(const field of filterFields)field.disabled=false;}}
      };listen(search,'submit',event=>{event.preventDefault();if(loading||opening||blocked||disposed||turn!==serial||!active)return;query=queryInput.value.trim();cursor=found=0;clearRows();void loadPage();});await loadPage();
    };
    if(typeof bridge?.onInvalidated==='function')off=bridge.onInvalidated(cover);
    offNavigation=bridge?.onNavigate?.(surface=>{
      const open=()=>{if(disposed||blocked)return;if(busy||!state){setTimeout(open,50);return;}
        if(surface==='find')window.SirenProjectSearch.open();else container.querySelector('#homeModule-'+surface)?.click();};open();
    });
    offCommands=window.installSirenHomeCommands({desktop,enabled:id=>!disposed&&!blocked&&(!busy||id==='desktopLockPin'),commands:{desktopPinSettings:showSettings,desktopLockPin:lockWorkspace,desktopOpenProject:()=>perform('importProject',{}),desktopCheckUpdates:showUpdates,desktopGuide:showGuide,desktopRecovery:()=>state?.mode!=='normal'?perform('showRecovery',{}):say('Open Diagrams to review Disaster Recovery.'),desktopExportProject:exportSavedBackup}});
    return Object.freeze({refresh,cover,openFoundItem:item=>library(item.role,item),resume:()=>{blocked=false;return refresh();},dispose:()=>{if(disposed)return;disposed=true;cover();off?.();offCommands?.();offNavigation?.();}});
  };
  const start=()=>{
    const boot=window.sirenDesktopBootstrap;
    if(!boot||boot.mode==='locked')return;
    delete document.documentElement.dataset.desktopLocked;
    const home=window.renderSirenHome({container:document.getElementById('homeRoot'),bridge:window.sirenHome,desktop:window.sirenDesktop,bootstrap:boot});
    window.sirenHomeView=home;
    window.sirenViewControl?.onPrepare(async()=>{home.cover();document.body.inert=true;return window.sirenViewControl.sealReadonly();});
    window.sirenViewControl?.onResume(()=>{document.body.inert=false;void home.resume();});
    void home.refresh().finally(()=>window.sirenDesktopReady?.());
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
