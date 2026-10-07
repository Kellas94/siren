(() => {
 'use strict';
 const resolver=window.SirenHelpResolver,catalog=window.SirenHelpCatalog;
 if(!resolver||!Array.isArray(catalog))return;
 const read=(object,key)=>{try{const d=Object.getOwnPropertyDescriptor(object,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
 window.SirenHelp=Object.freeze({create({document,isAvailable}={}){
  if(!document||typeof isAvailable!=='function')throw TypeError('HELP_VIEW_ADAPTERS_REQUIRED');
  let dialog=null,disposed=false,initiator=null,currentArticle=null,contextIdentity=null;
  const available=()=>{try{return !disposed&&isAvailable()===true;}catch{return false;}};
  const make=(tag,parent,text,id)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(id)node.id=id;parent?.append(node);return node;};
  const button=(parent,text,handler,id)=>{const b=make('button',parent,text,id);b.type='button';b.addEventListener('click',()=>{if(!b.isConnected)return;if(available()&&dialog?.open)handler();else close();});return b;};
  function close(){const old=dialog;dialog=null;currentArticle=contextIdentity=null;if(old){old.replaceChildren();if(old.open)old.close();old.remove();}const prior=initiator;initiator=null;if(prior?.isConnected&&available()&&!document.body.inert)prior.focus();}
  function renderFlow(parent,article){
   const flow=resolver.flow(article.id);if(!flow)return;const section=make('section',parent,undefined,'sirenHelpFlow');section.setAttribute('aria-label','Resolution flow');make('h3',section,'Work through the checks');
   const map=make('div',section,undefined,'sirenHelpFlowMap');map.className='siren-help-flow-map';
   const nodes=new Map();for(const node of flow.nodes){const item=make('div',map,node.label);item.className='siren-help-flow-node';item.dataset.type=node.type;nodes.set(node.id,item);for(const edge of flow.edges.filter(e=>e.from===node.id))make('small',item,edge.label+' → '+flow.nodes.find(n=>n.id===edge.to).label);}
   const current=make('p',section,undefined,'sirenHelpFlowCurrent');current.setAttribute('aria-live','polite');const choices=make('div',section,undefined,'sirenHelpFlowChoices');choices.className='siren-help-flow-choices';
   const step=id=>{if(currentArticle!==article.id||!dialog?.open)return;const node=flow.nodes.find(n=>n.id===id);if(!node)return;
    current.textContent=node.label;for(const [key,element]of nodes)element.dataset.current=String(key===id);choices.replaceChildren();
    for(const edge of flow.edges.filter(e=>e.from===id))button(choices,edge.label,()=>step(edge.to));
   };
   button(section,'Start again',()=>step(flow.nodes[0].id),'sirenHelpFlowReset');
   const details=make('details',section);make('summary',details,'All steps as text');const text=make('ol',details,undefined,'sirenHelpFlowText');
   for(const node of flow.nodes){const li=make('li',text,node.label);for(const edge of flow.edges.filter(e=>e.from===node.id))make('p',li,edge.label+' → '+flow.nodes.find(n=>n.id===edge.to).label);}
   step(flow.nodes[0].id);
  }
  function paintArticle(id){
   if(!available()||!dialog?.open){close();return;}const article=resolver.get(id)||resolver.get('unknown-error');currentArticle=article.id;
   const panel=document.getElementById('sirenHelpArticle');panel.replaceChildren();make('h2',panel,article.title);make('p',panel,article.summary).className='siren-help-summary';
   for(const [key,label]of [['observed','What this means'],['causes','Possible causes'],['checks','What to check'],['recovery','Your next step'],['dataImpact','Your work and saved data']]){make('h3',panel,label);make('p',panel,article[key]);}
   renderFlow(panel,article);const technical=make('details',panel);make('summary',technical,'Technical details');make('p',technical,article.technical);
   if(article.mappings.length)make('p',technical,article.mappings.map(m=>m.namespace+' / '+m.operation+' / '+m.code).join('\n'));
   make('p',technical,'Reference: '+article.sources.join(', '));
   if(article.related.length){const related=make('div',panel);related.className='siren-help-related';for(const target of article.related)button(related,resolver.get(target).title,()=>paintArticle(target));}
  }
  function paintOverview(){
   currentArticle=null;const panel=document.getElementById('sirenHelpArticle');panel.replaceChildren();make('h2',panel,'Find your next step');
   make('p',panel,'Search the manual or choose a topic. Each explanation separates what happened, what remains uncertain and what you can check.').className='siren-help-summary';
   make('h3',panel,'Your work stays yours');make('p',panel,'Reading help does not change your projects or run code. Keep drafts and inspect saved results before repeating an operation.');
   make('h3',panel,'Work through a logical flow');make('p',panel,'Articles about version conflicts include interactive checks. Their diagrams work offline, even when Mermaid cannot render a preview.');
   const suggestions=make('div',panel);suggestions.className='siren-help-related';for(const id of ['project-save','source-import','diagram-render','safe-recovery'])button(suggestions,resolver.get(id).title,()=>paintArticle(id));
  }
  function open(options={}){
   if(!available()){close();return false;}
   const identity=read(options,'errorIdentity'),requested=read(options,'articleId'),context=identity?resolver.resolve(identity):null;
   const target=typeof requested==='string'?resolver.get(requested):context;
   if(!dialog){
    initiator=read(options,'initiator')||document.activeElement;dialog=make('dialog',document.body,undefined,'sirenHelpDiagnostics');dialog.className='siren-help';dialog.setAttribute('aria-labelledby','sirenHelpTitle');
    const header=make('header',dialog);make('h2',header,'Help & diagnostics','sirenHelpTitle');button(header,'Done',close,'sirenHelpClose');
    make('p',dialog,'Understand the result. Keep your work. Choose your next step.').className='siren-help-intro';
    const banner=make('p',dialog,undefined,'sirenHelpContext');banner.setAttribute('role','status');
    const layout=make('div',dialog);layout.className='siren-help-layout';const aside=make('aside',layout);const label=make('label',aside,'Search the manual');label.htmlFor='sirenHelpQuery';
    const query=make('input',aside,undefined,'sirenHelpQuery');query.type='search';query.maxLength=200;query.autocomplete='off';query.placeholder='Error code or topic';
    const categoryLabel=make('label',aside,'Category');categoryLabel.htmlFor='sirenHelpCategory';const category=make('select',aside,undefined,'sirenHelpCategory');
    const all=make('option',category,'All topics');all.value='';for(const key of [...new Set(catalog.map(a=>a.category))].sort()){const option=make('option',category,key[0].toUpperCase()+key.slice(1));option.value=key;}
    const results=make('div',aside,undefined,'sirenHelpResults');results.setAttribute('aria-label','Manual articles');
    const article=make('article',layout,undefined,'sirenHelpArticle');article.tabIndex=0;
    const search=()=>{if(!available()||!dialog?.open){close();return;}results.replaceChildren();const ids=resolver.search({query:query.value,category:category.value});
     for(const id of ids)button(results,resolver.get(id).title,()=>paintArticle(id));if(!ids.length)make('p',results,'No matching articles. Try an error code or a shorter topic.');
    };
    query.addEventListener('input',search);category.addEventListener('change',search);
    const instance=dialog;
    dialog.addEventListener('cancel',e=>{e.preventDefault();if(dialog===instance)close();});dialog.addEventListener('close',()=>{if(dialog===instance)close();});dialog.addEventListener('keydown',e=>{if(dialog===instance&&e.key==='Escape'){e.preventDefault();e.stopPropagation?.();close();}});
    dialog.showModal();search();
   }
   contextIdentity=context&&context.id!=='unknown-error'?context.id:null;
   const code=read(identity,'code'),safeCode=typeof code==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(code)?code:null;
   const banner=document.getElementById('sirenHelpContext');banner.textContent=contextIdentity?'Explanation for the reported '+context.category+' operation'+(safeCode?' · '+safeCode:'')+'.':identity?'Unknown error identity'+(safeCode?' · '+safeCode:'')+'. The exact cause is unavailable.':'Offline reference · No automatic changes to your work.';
   if(target||identity)paintArticle(target?.id||'unknown-error');else paintOverview();document.getElementById('sirenHelpQuery')?.focus();return true;
  }
  return Object.freeze({open,close,dispose(){close();disposed=true;}});
 }});
})();
