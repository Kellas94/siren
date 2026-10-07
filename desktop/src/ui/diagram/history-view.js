(() => {
 'use strict';
 window.SirenNativeDiagramHistoryView=Object.freeze({create({host,draftFor,enabled,commit,onRestore,onStatus}){
  let disposed=false;
  const make=(tag,parent,text,id)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(id)e.id=id;parent.append(e);return e;};
  const undo=make('button',host,'Undo','diagramUndo'),redo=make('button',host,'Redo','diagramRedo'),toggle=make('button',host,'History','diagramHistoryToggle');
  for(const button of [undo,redo,toggle])button.type='button';undo.title='Undo source or style · Ctrl + Z';redo.title='Redo source or style · Ctrl + Shift + Z';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','diagramHistoryPanel');
  const panel=make('section',host,undefined,'diagramHistoryPanel');panel.hidden=true;panel.setAttribute('aria-label','Source and style history');const label=make('label',panel,'Source & style · Restore as unsaved edit');label.setAttribute('for','diagramHistorySteps');const steps=make('select',panel,undefined,'diagramHistorySteps'),note=make('p',panel,'');note.className='diagram-history-note';
  function paint(){if(disposed)return;const draft=draftFor(),history=draft?.getHistory(),allowed=enabled()&&!!history;undo.disabled=!allowed||history.index<1;redo.disabled=!allowed||history.index>=history.entries.length-1;toggle.disabled=!history;steps.disabled=!allowed;
   steps.replaceChildren();for(const [index,entry]of (history?.entries||[]).entries()){const option=make('option',steps,(index+1)+' · '+entry.label);option.value=entry.id;}steps.value=history?.entries[history.index]?.id||'';note.textContent='Local window only · Up to 60 steps / 8 MiB · Save explicitly. Presentation edits are separate.';
  }
  function run(action,id){if(disposed||!enabled())return false;const own=draftFor();if(!own)return false;if(!commit()){onStatus('Finish or cancel pending fields before restoring history');paint();return false;}if(disposed||!enabled()||draftFor()!==own)return false;
   const result=action==='jump'?own.restoreHistory(id):own[action]();if(result.ok){onRestore();onStatus('Source and style restored · Save diagram to keep this version');}else onStatus('History unavailable · Your current work is retained');paint();return result.ok===true;
  }
  undo.addEventListener('click',()=>run('undo'));redo.addEventListener('click',()=>run('redo'));steps.addEventListener('change',()=>run('jump',steps.value));toggle.addEventListener('click',()=>{if(disposed)return;panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));paint();});
  paint();
  return Object.freeze({paint,keydown(event,sourceInput){
   if(disposed||event.defaultPrevented||event.isComposing||event.altKey||!(event.ctrlKey||event.metaKey))return false;const key=event.key.toLowerCase();if(key!=='z'&&(key!=='y'||event.shiftKey))return false;
   if(event.target!==sourceInput&&event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return false;
   event.preventDefault();if(event.repeat)return false;return run(key==='y'||event.shiftKey?'redo':'undo');
  },dispose(){disposed=true;host.replaceChildren();}});
 }});
})();
