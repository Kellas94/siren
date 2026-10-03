(() => {
  'use strict';
  const modules=[['diagrams','Diagrams','Connections made clear.','◇'],['docs','Docs','Context, decisions and agents.','▤'],['code','⌘ Code','Explore how your code works.','⌘'],['present','Present','Share the bigger picture.','▻']];
  const errors={ACCESS_REFUSED:'Access changed. Return to the unlocked workspace.',PROJECT_UNAVAILABLE:'This project is unavailable. Its existing data was retained.',ENTITY_UNAVAILABLE:'The saved item is unavailable. Open its project to review it.',SOURCE_VERSION_UNAVAILABLE:'The saved code version is unavailable. Your private draft was retained.',RECOVERY_REQUIRED:'This project needs recovery before it can be opened.',UNAVAILABLE:'This action is not connected in this build.',TRANSITION_FAILED:'The workspace could not change. Your work was retained.'};
  const make=(tag,parent,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;parent?.append(node);return node;};
  window.renderSirenHome=({container,bridge,desktop,bootstrap})=>{
    let serial=0,busy=false,disposed=false,blocked=bootstrap?.mode==='locked',state=null,off;
    const events=[];
    const listen=(node,event,callback)=>{node.addEventListener(event,callback);events.push(()=>node.removeEventListener(event,callback));};
    const clear=()=>{for(const dispose of events.splice(0))dispose();container.replaceChildren();state=null;};
    const cover=()=>{blocked=true;serial++;clear();container.hidden=true;};
    const message=result=>errors[result?.code]||'The action could not complete. Your work was retained.';
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
        if(result?.ok===true){say('Opening your workspace…');return;}
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
      const note=make('p',form,'Stored on this computer.');note.id='homeCreateStatus';note.setAttribute('role','status');
      const actions=make('div',form,undefined,'home-create-actions');const cancel=button(actions,'Cancel',()=>dialog.close());
      const submit=make('button',actions,'Create','home-primary');submit.type='submit';
      let creating=false;
      listen(dialog,'cancel',event=>{if(creating)event.preventDefault();});
      listen(dialog,'close',()=>dialog.remove());
      listen(form,'submit',async event=>{
        event.preventDefault();if(creating||busy||blocked||disposed||!input.value.trim())return;
        const turn=serial;creating=true;busy=true;controls();submit.disabled=cancel.disabled=true;input.disabled=true;
        try{
          const result=await bridge.createProject({label:input.value.trim()});
          if(disposed||blocked||turn!==serial)return;
          if(result?.ok===true){note.textContent='Opening your project…';return;}
          note.textContent=message(result);
        }catch{if(!disposed&&!blocked&&turn===serial)note.textContent='Creation failed. Your existing projects were retained.';}
        finally{if(!disposed&&!blocked&&turn===serial){creating=false;busy=false;controls();submit.disabled=cancel.disabled=false;input.disabled=false;input.focus();}}
      });dialog.showModal();input.focus();
    };
    const paint=value=>{
      clear();state=value;container.hidden=false;container.className='home-root';
      const top=make('header',container,undefined,'home-topbar');make('span',top,'SIREN','home-brand');make('span',top,'Home','home-current');
      const tools=make('div',top,undefined,'home-topbar-tools');
      const settings=button(tools,'PIN settings',()=>window.sirenDesktopShowPin?.('change'),{id:'homePinSettings'});unavailable(settings,typeof window.sirenDesktopShowPin!=='function'||typeof desktop?.changePin!=='function');
      const lock=button(tools,'Lock',async()=>{
        if(busy||blocked||disposed)return;cover();
        // Native invalidation starts before any animation await.
        const operation=Promise.resolve().then(()=>desktop.lockPin());
        const animation=window.sirenHomeCloseVault?.();
        let result;try{result=await operation;}catch{}
        await animation;if(disposed)return;
        if(result?.ok===true){location.reload();return;}
        document.getElementById('sirenLockVault').hidden=true;blocked=false;await refresh();say(message(result));
      },{id:'homeLock'});unavailable(lock,typeof desktop?.lockPin!=='function');
      const content=make('div',container,undefined,'home-content');
      const greeting=make('div',content,undefined,'home-greeting');make('p',greeting,'YOUR WORKSPACE','home-eyebrow');make('h1',greeting,'Where ideas connect.');make('p',greeting,'Pick up where you left off, or start something new.','home-subtitle');
      if(value.mode!=='normal'){const warning=make('p',content,value.mode==='recovery'?'Recovery mode · Existing work is retained. Review recovery before editing.':'Read-only mode · You can inspect existing work. Editing is unavailable.','home-warning');warning.setAttribute('role','status');}
      const hero=make('section',content,undefined,'home-resume');
      const previous=value.continuation,project=previous&&value.projects.find(p=>p.projectId===previous.location.projectId);
      if(previous){make('span',hero,'CONTINUE WORK','home-eyebrow');make('h2',hero,project?.label||'Local project');const surface=modules.find(m=>m[0]===previous.location.surface)?.[1]||'Project overview';make('p',hero,previous.reason?message({code:previous.reason}):`${surface} · Your last recorded location`,'home-subtitle');const resume=button(hero,'Continue work',()=>perform('continueWork',{}),{className:'home-primary',id:'homeContinue'});unavailable(resume,previous.availability==='missing'||typeof bridge?.continueWork!=='function');}
      else{make('span',hero,'A FRESH START','home-eyebrow');make('h2',hero,'Make room for your next idea.');make('p',hero,'Create a local project or open your existing work.','home-subtitle');}
      const start=make('div',hero,undefined,'home-start-actions');const newProject=button(start,'New project',create,{id:'homeNewProject',className:previous?'home-secondary':'home-primary'});unavailable(newProject,value.mode!=='normal'||typeof bridge?.createProject!=='function');
      const open=button(start,'Open project…',()=>perform('importProject',{}),{id:'homeImportProject',className:'home-secondary'});unavailable(open,typeof bridge?.importProject!=='function');
      const moduleHeading=make('div',content,undefined,'home-section-heading');make('h2',moduleHeading,'Explore your project');make('span',moduleHeading,'One context. Four perspectives.');
      const grid=make('div',content,undefined,'home-module-grid');
      for(const [surface,title,description,icon] of modules){const enabled=value.selectedProjectId!==null&&value.capabilities[surface]===true&&typeof bridge?.openModule==='function';
        const card=button(grid,'',()=>perform('openModule',{surface}),{className:'home-module',id:'homeModule-'+surface});
        make('span',card,icon,'home-module-icon');make('strong',card,title);make('span',card,description,'home-module-description');
        // A visible limitation does not advertise an unconnected editor.
        const available=enabled===true;unavailable(card,!available);if(!available)make('small',card,value.selectedProjectId===null?'Open a project first':'Not available in this build');
      }
      const projects=make('section',content,undefined,'home-projects');const heading=make('div',projects,undefined,'home-section-heading');make('h2',heading,'Recent projects');make('span',heading,'On this computer');
      if(!value.projects.length)make('p',projects,'Your projects will appear here after you open them.','home-empty');
      for(const project of value.projects){const row=button(projects,'',()=>perform('openProject',{projectId:project.projectId}),{className:'home-project-row'});row.dataset.projectId=project.projectId;const details=make('span',row,undefined,'home-project-details');make('strong',details,project.label||'Local project');make('small',details,project.availability==='missing'?'Unavailable':project.availability==='recovery'?'Needs recovery':project.availability==='cached'?'Recorded locally · checked when opened':'Local project');make('span',row,'↗','home-project-arrow');unavailable(row,project.availability==='missing'||typeof bridge?.openProject!=='function');}
      const footer=make('footer',content);const currentStatus=make('p',footer,'','home-status');currentStatus.id='homeStatus';currentStatus.setAttribute('role','status');currentStatus.setAttribute('aria-live','polite');make('small',footer,'Your work stays on this computer.');
      controls();
    };
    const refresh=async()=>{
      if(disposed||blocked)return false;
      const turn=++serial;busy=false;
      try{const result=await bridge?.getHomeState?.({});if(disposed||blocked||turn!==serial)return false;
        if(!result?.ok||!result.state){clear();container.hidden=false;make('h1',container,'Home');make('p',container,message(result)).setAttribute('role','status');return false;}
        paint(result.state);return true;
      }catch{if(!disposed&&!blocked&&turn===serial){clear();container.hidden=false;make('p',container,'Home could not load. Existing work was retained.').setAttribute('role','status');}return false;}
    };
    if(typeof bridge?.onInvalidated==='function')off=bridge.onInvalidated(cover);
    return Object.freeze({refresh,cover,dispose:()=>{if(disposed)return;disposed=true;cover();off?.();}});
  };
  const start=()=>{
    const boot=window.sirenDesktopBootstrap;
    if(!boot||boot.mode==='locked')return;
    delete document.documentElement.dataset.desktopLocked;
    const home=window.renderSirenHome({container:document.getElementById('homeRoot'),bridge:window.sirenHome,desktop:window.sirenDesktop,bootstrap:boot});
    window.sirenHomeView=home;
    void home.refresh().finally(()=>window.sirenDesktopReady?.());
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
