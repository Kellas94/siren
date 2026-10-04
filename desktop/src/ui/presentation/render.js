(() => {
 'use strict';
 const host=document.getElementById('renderHost');let busy=false;
 const fail=()=>{throw Error('Presentation preview refused');};
 function sanitize(svg){
  const documentSvg=new DOMParser().parseFromString(svg,'image/svg+xml'),root=documentSvg.documentElement;
  if(root.localName!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg'||documentSvg.querySelector('parsererror'))fail();
  for(const node of root.querySelectorAll('script,foreignObject,iframe,object,embed,link,image,use'))node.remove();
  for(const node of [root,...root.querySelectorAll('*')]){
   for(const attr of [...node.attributes]){const name=attr.localName.toLowerCase(),value=attr.value;
    if(name.startsWith('on')||name==='href'&&!value.startsWith('#')||/@import/i.test(value)||[...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].some(match=>!match[2].trim().startsWith('#')))node.removeAttributeNode(attr);
   }
   if(node.localName==='style')node.textContent=node.textContent.replace(/@import[^;]*;/gi,'').replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(all,_quote,url)=>url.trim().startsWith('#')?all:'none');
  }
  return document.importNode(root,true);
 }
 function focusNode(root,id){
  const prefixes=['presentationPublic-flowchart-'+id+'-','flowchart-'+id+'-'];
  const matches=[...root.querySelectorAll('.node')].filter(node=>node.getAttribute('data-id')===id||prefixes.some(prefix=>node.id.startsWith(prefix)&&/^\d+$/.test(node.id.slice(prefix.length))));if(matches.length!==1)fail();const node=matches[0];
  const box=node.getBBox(),matrix=root.getCTM().inverse().multiply(node.getCTM()),points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
  const x=Math.min(...points.map(point=>point.x)),y=Math.min(...points.map(point=>point.y)),width=Math.max(...points.map(point=>point.x))-x,height=Math.max(...points.map(point=>point.y))-y,padding=Math.max(40,width*.45,height*.45);
  if(![x,y,width,height,padding].every(Number.isFinite)||width<=0||height<=0)fail();root.setAttribute('viewBox',`${x-padding} ${y-padding} ${width+padding*2} ${height+padding*2}`);
 }
 if(window.__SIREN_ELK)window.mermaid.registerLayoutLoaders(window.__SIREN_ELK);
 window.sirenRenderPublicSlide=async input=>{
  if(busy)fail();busy=true;let url;
  try{
   if(!input||typeof input!=='object'||typeof input.slide?.title!=='string'||input.slide.title.length>256||typeof input.context?.source!=='string'||input.context.source.length>50000)fail();
   const entry=input.slide.render?.entry;if(!entry||!['overview','node','section','chapter'].includes(entry.type))fail();
   host.replaceChildren();const dark=matchMedia('(prefers-color-scheme: dark)').matches,canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;const context=canvas.getContext('2d',{alpha:false});if(!context)fail();context.fillStyle=dark?'#171719':'#ffffff';context.fillRect(0,0,1600,900);
   if(['section','chapter'].includes(entry.type)){
    const title=document.createElement('h1');title.textContent=input.slide.title;host.append(title);context.fillStyle=dark?'#e9ebf3':'#20283a';context.font='600 58px system-ui';context.textAlign='center';
    const words=input.slide.title.split(/\s+/),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(line&&context.measureText(next).width>1300){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);if(lines.length>6)fail();lines.forEach((line,index)=>context.fillText(line,800,450+(index-(lines.length-1)/2)*76));
   }else{
    window.mermaid.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,theme:dark?'dark':'default',maxTextSize:50000,maxEdges:500,htmlLabels:false,flowchart:{htmlLabels:false},secure:['secure','securityLevel','startOnLoad','maxTextSize','maxEdges','htmlLabels','suppressErrorRendering']});
    const result=await window.mermaid.render('presentationPublic',input.context.source,host),root=sanitize(result.svg);host.replaceChildren(root);
    if(entry.type==='node'){if(typeof entry.nodeId!=='string')fail();focusNode(root,entry.nodeId);}
    root.setAttribute('width','1600');root.setAttribute('height','900');root.removeAttribute('style');root.setAttribute('preserveAspectRatio','xMidYMid meet');
    url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'}));const image=new Image();image.src=url;await image.decode();context.drawImage(image,0,0,1600,900);
   }
   const image=canvas.toDataURL('image/png');if(image.length>2800000)fail();return {kind:'image',title:input.slide.title,image};
  }finally{if(url)URL.revokeObjectURL(url);busy=false;}
 };
 window.sirenPresentationRenderReady=true;
})();
