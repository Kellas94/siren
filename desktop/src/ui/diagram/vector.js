(() => {
 'use strict';const host=document.getElementById('renderHost'),NS='http://www.w3.org/2000/svg';let busy=false;
 const fail=()=>{throw Error('Diagram vector refused');};
 const allowed=new Set(['svg','g','path','rect','line','polyline','polygon','circle','ellipse','text','tspan','defs','marker','clipPath','mask','linearGradient','radialGradient','stop','filter','feGaussianBlur','feOffset','feColorMatrix','feBlend','feComposite','feMerge','feMergeNode','feFlood','style','title','desc','a']);
 const safeCss=value=>!/[\\]|@/u.test(value)&&[...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].every(match=>/^#[A-Za-z_][\w:.-]*$/.test(match[2].trim()));
 function sanitizedStyles(text){
  // Keep ordinary local Mermaid rules (including label alignment). Discard
  // imports, fonts, animation and other at-rules without losing the entire
  // stylesheet; retain only declarations with safe local fragment URLs.
  const sheet=new CSSStyleSheet();sheet.replaceSync(text);const rules=[];
  for(const rule of sheet.cssRules){if(rule.type!==CSSRule.STYLE_RULE||!safeCss(rule.selectorText))continue;const declarations=[];
   for(const property of rule.style){const value=rule.style.getPropertyValue(property);if(safeCss(value))declarations.push(property+':'+value+(rule.style.getPropertyPriority(property)?' !important':'')+';');}
   if(declarations.length)rules.push(rule.selectorText+'{'+declarations.join('')+'}');
  }return rules.join('\n');
 }
 function sanitize(svg){
  const parsed=new DOMParser().parseFromString(svg,'image/svg+xml'),root=parsed.documentElement;if(root.localName!=='svg'||root.namespaceURI!==NS||parsed.querySelector('parsererror')||parsed.doctype)fail();
  for(const node of root.querySelectorAll('*'))if(node.namespaceURI!==NS||!allowed.has(node.localName))node.remove();
  for(const node of [root,...root.querySelectorAll('*')]){
   for(const attr of [...node.attributes]){const key=attr.localName.toLowerCase(),value=attr.value;if(key.startsWith('on')||key==='href'&&!/^#[A-Za-z_][\w:.-]*$/.test(value)||!safeCss(value))node.removeAttributeNode(attr);}
   if(node.localName==='style'){node.textContent=sanitizedStyles(node.textContent);if(!node.textContent)node.remove();}
  }
  return document.importNode(root,true);
 }
 function layout(root,diagram,palette){
  const box=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);if(box.length!==4||!box.every(Number.isFinite)||box[2]<=0||box[3]<=0||box.some(value=>Math.abs(value)>1000000))fail();
  let [x,y,width,height]=box;const title=diagram.diagramTitleTouched&&typeof diagram.diagramTitle==='string'?diagram.diagramTitle:'';
  if(title){if(title.length>512)fail();const text=document.createElementNS(NS,'text');text.textContent=title;text.setAttribute('font-family','system-ui,sans-serif');text.setAttribute('font-size','16');text.setAttribute('font-weight','600');text.setAttribute('text-anchor','middle');text.setAttribute('fill',palette.text);text.setAttribute('x',String(x+width/2));text.setAttribute('y',String(y-18));root.append(text);const measured=text.getComputedTextLength();if(!Number.isFinite(measured))fail();if(measured+32>width){x-=(measured+32-width)/2;width=measured+32;}y-=44;height+=44;}
  const background=document.createElementNS(NS,'rect');for(const [key,value]of Object.entries({x,y,width,height,fill:palette.canvasBg}))background.setAttribute(key,String(value));root.insertBefore(background,root.firstChild);
  root.setAttribute('viewBox',[x,y,width,height].join(' '));root.setAttribute('width',String(Math.ceil(width)));root.setAttribute('height',String(Math.ceil(height)));root.setAttribute('preserveAspectRatio','xMidYMid meet');root.removeAttribute('style');root.setAttribute('role','img');
 }
 if(window.__SIREN_ELK)window.mermaid.registerLayoutLoaders(window.__SIREN_ELK);
 async function render(input,embed){
  if(busy)fail();busy=true;try{
   const diagram=input?.diagram,source=diagram?.source,contract=window.SirenNativeDiagramStyle.appearance;if(!diagram||typeof source!=='string'||source.length>50000||input.renderAppearance===undefined&&!['light','dark'].includes(input.appearance))fail();const capsule=input.renderAppearance===undefined?contract.resolve(input.appearance,false):contract.read(input.renderAppearance),palette=contract.palette(capsule);host.replaceChildren();
   const provenance=await window.SirenNativeDiagramStyle.prepare({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,maxTextSize:50000,maxEdges:500,htmlLabels:false,flowchart:{htmlLabels:false},secure:['secure','securityLevel','startOnLoad','maxTextSize','maxEdges','htmlLabels','suppressErrorRendering']},source,diagram,capsule);
   const result=await window.mermaid.render('diagramVector',source,host),root=embed?document.importNode(new DOMParser().parseFromString(window.SirenDiagramEmbedSvg.sanitizeDiagramEmbedSvg(result.svg),'image/svg+xml').documentElement,true):sanitize(result.svg);host.replaceChildren(root);window.SirenNativeDiagramStyle.apply(root,diagram,provenance);layout(root,diagram,{...palette,canvasBg:provenance.surfaceBackground??palette.canvasBg});
   let svg=new XMLSerializer().serializeToString(root);if(new TextEncoder().encode(svg).length>2*1024*1024)fail();if(!embed)return svg;
   svg=window.SirenDiagramEmbedSvg.sanitizeDiagramEmbedSvg(svg);
   const rendererVersion='mermaid@12.0.0/R78',bytes=new TextEncoder().encode(JSON.stringify({rendererVersion,capsule,svg})),styleHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');return {svg,rendererVersion,styleHash};
  }finally{host.replaceChildren();busy=false;}
 }
 window.sirenRenderDiagramVector=input=>render(input,false);
 window.sirenRenderDiagramEmbed=input=>render(input,true);
 window.sirenDiagramVectorReady=true;
})();
