(() => {
 'use strict';
 const caption=value=>String(value??'').slice(0,512).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
 function renderedCaption(group){
  const texts=group.querySelectorAll?.('text');if(!texts?.length)return caption(group.textContent);
  const parts=[];let remaining=512;const take=value=>{const part=String(value??'').slice(0,Math.max(0,remaining));parts.push(part);remaining-=part.length+1;};
  for(let i=0;i<Math.min(16,texts.length)&&remaining>0;i++){
   // Mermaid's outer rows separate graphical lines. Their inner spans may
   // split one styled word, so only add separators between whole rows.
   const lines=texts[i].querySelectorAll('tspan.text-outer-tspan');
   if(lines.length){for(let j=0;j<Math.min(32,lines.length)&&remaining>0;j++)take(lines[j].textContent);}else take(texts[i].textContent);
  }return caption(parts.join(' '));
 }
 const validRect=r=>r&&[r.left,r.top,r.width,r.height].every(n=>Number.isFinite(n)&&Math.abs(n)<1e7)&&r.width>0&&r.height>0;
 window.SirenNativeDiagramWalkthrough=Object.freeze({create({host,overlay,viewport,enabled=()=>true,onFocus=()=>{},onOverview=()=>{}}){
  let disposed=false,paused=false,root=null,rows=[],index=-1;
  const make=(id,text)=>{const b=document.createElement('button');b.id=id;b.type='button';b.textContent=text;return b;};
  const startButton=make('diagramWalkthroughStart','Walk through'),previous=make('diagramWalkthroughPrevious','Previous'),next=make('diagramWalkthroughNext','Next'),overviewButton=make('diagramWalkthroughOverview','Overview'),label=document.createElement('span');
  label.id='diagramWalkthroughLabel';label.setAttribute('role','status');label.setAttribute('aria-live','polite');label.setAttribute('aria-atomic','true');host.setAttribute('role','group');host.setAttribute('aria-label','Walk through diagram blocks');host.append(startButton,previous,label,next,overviewButton);
  function available(){return !disposed&&!paused&&enabled()&&root?.isConnected===true;}
  function paint(){if(disposed)return;const active=index>=0;startButton.hidden=active;startButton.disabled=!available()||!rows.length;startButton.textContent=rows.length?'Walk through · '+rows.length+' blocks'+(rows.length===250?' shown':''):'Walk through';startButton.title=rows.length?'Explore rendered blocks without changing the diagram · Up to 250 semantic IDs and 8 groups per block':'Available after a supported diagram preview renders';previous.hidden=next.hidden=overviewButton.hidden=label.hidden=!active;previous.disabled=index<=0;next.disabled=index>=rows.length-1;label.textContent=active?(index+1)+' / '+rows.length+' · '+rows[index].label:'';label.title=label.textContent;host.dataset&&(host.dataset.walkthroughActive=String(active));}
  function invalidate(){root=null;rows=[];index=-1;overlay.hidden=true;paint();}
  function bounds(row){if(!available()||!row)return null;let result=null;for(const group of row.groups){if(group.isConnected!==true||!root.contains(group))continue;const r=group.getBoundingClientRect();if(!validRect(r))continue;result=result?{left:Math.min(result.left,r.left),top:Math.min(result.top,r.top),right:Math.max(result.right,r.left+r.width),bottom:Math.max(result.bottom,r.top+r.height)}:{left:r.left,top:r.top,right:r.left+r.width,bottom:r.top+r.height};}return result?{left:result.left,top:result.top,width:result.right-result.left,height:result.bottom-result.top}:null;}
  function updateGeometry(){if(index<0||!available()){overlay.hidden=true;return false;}const b=bounds(rows[index]),v=viewport.getBoundingClientRect(),sx=v.width/viewport.offsetWidth,sy=v.height/viewport.offsetHeight;if(!b||!validRect(v)||!Number.isFinite(sx)||!Number.isFinite(sy)||sx<=0||sy<=0){invalidate();return false;}
   const left=(b.left-v.left)/sx-viewport.clientLeft,top=(b.top-v.top)/sy-viewport.clientTop,right=left+b.width/sx,bottom=top+b.height/sy;
   const x=Math.max(0,left),y=Math.max(0,top),width=Math.min(viewport.clientWidth,right)-x,height=Math.min(viewport.clientHeight,bottom)-y;
   if(width<=0||height<=0){overlay.hidden=true;return false;}Object.assign(overlay.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});overlay.hidden=false;return true;
  }
  function select(value){if(!available()||!Number.isInteger(value)||value<0||value>=rows.length)return false;const b=bounds(rows[value]);if(!b){invalidate();return false;}index=value;paint();onFocus(Object.freeze(b));updateGeometry();return true;}
  const fieldFocused=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable===true;
  function start(){if(index>=0||!select(0))return false;if(!fieldFocused())overviewButton.focus();return true;}
  function step(delta){return index>=0&&(delta===1||delta===-1)?select(index+delta):false;}
  function overview(){if(index<0||!available())return false;index=-1;overlay.hidden=true;paint();onOverview();if(!fieldFocused())startButton.focus();return true;}
  function bind(svg,targets){invalidate();if(disposed||paused||!enabled()||svg?.isConnected!==true||!Array.isArray(targets))return false;root=svg;const ids=new Map();for(let i=0;i<Math.min(250,targets.length);i++){
    const t=targets[i];if(!t||typeof t.id!=='string'||!/^[A-Za-z_][\w.-]{0,199}$/.test(t.id)||!Array.isArray(t.groups))continue;let row=ids.get(t.id);const admitted=[];for(let g=0;g<Math.min(8,t.groups.length);g++){const group=t.groups[g];if(group?.isConnected===true&&root.contains(group)&&!admitted.includes(group)&&!row?.groups.includes(group))admitted.push(group);}
    if(!admitted.length)continue;if(row){row.groups.push(...admitted.slice(0,8-row.groups.length));continue;}row={id:t.id,label:renderedCaption(admitted[0])||t.id,groups:admitted};ids.set(t.id,row);rows.push(row);
   }paint();return rows.length>0;
  }
  const keydown=event=>{if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||!host.contains(event.target)||event.target?.tagName!=='BUTTON'||index<0||!available())return;if(!['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))return;event.preventDefault();if(event.repeat)return;if(event.key==='Escape')overview();else if(event.key==='Home')select(0);else if(event.key==='End')select(rows.length-1);else step(event.key==='ArrowRight'?1:-1);};
  // Prevent mouse focus from blurring an unfinished form field. Its normal
  // change handler remains authoritative when the user deliberately leaves it.
  const pointerdown=event=>{if(event.button===0&&host.contains(event.target)&&event.target?.tagName==='BUTTON'&&fieldFocused())event.preventDefault();};
  startButton.addEventListener('click',start);previous.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));overviewButton.addEventListener('click',overview);host.addEventListener('keydown',keydown);host.addEventListener('pointerdown',pointerdown);overlay.hidden=true;paint();
  return Object.freeze({bind,invalidate,start,step,overview,updateGeometry,getState:()=>Object.freeze({active:index>=0,index,count:rows.length,label:rows[index]?.label??''}),pause(){paused=true;invalidate();},resume(){if(disposed)return;paused=false;invalidate();},dispose(){if(disposed)return;invalidate();disposed=true;host.removeEventListener('keydown',keydown);host.removeEventListener('pointerdown',pointerdown);host.replaceChildren();}});
 }});
})();
