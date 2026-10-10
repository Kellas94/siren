// Self-contained for injection into the isolated no-preload vector renderer.
// Refusal preserves the last good visual; this never repairs/strips a diagram.
export function sanitizeDiagramEmbedSvg(svg,{DOMParser=globalThis.DOMParser,XMLSerializer=globalThis.XMLSerializer}={}){
 const refuse=()=>{throw Object.assign(Error('DIAGRAM_EMBED_SVG_REFUSED'),{code:'DIAGRAM_EMBED_SVG_REFUSED'});};
 try{
  const NS='http://www.w3.org/2000/svg',XMLNS='http://www.w3.org/2000/xmlns/',XLINK='http://www.w3.org/1999/xlink';
  if(typeof svg!=='string'||!svg.isWellFormed()||new TextEncoder().encode(svg).length>2097152||/<!DOCTYPE|<!ENTITY|<\?/i.test(svg)||typeof DOMParser!=='function'||typeof XMLSerializer!=='function')refuse();
  const parsed=new DOMParser({onError:refuse}).parseFromString(svg,'image/svg+xml'),root=parsed.documentElement;
  if(!root||root.localName!=='svg'||root.namespaceURI!==NS||parsed.doctype||parsed.getElementsByTagName('parsererror').length)refuse();
  const box=(root.getAttribute('viewBox')??'').trim().split(/[\s,]+/).map(Number);if(box.length!==4||!box.every(v=>Number.isFinite(v)&&Math.abs(v)<=1000000)||box[2]<=0||box[3]<=0)refuse();
  const tags=new Set('svg g path rect line polyline polygon circle ellipse text tspan defs marker clipPath mask linearGradient radialGradient stop filter feGaussianBlur feOffset feColorMatrix feBlend feComposite feMerge feMergeNode feFlood style title desc a use'.split(' '));
  const attrs=new Set('id class viewBox width height x y x1 y1 x2 y2 cx cy r rx ry dx dy d points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit opacity color font-family font-size font-weight font-style text-anchor dominant-baseline alignment-baseline textLength lengthAdjust letter-spacing word-spacing whitespace white-space style href role tabindex focusable preserveAspectRatio marker-start marker-mid marker-end markerWidth markerHeight markerUnits refX refY orient clip-path clip-rule clipPathUnits mask maskUnits maskContentUnits gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity filter filterUnits primitiveUnits stdDeviation in in2 result type values operator k1 k2 k3 k4 mode flood-color flood-opacity'.split(' '));
  const properties=new Set('fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit opacity color font-family font-size font-weight font-style text-anchor dominant-baseline alignment-baseline letter-spacing word-spacing white-space overflow display visibility transform transform-origin transform-box filter clip-path mask marker-start marker-mid marker-end stop-color stop-opacity flood-color flood-opacity max-width height width padding margin line-height text-align vertical-align background-color border-color border-width border-style rx ry animation animation-name animation-duration animation-timing-function animation-iteration-count cursor pointer-events'.split(' '));
  const ids=new Set(),references=[];
  function value(text){
   if(typeof text!=='string'||/[\\@<>\u0000-\u0008\u000b\u000c\u000e-\u001f]|\/\*|\*\/|expression\s*\(/i.test(text))refuse();
   let remaining=text;for(const match of text.matchAll(/url\(\s*(['"]?)(#[A-Za-z_][\w:.-]*)\1\s*\)/gi)){references.push(match[2].slice(1));remaining=remaining.replace(match[0],'');}if(/url\s*\(|(?:https?|file|data|javascript|vbscript):|\/\//i.test(remaining))refuse();
  }
  function declarations(text){
   for(const declaration of text.split(';')){if(!declaration.trim())continue;const at=declaration.indexOf(':');if(at<1)refuse();const property=declaration.slice(0,at).trim().toLowerCase(),v=declaration.slice(at+1).trim();if(!properties.has(property)&&!/^--[a-z][a-z0-9-]*$/.test(property)||!v||/[{}]/.test(v))refuse();value(v);}
  }
  function stylesheet(text){
   if(/[\\]|\/\*|\*\//.test(text))refuse();let rules=0;
   const parse=(body,keyframes=false)=>{let rest=body.trim();while(rest){if(++rules>10000)refuse();const open=rest.indexOf('{');if(open<1)refuse();let depth=1,close=open+1;for(;close<rest.length&&depth;close++){if(rest[close]==='{')depth++;else if(rest[close]==='}')depth--;if(depth>2)refuse();}if(depth)refuse();const selector=rest.slice(0,open).trim(),inner=rest.slice(open+1,close-1);
    if(selector.startsWith('@')){if(keyframes||!/^@(?:-webkit-)?keyframes\s+[A-Za-z_][\w-]*$/.test(selector))refuse();parse(inner,true);}
    else{const invalidSelector=keyframes?!/^(?:from|to|(?:\d{1,3}(?:\.\d+)?%))(?:\s*,\s*(?:from|to|\d{1,3}(?:\.\d+)?%))*$/.test(selector):/[^\w\s.#,:>*+~\[\]="'()|-]/.test(selector);if(!selector||invalidSelector)refuse();declarations(inner);}rest=rest.slice(close).trim();}};
   parse(text);
  }
  let nodes=0;
  function walk(node,depth){
   if(++nodes>20000||depth>64)refuse();
   if(node.nodeType===3||node.nodeType===4||node.nodeType===8)return;
   if(node.nodeType!==1||node.namespaceURI!==NS||!tags.has(node.localName)||node.attributes.length>128)refuse();
   for(let i=0;i<node.attributes.length;i++){
    const a=node.attributes.item(i),name=a.localName??a.name;
    if(a.namespaceURI===XMLNS){if(!(a.name==='xmlns'&&a.value===NS||a.name==='xmlns:xlink'&&a.value===XLINK))refuse();continue;}
    if(a.namespaceURI&&!(a.namespaceURI===XLINK&&name==='href')||/^on/i.test(name)||!attrs.has(name)&&!/^aria-[a-z-]+$/.test(name)&&!/^data-[a-z-]+$/.test(name))refuse();
    if(name==='id'){if(!/^[A-Za-z_][\w:.-]*$/.test(a.value)||ids.has(a.value))refuse();ids.add(a.value);}
    else if(name==='href'){if(!/^#[A-Za-z_][\w:.-]*$/.test(a.value))refuse();references.push(a.value.slice(1));}
    else if(name==='style')declarations(a.value);
    else value(a.value);
   }
   if(node.localName==='style')stylesheet(node.textContent);
   for(let c=node.firstChild;c;c=c.nextSibling)walk(c,depth+1);
  }
  for(let child=parsed.firstChild;child;child=child.nextSibling){if(child===root)walk(child,0);else if(child.nodeType!==8&&!(child.nodeType===3&&!child.textContent.trim()))refuse();}
  if(references.some(id=>!ids.has(id)))refuse();const result=new XMLSerializer().serializeToString(root);if(new TextEncoder().encode(result).length>2097152)refuse();return result;
 }catch{refuse();}
}
