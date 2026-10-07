(() => {
 'use strict';
 const roles=Object.freeze({code:'⌘ Code',docs:'Docs',diagram:'Diagrams'});
 const label=(value,fallback)=>{
  if(typeof value!=='string')return fallback;
  const cleaned=value.slice(0,1024).toWellFormed().replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim();
  const short=cleaned.slice(0,120);return (/[\uD800-\uDBFF]$/.test(short)?short.slice(0,-1):short)||fallback;
 };
 function clear(role){const title=roles[role];if(!title)return;document.title='SIREN — '+title;const heading=document.getElementById('viewTitle');if(heading){heading.textContent=title;heading.title='';}}
 function set({role,name,version,revision,readonly,dirty=false}){
  const title=roles[role];if(!title)return;
  const text=label(name,title),versionText=Number.isSafeInteger(version)&&version>0?' · v'+version:Number.isSafeInteger(revision)&&revision>0?' · r'+revision:'';
  document.title='SIREN — '+title+' — '+text+versionText+' · '+(readonly?'Read only':'Working copy')+(dirty&&!readonly?' · Unsaved':'');
  const heading=document.getElementById('viewTitle');if(heading){heading.textContent=title+' · '+text;heading.title=document.title;}
 }
 window.SirenNativeViewIdentity=Object.freeze({set,clear});
})();
