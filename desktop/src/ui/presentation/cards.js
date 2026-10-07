(() => {
 'use strict';const fail=()=>{throw Error('Public card refused');},finiteText=(value,max)=>typeof value==='string'&&value.isWellFormed()&&value.length<=max;
 function plainHtml(html){
  const parsed=new DOMParser().parseFromString(html,'text/html'),allowed=new Set(['P','DIV','H1','H2','H3','H4','H5','H6','UL','OL','LI','BR','STRONG','B','EM','I','U','S','SPAN','BLOCKQUOTE','CODE','PRE','A']),out=[];let count=0;
  const walk=(parent,depth=0)=>{if(depth>32)fail();let ordinal=0;for(const node of parent.childNodes){if(++count>2048)fail();if(node.nodeType===3){out.push(node.nodeValue);continue;}if(node.nodeType!==1||node.namespaceURI!=='http://www.w3.org/1999/xhtml'||!allowed.has(node.tagName))continue;
   const tag=node.tagName;if(tag==='BR'){out.push('\n');continue;}
   const block=['P','DIV','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','PRE'].includes(tag);if(block)out.push('\n');
   if(tag==='LI')out.push(parent.tagName==='OL'?String(++ordinal)+'. ':'• ');walk(node,depth+1);if(block)out.push('\n');
  }};walk(parsed.body);const text=out.join('').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();if(!finiteText(text,8000))fail();return text;
 }
 function wrapped(context,text,width){
  const lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){if(context.measureText(word).width>width)return null;const next=line?line+' '+word:word;if(line&&context.measureText(next).width>width){lines.push(line);line=word;}else line=next;}lines.push(line);if(lines.length>256)return null;}return lines;
 }
 function fit(context,text,width,height,start,min,maxLines=256,weight=''){
  for(let size=start;size>=min;size-=2){context.font=`${weight?weight+' ':''}${size}px system-ui`;const lines=wrapped(context,text,width),lineHeight=size*1.4;if(lines&&lines.length<=maxLines&&lines.length*lineHeight<=height)return {size,lines,lineHeight};}fail();
 }
 window.sirenRenderPresentationCard=({card,fallbackTitle,context,host,dark,palette})=>{
  palette??={text:dark?'#e9ebf3':'#20283a',muted:dark?'#d0d4df':'#4c5567',nodeAccent:dark?'#293b60':'#e5edff',nodeAccentBorder:dark?'#84a6ff':'#365fc6',nodeFill:dark?'#202632':'#f6f8fc'};
  if(card?.kind==='table')return tableCard({card,fallbackTitle,context,host,dark,palette});
  if(!card||typeof card!=='object'||!['title','text'].includes(card.kind??'title')||card.reveal===true)fail();
  const kind=card.kind??'title',title=card.title||fallbackTitle,eyebrow=card.eyebrow||'',scale=card.textScale??1,centred=kind==='title'&&card.align==='centre';
  if(!finiteText(title,256)||!finiteText(eyebrow,80)||![0.85,1,1.2,1.45].includes(scale)||card.align!==undefined&&!['left','centre'].includes(card.align))fail();
  let body;if(card.html){if(!finiteText(card.html,32768))fail();body=plainHtml(card.html);}else{body=card.body??'';if(!finiteText(body,8000))fail();}
  const width=1360,x=centred?800:120;let y=112;context.fillStyle=palette.nodeAccentBorder;context.fillRect(120,68,52,5);
  const visible=document.createElement('div'),heading=document.createElement('h1');heading.textContent=title;visible.append(heading);host.append(visible);
  if(eyebrow){context.font='600 26px system-ui';if(context.measureText(eyebrow).width>width)fail();context.textAlign=centred?'center':'left';context.fillText(eyebrow,x,y);y+=60;const label=document.createElement('p');label.textContent=eyebrow;visible.append(label);}
  const titleLayout=fit(context,title,width,260,Math.round((kind==='title'?76:62)*scale),32,3,'600');context.font=`600 ${titleLayout.size}px system-ui`;context.fillStyle=palette.text;context.textAlign=centred?'center':'left';
  for(const line of titleLayout.lines){context.fillText(line,x,y+titleLayout.size);y+=titleLayout.lineHeight;}y+=42;
  if(body){const layout=fit(context,body,width,820-y,Math.round((kind==='title'?38:32)*scale),18);context.font=`${layout.size}px system-ui`;context.fillStyle=palette.muted;for(const line of layout.lines){context.fillText(line,x,y+layout.size);y+=layout.lineHeight;}const paragraph=document.createElement('p');paragraph.textContent=body;visible.append(paragraph);}
 };
 function tableCard({card,fallbackTitle,context,host,dark,palette}){
  const rows=card.rows,title=card.title||fallbackTitle,eyebrow=card.eyebrow||'';
  if(card.reveal===true||!finiteText(title,256)||!finiteText(eyebrow,80)||!Array.isArray(rows)||rows.length<1||rows.length>20||!Array.isArray(rows[0])||rows[0].length<1||rows[0].length>12||rows.some(row=>!Array.isArray(row)||row.length!==rows[0].length||row.some(cell=>!finiteText(cell,1000)))||card.headerRow!==undefined&&typeof card.headerRow!=='boolean')fail();
  const width=1360,cellWidth=width/rows[0].length,titleLayout=fit(context,title,width,150,54,30,3,'600'),start=110+titleLayout.lines.length*titleLayout.lineHeight+(eyebrow?44:0);let layout;
  for(let size=26;size>=14;size-=2){context.font=`${size}px system-ui`;const cells=rows.map(row=>row.map(cell=>wrapped(context,cell,cellWidth-24)));if(cells.some(row=>row.some(cell=>!cell)))continue;const heights=cells.map(row=>Math.max(...row.map(lines=>lines.length))*size*1.4+20);if(heights.reduce((sum,h)=>sum+h,0)<=820-start){layout={size,cells,heights};break;}}
  if(!layout)fail();if(eyebrow){context.font='600 24px system-ui';if(context.measureText(eyebrow).width>width)fail();}
  const visible=document.createElement('div'),heading=document.createElement('h1');heading.textContent=title;visible.append(heading);const table=document.createElement('table'),body=document.createElement('tbody');table.append(body);visible.append(table);for(const [r,row]of rows.entries()){const tr=document.createElement('tr');body.append(tr);for(const cell of row){const td=document.createElement(r===0&&card.headerRow?'th':'td');td.textContent=cell;tr.append(td);}}
  context.fillStyle=palette.nodeAccentBorder;context.fillRect(120,68,52,5);context.textAlign='left';let y=112;if(eyebrow){context.font='600 24px system-ui';context.fillText(eyebrow,120,y);y+=44;}context.font=`600 ${titleLayout.size}px system-ui`;context.fillStyle=palette.text;for(const line of titleLayout.lines){context.fillText(line,120,y+titleLayout.size);y+=titleLayout.lineHeight;}y=start;
  context.font=`${layout.size}px system-ui`;for(const [r,row]of layout.cells.entries()){const h=layout.heights[r];for(const [c,lines]of row.entries()){const x=120+c*cellWidth;context.fillStyle=r===0&&card.headerRow?(palette.nodeAccent):(palette.nodeFill);context.fillRect(x,y,cellWidth-2,h-2);context.fillStyle=palette.text;for(const [i,line]of lines.entries())context.fillText(line,x+12,y+10+layout.size+i*layout.size*1.4);}y+=h;}host.append(visible);
 }
})();
