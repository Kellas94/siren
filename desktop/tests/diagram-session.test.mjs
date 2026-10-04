import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const implementation=await readFile(new URL('../src/ui/diagram/session.js',import.meta.url),'utf8').catch(error=>{if(error.code!=='ENOENT')throw error;return '';});
function create(options){const window={};runInNewContext(implementation,{window});assert.equal(typeof window.SirenNativeDiagramSession?.create,'function');return window.SirenNativeDiagramSession.create(options);}
const context=source=>({ok:true,readonly:true,diagram:{id:'diagram-a',name:'Exact colour',source},version:1,sha256:'a'.repeat(64),projectRevision:2});
test('working Diagram previews local source without rereading or changing its saved context, and Lock fences late local SVG',async()=>{
 let reads=0,release;const painted=[],source=[];
 const session=create({read:async()=>{reads++;return {...context('saved'),readonly:false};},render:async value=>{if(value.source==='delayed')await new Promise(done=>release=done);return value.source;},onSource:value=>source.push(value.diagram.source),onPreview:value=>painted.push(value),onError:()=>{}});
 assert.equal(await session.refresh(),true);assert.equal(await session.renderLocal('local'),true);assert.equal(reads,1);assert.equal(session.context.diagram.source,'saved');assert.deepEqual(source,['saved']);assert.deepEqual(painted,['saved','local']);
 const pending=session.renderLocal('delayed'),pause=session.pause();release();assert.equal(await pending,false);assert.equal(await pause,true);assert.deepEqual(painted,['saved','local']);session.resume();assert.equal(await session.renderLocal('retained'),true);session.dispose();
});
test('native Diagram retains exact imported source and preserves it when Mermaid rejects syntax',async()=>{
 const source='flowchart TD\nA-->B\nstyle A fill:#ff3366',opened=[],painted=[],errors=[];
 const session=create({read:async()=>context(source),render:async value=>{assert.equal(value.source,source);throw Error('parse rejected');},onSource:result=>opened.push(result.diagram.source),onPreview:svg=>painted.push(svg),onError:()=>errors.push(true)});
 assert.equal(await session.refresh(),false);assert.deepEqual(opened,[source]);assert.deepEqual(painted,[]);assert.equal(errors.length,1);assert.equal(session.context.diagram.source,source);assert.equal(await session.pause(),true);session.resume();session.dispose();
});
test('Lock fences pending SVG and reads; rollback permits a fresh render without publishing private late results',async()=>{
 let release,read=async()=>context('flowchart TD\nA-->B'),renders=0;const painted=[];
 const session=create({read:()=>read(),render:async()=>{renders++;if(renders===1)await new Promise(resolve=>release=resolve);return '<svg>exact</svg>';},onSource:()=>{},onPreview:svg=>painted.push(svg),onError:()=>{}});
 const pending=session.refresh();await new Promise(resolve=>setImmediate(resolve));const paused=session.pause();release();assert.equal(await pending,false);assert.equal(await paused,true);assert.deepEqual(painted,[]);
 session.resume();assert.equal(await session.refresh(),true);assert.deepEqual(painted,['<svg>exact</svg>']);
 read=()=>new Promise(resolve=>release=()=>resolve(context('PRIVATE_DELAYED')));const delayed=session.refresh();await new Promise(resolve=>setImmediate(resolve));const draining=session.pause();release();await delayed;await draining;assert.equal(session.context.diagram.source,'flowchart TD\nA-->B');session.dispose();
});
test('competing refreshes publish only the newest read and disposal refuses all further access',async()=>{
 let release,reads=0;const sources=[];const session=create({read:()=>++reads===1?new Promise(resolve=>release=()=>resolve(context('old'))):Promise.resolve(context('new')),render:async value=>value.source,onSource:value=>sources.push(value.diagram.source),onPreview:()=>{},onError:()=>{}});
 const old=session.refresh();assert.equal(await session.refresh(),true);release();assert.equal(await old,false);assert.deepEqual(sources,['new']);session.dispose();assert.equal(await session.refresh(),false);assert.equal(reads,2);
});
