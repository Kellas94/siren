/** Read-only pointer geometry, including scroll clips of virtualized content. */
export const pointerExpression=selector=>`(()=>{
 const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing native control');
 const r=e.getBoundingClientRect();let left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
 for(let parent=e.parentElement;parent;parent=parent.parentElement){
  const style=getComputedStyle(parent),box=parent.getBoundingClientRect();
  if(/^(auto|scroll|hidden|clip)$/.test(style.overflowX)){left=Math.max(left,box.left+parent.clientLeft);right=Math.min(right,box.left+parent.clientLeft+parent.clientWidth);}
  if(/^(auto|scroll|hidden|clip)$/.test(style.overflowY)){top=Math.max(top,box.top+parent.clientTop);bottom=Math.min(bottom,box.top+parent.clientTop+parent.clientHeight);}
 }
 const x=(left+right)/2,y=(top+bottom)/2;return {x,y,hit:right>left&&bottom>top&&e.contains(document.elementFromPoint(x,y))};
})()`;
/** Observe animation completion; do not stop scrolling, move controls or extend deadlines. */
export const stablePointerExpression=selector=>`(async()=>{
 const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing native control');
 const before=e.getBoundingClientRect();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 for(let node=e;node;node=node.parentElement)if((node.getAnimations?.()??[]).some(animation=>['running','pending'].includes(animation.playState)&&Number.isFinite(animation.effect?.getComputedTiming().endTime)))return false;
 const after=e.getBoundingClientRect();return ['x','y','width','height'].every(key=>Math.abs(before[key]-after[key])<.1);
})()`;
