import test from 'node:test';
import assert from 'node:assert/strict';
import { once, EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { encodePinFrame, decodePinFrame, pinRequest, pinResponse } from '../src/account/pin-protocol.mjs';
import { PinProtector } from '../src/account/pin-protection.mjs';

const nonce='a'.repeat(32),request={schema:1,nonce,operation:'encrypt',requireKey:false,text:'synthetic verifier'};
test('private pipe writes must complete the full frame even when native writes are partial',async()=>{
 const protocol=await import('../src/account/pin-protocol.mjs');assert.equal(typeof protocol.writePinFrame,'function');
 const frame=encodePinFrame(request),chunks=[];protocol.writePinFrame((bytes,offset,length)=>{const size=Math.min(3,length);chunks.push(Buffer.from(bytes.subarray(offset,offset+size)));return size;},frame);assert.deepEqual(Buffer.concat(chunks),frame);
 for(const size of [0,-1,NaN,frame.length+1])assert.throws(()=>protocol.writePinFrame(()=>size,frame));
});
test('private protocol validates exact operation/nonce/fields, UTF8 framing, limits and canonical ciphertext',()=>{
 assert.deepEqual(pinRequest(decodePinFrame(encodePinFrame(request))),request);
 for(const input of [{...request,operation:'shell'},{...request,nonce:'x'},{...request,path:'x'},{...request,requireKey:1},{...request,text:'x'.repeat(4097)},{schema:1,nonce,operation:'decrypt',requireKey:false,cipher64:'YQ=='},{schema:1,nonce,operation:'decrypt',requireKey:true,cipher64:'YQ='}])assert.throws(()=>pinRequest(input));
 const response={schema:1,nonce,operation:'encrypt',cipher64:'YQ=='};assert.deepEqual(pinResponse(response,request),response);
 for(const input of [{...response,nonce:'b'.repeat(32)},{...response,operation:'decrypt'},{...response,extra:true},{...response,cipher64:'YQ==='}])assert.throws(()=>pinResponse(input,request));
 const frame=encodePinFrame(request);for(const input of [frame.subarray(0,-1),Buffer.concat([frame,Buffer.from([0])]),Buffer.alloc(32773)])assert.throws(()=>decodePinFrame(input));
 const invalid=Buffer.from([0,0,0,1,255]);assert.throws(()=>decodePinFrame(invalid));
});

async function fixture(mode='normal'){
 const root=await mkdtemp(join(tmpdir(),'siren-protector-')),calls=[],hold=new EventEmitter();
 const spawnWorker=(executable,args,options)=>{
  const child=new EventEmitter();child.pid=123;child.stdin=new PassThrough();child.stderr=new PassThrough();child.stdio=[child.stdin,null,child.stderr,new PassThrough()];child.kill=()=>{queueMicrotask(()=>child.emit('close',null,'SIGKILL'));return true;};
  let input=[];child.stdin.on('data',b=>input.push(b));child.stdin.on('finish',async()=>{
   const req=pinRequest(decodePinFrame(Buffer.concat(input)));calls.push({req,executable,args,options});
   if(mode==='timeout')return;
   if(mode==='exit'){child.emit('close',7,null);return;}
   const profile=args.find(a=>a.startsWith('--siren-pin-worker-v1=')).slice('--siren-pin-worker-v1='.length);await writeFile(join(profile,'Local State'),'{}');
   const response=req.operation==='encrypt'?{schema:1,nonce:req.nonce,operation:'encrypt',cipher64:Buffer.from(req.text).toString('base64')}:{schema:1,nonce:req.nonce,operation:'decrypt',text:Buffer.from(req.cipher64,'base64').toString('utf8')};
   if(mode==='mismatch'&&req.operation==='decrypt')response.text='not the verifier';
   const output=mode==='oversized'?Buffer.alloc(32773):encodePinFrame(response);child.stdio[3].write(output);child.stdio[3].end();
   if(mode==='hold'){hold.emit('response');await once(hold,'release');}
   child.emit('close',0,null);
  });return child;
 };
 const protector=new PinProtector(root,{executable:process.execPath,application:root,spawnWorker,timeoutMs:100});
 return {root,calls,hold,protector};
}

test('protection requires encrypt close then a different decrypt close with exact payload before returning',async()=>{
 const f=await fixture();const result=await f.protector.encryptString('synthetic verifier');assert.equal(result.toString(),'synthetic verifier');assert.equal(f.calls.length,2);assert.notEqual(f.calls[0].req.nonce,f.calls[1].req.nonce);assert.deepEqual(f.calls.map(c=>c.req.operation),['encrypt','decrypt']);
 for(const call of f.calls){assert.equal(call.options.shell,false);assert.equal(call.options.windowsHide,true);assert.equal(call.args.some(a=>a.includes('synthetic verifier')),false);assert.equal(call.options.env.ELECTRON_RUN_AS_NODE,undefined);assert.equal(call.options.env.NODE_OPTIONS,undefined);}
});

test('output arriving before actual process close cannot authorize persistence',async()=>{
 const f=await fixture('hold');let finished=false;const response=once(f.hold,'response'),pending=f.protector.decryptString(Buffer.from('cipher')).then(()=>{finished=true;});
 // Existing protected-record decrypt must have an existing admitted profile/key.
 await assert.rejects(pending);assert.equal(finished,false);assert.equal(f.calls.length,0);
 const profile=join(f.root,'Access','PinProtection');await mkdir(join(f.root,'Access'));await mkdir(profile);await writeFile(join(profile,'Local State'),'{}');
 const actual=f.protector.decryptString(Buffer.from('cipher')).then(()=>{finished=true;});await response;assert.equal(finished,false);f.hold.emit('release');await actual;assert.equal(finished,true);
});

for(const mode of ['timeout','exit','mismatch','oversized'])test('refuses '+mode+' without returning protected bytes',async()=>{
 const f=await fixture(mode);await assert.rejects(f.protector.encryptString('synthetic verifier'));assert.equal(f.calls.length,mode==='mismatch'?2:1);
});

test('a key profile lost after successful independent decrypt is never silently regenerated',async()=>{
 const f=await fixture();await f.protector.encryptString('synthetic verifier');await unlink(join(f.root,'Access','PinProtection','Local State'));await assert.rejects(f.protector.encryptString('synthetic verifier'));assert.equal(f.calls.length,2);
});
