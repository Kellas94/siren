(() => {
 'use strict';
 const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 window.SirenPresenterNotesExport=Object.freeze({create({button,revealButton,bridge,getState,isReady,onStatus}){
  let pending=null,receipt=null,covered=false,disposed=false,serial=0;
  const identity=()=>{const d=getState()?.deck;return d&&typeof d.deckId==='string'&&hash(d.version)?{deckId:d.deckId,deckVersion:d.version}:null;};
  const same=(a,b)=>a&&b&&a.deckId===b.deckId&&a.deckVersion===b.deckVersion;
  const allowed=()=>!covered&&!disposed&&isReady()&&identity();
  const update=()=>{if(receipt&&!same(receipt,identity()))receipt=null;button.disabled=!allowed()||!!pending;revealButton.hidden=!receipt||covered||disposed;revealButton.disabled=!allowed()||!!pending;};
  const valid=(r,expected)=>r?.ok===true&&Object.keys(r).sort().join(',')==='bytes,deckId,deckVersion,exportId,filename,ok,sha256'&&same(r,expected)&&typeof r.exportId==='string'&&/^[a-f0-9-]{36}$/.test(r.exportId)&&r.filename==='presentation-notes-'+r.exportId+'.txt'&&hash(r.sha256)&&Number.isSafeInteger(r.bytes)&&r.bytes>0&&r.bytes<=8*1024*1024;
  const start=()=>{
   if(!allowed()||pending)return;const expected=identity(),turn=serial;receipt=null;onStatus('Exporting captured notes…');
   pending=Promise.resolve().then(()=>bridge.exportNotes({deckVersion:expected.deckVersion})).then(result=>{
    if(covered||disposed||turn!==serial)return;
    if(!same(expected,identity())||!valid(result,expected)){onStatus('Notes export unavailable or presentation changed. Your captured notes and saved deck are retained.');return;}
    receipt=result;onStatus('Captured notes saved · '+result.filename+' · Refresh to include newer saved changes.');
   }).catch(()=>{if(!covered&&!disposed&&turn===serial)onStatus('Notes export unavailable. Your captured notes and saved deck are retained.');}).finally(()=>{pending=null;update();});update();
  };
  const reveal=()=>{
   if(!allowed()||pending||!receipt||!same(receipt,identity()))return;const turn=serial,current=receipt;
   pending=Promise.resolve().then(()=>bridge.revealExport({exportId:current.exportId})).then(result=>{if(!covered&&!disposed&&turn===serial&&same(current,identity())&&result?.ok!==true){receipt=null;onStatus('Exported file unavailable or changed. Your notes are retained.');}}).catch(()=>{if(!covered&&!disposed&&turn===serial){receipt=null;onStatus('Exported file unavailable. Your notes are retained.');}}).finally(()=>{pending=null;update();});update();
  };
  button.addEventListener('click',start);revealButton.addEventListener('click',reveal);update();
  return Object.freeze({update,reset(){serial++;receipt=null;update();},pause(){covered=true;serial++;receipt=null;update();return pending?pending.then(()=>({ok:true})): {ok:true};},resume(){if(!disposed){covered=false;update();}},dispose(){disposed=true;covered=true;serial++;receipt=null;button.removeEventListener('click',start);revealButton.removeEventListener('click',reveal);update();}});
 }});
})();
