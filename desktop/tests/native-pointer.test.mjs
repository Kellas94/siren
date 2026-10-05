import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
test('native pointer observations intersect the actual scroll clip of a virtualized editor',async()=>{
 const {pointerExpression}=await import('./native/pointer.mjs');
 const scroller={parentElement:null,getBoundingClientRect:()=>({left:0,right:900,top:280,bottom:500}),clientLeft:0,clientTop:0,clientWidth:900,clientHeight:220};
 const content={parentElement:scroller,getBoundingClientRect:()=>({left:80,right:880,top:-6000000,bottom:505}),contains:n=>n===content};
 const point=runInNewContext(pointerExpression('.cm-content'),{innerWidth:940,innerHeight:575,getComputedStyle:()=>({overflowX:'auto',overflowY:'auto'}),document:{querySelector:()=>content,elementFromPoint:(_x,y)=>y>=280&&y<500?content:scroller}});
 assert.equal(point.hit,true);assert.equal(point.y,390);assert.equal(point.x,480);
});
