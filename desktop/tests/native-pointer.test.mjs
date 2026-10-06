import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
test('pointer stability observes a deferred menu position before accepting its rectangle',async()=>{
 const {stablePointerExpression}=await import('./native/pointer.mjs');let moved=false,frames=0;
 const element={getBoundingClientRect:()=>({x:moved?530:1500,y:160,width:312,height:400})};
 const context={document:{querySelector:()=>element},requestAnimationFrame:callback=>{frames++;moved=true;queueMicrotask(callback);}};
 assert.equal(await runInNewContext(stablePointerExpression('#themeMenu'),context),false);
 assert.equal(await runInNewContext(stablePointerExpression('#themeMenu'),context),true);assert.equal(frames,4);
});
test('stable rectangles wait for finite opening animations but not perpetual theme effects',async()=>{
 const {stablePointerExpression}=await import('./native/pointer.mjs');let endTime=160,state='running';
 const element={parentElement:null,getBoundingClientRect:()=>({x:530,y:160,width:312,height:400}),getAnimations:()=>[{playState:state,effect:{getComputedTiming:()=>({endTime})}}]};
 const context={document:{querySelector:()=>element},requestAnimationFrame:callback=>queueMicrotask(callback)};
 assert.equal(await runInNewContext(stablePointerExpression('#themeMenu'),context),false);
 state='finished';assert.equal(await runInNewContext(stablePointerExpression('#themeMenu'),context),true);
 state='running';endTime=Infinity;assert.equal(await runInNewContext(stablePointerExpression('#themeMenu'),context),true);
});
test('native pointer observations intersect the actual scroll clip of a virtualized editor',async()=>{
 const {pointerExpression}=await import('./native/pointer.mjs');
 const scroller={parentElement:null,getBoundingClientRect:()=>({left:0,right:900,top:280,bottom:500}),clientLeft:0,clientTop:0,clientWidth:900,clientHeight:220};
 const content={parentElement:scroller,getBoundingClientRect:()=>({left:80,right:880,top:-6000000,bottom:505}),contains:n=>n===content};
 const point=runInNewContext(pointerExpression('.cm-content'),{innerWidth:940,innerHeight:575,getComputedStyle:()=>({overflowX:'auto',overflowY:'auto'}),document:{querySelector:()=>content,elementFromPoint:(_x,y)=>y>=280&&y<500?content:scroller}});
 assert.equal(point.hit,true);assert.equal(point.y,390);assert.equal(point.x,480);
});
