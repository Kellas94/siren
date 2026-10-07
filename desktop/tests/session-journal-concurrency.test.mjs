import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdir,rmdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {SessionJournal} from '../src/recovery/sessions.mjs';
const defer=()=>{let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve:()=>resolve()};};
const identity={pid:123,path:'C:\\owned\\SIREN.exe',startedAt:'2026-10-06T00:00:00.0000000Z'};
const main=(await readFile(new URL('../src/main.mjs',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const start=main.indexOf('let readyRecorded = false;'),readiness=main.slice(start,main.indexOf("ipcMain.handle('siren:desktop'",start));

test('overlapping journal events read and publish in request order without losing a close record',async t=>{
 const root=await mkdtemp(join(tmpdir(),'siren-journal-order-'));t.after(()=>rm(root,{recursive:true,force:true}));const entered=defer(),release=defer();let reads=0,tick=Date.parse('2026-10-06T00:00:00Z');
 const journal=new SessionJournal(root,{now:()=>++tick}),read=journal.read.bind(journal);
 journal.read=async()=>{reads++;if(reads===1){entered.resolve();await release.promise;}return read();};
 const opened=journal.recordSession({event:'opened',sessionId:'owned',version:'test',processIdentity:identity});await entered.promise;
 const ready=journal.recordSession({event:'ready',sessionId:'owned',version:'test',processIdentity:identity}),closed=journal.recordSession({event:'clean-close',sessionId:'owned',version:'test',processIdentity:identity});
 const completed=Promise.allSettled([opened,ready,closed]);await new Promise(resolve=>setImmediate(resolve));const beforeRelease=reads;release.resolve();const results=await completed;
 assert.equal(beforeRelease,1,'later journal events must not read stale state while the first publication is pending');assert.ok(results.every(r=>r.status==='fulfilled'));
 assert.deepEqual((await read()).events.map(e=>e.event),['opened','ready','clean-close']);
});

test('a real journal refusal does not poison later explicitly requested recovery writes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'siren-journal-refusal-'));t.after(()=>rm(root,{recursive:true,force:true}));const journal=new SessionJournal(root),path=await journal.path();await mkdir(path);
 await assert.rejects(journal.recordSession({event:'ready',sessionId:'refused',version:'test',processIdentity:identity}));await rmdir(path);
 await journal.recordSession({event:'opened',sessionId:'new',version:'test',processIdentity:identity});assert.deepEqual((await journal.read()).events.map(e=>e.sessionId),['new']);
});

for(const fail of [false,true])test('duplicate native ready notifications share one pending journal publication: '+(fail?'failure stays fenced':'success'),async()=>{
 const entered=defer(),release=defer();let listener,calls=0;const notices=[],frame={url:'siren://app/home.html'},contents={mainFrame:frame,send:(...args)=>notices.push(args)};
 const context=vm.createContext({ipcMain:{on:(_event,callback)=>{listener=callback;}},window:{webContents:contents,isDestroyed:()=>false},app:{getVersion:()=> 'test'},processIdentity:identity,sessionId:'owned',journal:{recordSession:async()=>{calls++;entered.resolve();await release.promise;if(fail)throw Error('Actual journal write refused');}},nativeReadonly:false,mode:'normal',reason:null,bootstrap:{mode:'normal',readonly:false}});
 vm.runInContext(readiness,context);const event={sender:contents,senderFrame:frame},first=listener(event);await entered.promise;const second=listener(event);await new Promise(resolve=>setImmediate(resolve));const during=calls;release.resolve();await Promise.all([first,second]);
 assert.equal(during,1,'duplicate readiness may not race another durable journal update');assert.equal(context.mode,fail?'readonly':'normal');assert.equal(context.nativeReadonly,fail);assert.equal(notices.length,fail?1:0);
});
