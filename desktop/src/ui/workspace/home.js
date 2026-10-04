(() => {
  'use strict';
  const modules=[['diagrams','Diagrams','Connections made clear.','◇'],['docs','Docs','Context, decisions and agents.','▤'],['code','⌘ Code','Explore how your code works.','⌘'],['present','Present','Share the bigger picture.','▻']];
  const errors={ACCESS_REFUSED:'Access changed. Return to the unlocked workspace.',PROJECT_UNAVAILABLE:'This project is unavailable. Its existing data was retained.',ENTITY_UNAVAILABLE:'The saved item is unavailable. Open its project to review it.',SOURCE_VERSION_UNAVAILABLE:'The saved code version is unavailable. Your private draft was retained.',RECOVERY_REQUIRED:'This project needs recovery before it can be opened.',UNAVAILABLE:'This action is not connected in this build.',TRANSITION_FAILED:'The workspace could not change. Your work was retained.'};
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
    let serial=0,busy=false,disposed=false,blocked=bootstrap?.mode==='locked',state=null,off,offCommands;
    const events=[];
    const listen=(node,event,callback)=>{node.addEventListener(event,callback);events.push(()=>node.removeEventListener(event,callback));};
    const clear=()=>{for(const dispose of events.splice(0))dispose();container.replaceChildren();state=null;};
    const cover=()=>{blocked=true;serial++;clear();container.hidden=true;};
    const message=result=>({MIGRATION_INCOMPLETE:'The desktop copy could not be completed. Your original and any partial copy were retained.',SOURCE_BUDGET:'This source exceeds the 32 MiB import limit.',UNSUPPORTED_ENCODING:'Save this file as UTF-8 before importing it.',SOURCE_IMPORT_FAILED:'The source could not be imported. Your existing work was retained.',DOCUMENT_CREATE_FAILED:'The document could not be created. Review Docs before trying again.',NAVIGATION_LIMIT:'The document catalog has reached its limit. Existing work was retained.',REVISION_CONFLICT:'Your project changed. Refresh Home before trying again.'}[result?.code]||errors[result?.code]||'The action could not complete. Your work was retained.');
    const button=(parent,text,fn,{disabled=false,className='',id}={})=>{
      const node=make('button',parent,text,className);node.type='button';node.disabled=disabled;if(id)node.id=id;
      listen(node,'click',fn);return node;
    };
    const status=()=>container.querySelector('#homeStatus');
    const say=text=>{const target=status();if(target)target.textContent=text;};
    const controls=()=>{container.setAttribute('aria-busy',String(busy));for(const node of container.querySelectorAll('button'))node.disabled=busy||node.dataset.unavailable==='true';};
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
      make('h3',dialog,'Present');make('p',dialog,'Open a saved diagram from Present. Presenter keeps your notes private; Audience receives only the public slide. Use the slide list, arrows or Space to move through saved overview, node, section, plain chapter and Title/Text card slides. Title/Text cards show a safe text snapshot of paragraphs and lists; inline rich formatting is not reproduced yet. Choose an Audience display, use Fullscreen and Escape, or restore minimized windows from Home. Refresh saved deck adopts saved changes explicitly. Tables, images, live Docs/facts, progressive card reveals and deck export are still being developed; an unsupported slide retains the last public frame. Mermaid preview uses the bundled version 12 engine with its current bounded rendering limits.');
      for(const [title,text] of [['Projects','Choose Diagram studio or Desktop workspace. Desktop offers separate Docs, Code and diagram windows with Text, Guided, bounded flowchart Build, Style and saved SVG export. Create desktop copy preserves your original and moves code into separate sources.'],['Diagrams',"Diagram studio includes Build, Guided and vector export. Desktop diagram windows include Text and Guided, plus optional Build and Style panels. Build selects real rendered flowchart blocks; edit labels/shapes, add blocks/connections, or change direction. Imported Mermaid colours take priority over saved block/class styles. Apply to preview, then Save diagram or Ctrl+S. Right-click a block opens Build; finish or cancel tentative fields before Lock. Zoom/pan and the source split stay available. Export SVG renders the saved diagram with title/fonts/colours to the project’s exports folder; Show file reveals it. Save local changes first. Vector export ignores preview pan/zoom; readonly export is allowed, stale versions refuse. Guided pages show 64 lines at a time. Flowcharts expose labels, IDs, shapes and connections; other syntax stays exact text. Enter applies and Esc cancels; invalid fields remain visible and prevent Lock. Guided/preview retain the 50,000-character limit; large code is stored separately. Continue work reopens saved windows. Free block positioning and attach-back remain in development."],['Docs','New document creates notes in the current desktop project after saving open working copies; Cancel keeps existing work. Reopen Docs and choose Edit working copy. Add heading, Add text or Add section (Table, Checklist, Agent instructions, Settings). Structured editors open one at a time, with 20-row pages; row/column removal asks first. Instructions document the agent without running code or activating AI. Save document or Ctrl+S commits edits. Linked-code names (160 characters) and notes (2,000) explain sources; history, opaque fields and saved source versions stay intact. Linked code shows saved source versions. Preview reads small saved-text pages with Previous/Next; Hide clears them. Open in Code opens that exact version read-only. Your unsaved document edits stay here. If another window changed the document, refresh explicitly or open saved separately.'],['⌘ Code',"Import UTF-8 code up to 32 MiB from the searchable library; Unlinked marks sources without a current Docs link. Open exact saved versions with Python colours, Find and Wrap. Structure (Ctrl+Shift+O) indexes saved classes/functions without executing Python. Save first, then Analyze an overview or selected range; partial coverage is explicit. Select a definition or map block to navigate, fold a branch, or Cancel. The finite syntax map does not resolve runtime calls. Compare sources uses immutable versions from open Code windows; A/B version and SHA labels identify snapshots, excluding drafts. Show in A navigates changes; approximation and preview limits are labelled. Refresh windows updates choices. Lock waits for worker exit. Edit working copy saves a new source version. Link to Docs updates a chosen row; Add source to a document links unlinked code to an existing document. Only saved versions are linked. Conflicts retain drafts. Clean views refresh after peer saves; Open latest separately preserves local edits, and Replace with latest asks first."],['Across your displays','Home lists open windows, including minimized ones. Window in the native menu is available from every module: Ctrl+Alt+1 restores the main window; Ctrl+Alt+Right and Ctrl+Alt+Left switch between registered windows and restore minimized ones. Continue work reopens the last saved item and its project. Close, Lock and Quit wait for working copies to be saved.'],['Keyboard','Ctrl+, opens Settings. Ctrl+Alt+L locks SIREN. Ctrl+Alt+O opens a project. Ctrl+Alt+U checks for updates. Ctrl+Q quits after preparing your work.']]){make('h3',dialog,title);make('p',dialog,text);}
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
      const top=make('header',container,undefined,'home-topbar');make('span',top,'SIREN','home-brand');make('span',top,'Home','home-current');
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
      else{make('span',hero,'A FRESH START','home-eyebrow');make('h2',hero,'Make room for your next idea.');make('p',hero,'Create a local project or open your existing work.','home-subtitle');}
      const start=make('div',hero,undefined,'home-start-actions');const newProject=button(start,'New project',create,{id:'homeNewProject',className:previous?'home-secondary':'home-primary'});unavailable(newProject,value.mode!=='normal'||typeof bridge?.createProject!=='function');
      const open=button(start,'Open project…',()=>perform('importProject',{}),{id:'homeImportProject',className:'home-secondary'});unavailable(open,value.mode!=='normal'||typeof bridge?.importProject!=='function');
      if(value.projectFormat==='classic'){const upgrade=button(start,'Create desktop copy…',convert,{id:'homeConvertProject',className:'home-secondary'});unavailable(upgrade,value.mode!=='normal'||typeof bridge?.convertProject!=='function');}
      const moduleHeading=make('div',content,undefined,'home-section-heading');make('h2',moduleHeading,'Explore your project');make('span',moduleHeading,'One context. Four perspectives.');
      const diagramWindow=button(moduleHeading,'Open diagram window…',()=>library('diagram'),{id:'homeDiagramWindows'});unavailable(diagramWindow,value.selectedProjectId===null||typeof bridge?.getCatalog!=='function');
      const grid=make('div',content,undefined,'home-module-grid');
      for(const [surface,title,description,icon] of modules){const enabled=value.selectedProjectId!==null&&value.capabilities[surface]===true&&typeof bridge?.openModule==='function';
        const card=button(grid,'',()=>surface==='present'?library('presenter'):['code','docs'].includes(surface)?library(surface):surface==='diagrams'&&value.projectFormat==='desktop'?library('diagram'):perform('openModule',{surface}),{className:'home-module',id:'homeModule-'+surface});
        make('span',card,icon,'home-module-icon');make('strong',card,title);make('span',card,description,'home-module-description');
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
    const library=async surface=>{
      if(disposed||blocked||busy)return;const turn=serial;busy=true;controls();
      const dialog=make('dialog',container,undefined,'home-create home-library');dialog.setAttribute('aria-labelledby','homeLibraryTitle');
      make('h2',dialog,surface==='code'?'⌘ Code':surface==='diagram'?'Diagrams':surface==='presenter'?'Present':'Docs').id='homeLibraryTitle';make('p',dialog,surface==='code'?'Open saved code; Edit working copy opens its editor.':surface==='diagram'?'Open a diagram; Edit working copy changes Mermaid.':surface==='presenter'?'Presenter keeps notes private; Audience shows the public slide.':'Open saved Docs; Edit working copy updates text and links.');
      const search=make('form',dialog,undefined,'home-library-search'),searchLabel=make('label',search,'Find by name');searchLabel.htmlFor='homeLibraryQuery';
      const queryInput=make('input',search);queryInput.id='homeLibraryQuery';queryInput.type='search';queryInput.maxLength=160;queryInput.autocomplete='off';
      const submit=make('button',search,'Search');submit.id='homeLibrarySearch';submit.type='submit';
      const rows=make('div',dialog,undefined,'home-library-items'),note=make('p',dialog,'Loading…');note.setAttribute('role','status');
      let cursor=0,found=0,query='',loading=false,opening=false,handingOff=false,active=true;
      const rowEvents=[],clearRows=()=>{for(const off of rowEvents.splice(0))off();rows.replaceChildren();};events.push(clearRows);
      const more=button(dialog,'Load more',()=>{void loadPage();},{id:'homeLibraryMore',className:'home-secondary'});more.hidden=true;
      const finish=()=>{active=false;clearRows();if(!handingOff&&turn===serial){busy=false;controls();}dialog.remove();};
      if(surface==='code'&&state?.projectFormat==='desktop'&&state.mode==='normal'&&typeof bridge?.importSource==='function')button(dialog,'Import code…',()=>{finish();void perform('importSource',{});},{id:'homeLibraryImportSource',className:'home-primary'});
      if(surface==='docs'&&state?.projectFormat==='desktop'&&state.mode==='normal'&&typeof bridge?.createDocument==='function')button(dialog,'New document',()=>{finish();createDocument();},{id:'homeLibraryNewDocument',className:'home-primary'});
      button(dialog,'Done',()=>dialog.close(),{className:'home-secondary'});listen(dialog,'close',finish);dialog.showModal();
      const loadPage=async()=>{
      if(loading||opening||blocked||disposed||turn!==serial||!active||!dialog.open)return;loading=true;more.disabled=submit.disabled=queryInput.disabled=true;
      try{
        const result=await bridge.getCatalog({cursor,role:surface,...(query?{query}:{})});if(disposed||blocked||turn!==serial||!active||!dialog.open)return;
        if(!result?.ok){note.textContent=message(result);return;}
        for(const item of result.items.filter(item=>item.role===surface)){found++;const row=make('button',rows,item.label,'home-project-row');row.type='button';const open=async()=>{
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
        };row.addEventListener('click',open);rowEvents.push(()=>row.removeEventListener('click',open));row.dataset.entityId=item.entityId;}
        cursor=result.nextCursor;more.hidden=result.hasMore!==true;
        note.textContent=(found?`${found.toLocaleString()} of ${Math.min(result.total,4096).toLocaleString()} ${query?'matching names':'items'} · Select an item.`:query?'No matching names.':'No saved items in this project yet.')+(result.truncated?' Only the first 4,096 items can be searched here.':'');
      }catch{if(!blocked&&turn===serial)note.textContent='The library could not load. Your work was retained.';}
      finally{loading=false;if(active&&dialog.open)more.disabled=submit.disabled=queryInput.disabled=false;}
      };listen(search,'submit',event=>{event.preventDefault();if(loading||opening||blocked||disposed||turn!==serial||!active)return;query=queryInput.value.trim();cursor=found=0;clearRows();void loadPage();});await loadPage();
    };
    if(typeof bridge?.onInvalidated==='function')off=bridge.onInvalidated(cover);
    offCommands=window.installSirenHomeCommands({desktop,enabled:id=>!disposed&&!blocked&&(!busy||id==='desktopLockPin'),commands:{desktopPinSettings:showSettings,desktopLockPin:lockWorkspace,desktopOpenProject:()=>perform('importProject',{}),desktopCheckUpdates:showUpdates,desktopGuide:showGuide,desktopRecovery:()=>state?.mode!=='normal'?perform('showRecovery',{}):say('Open Diagrams to review Disaster Recovery.'),desktopExportProject:()=>say('Open Diagrams to export your saved project.')}});
    return Object.freeze({refresh,cover,resume:()=>{blocked=false;return refresh();},dispose:()=>{if(disposed)return;disposed=true;cover();off?.();offCommands?.();}});
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
