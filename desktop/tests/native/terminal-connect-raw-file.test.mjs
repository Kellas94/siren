// Tiny inert filesystem fixtures only. No actual creator/provider/native code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,link,symlink,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {decodeTerminalConnectRawJson} from './terminal-connect-raw-json.mjs';
const api=await import('./terminal-connect-raw-file.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const read=(...args)=>{assert.equal(typeof api.readTerminalConnectRawFile,'function','Missing bounded raw file reader');return api.readTerminalConnectRawFile(...args);};
const owned=fileURLToPath(new URL('../../../terminal-connect-raw-file-20261011/fixtures/',import.meta.url));
let serial=0;
function raw(){return {schema:1,boundary:'JS_NATIVE_CONNECT_ARGUMENTS',argumentCount:6,creatorPid:42,clock:'PROCESS_MONOTONIC',count:0,duplicate:false,phase:'UNSEEN',before:null,after:null,beforeConnectMs:null,afterConnectMs:null,returnStatus:'NOT_CALLED',pidAssignment:'NOT_ATTEMPTED',returnedPid:null,argumentsUnchanged:null,captureCodes:[]};}
async function fixture(bytes=JSON.stringify(raw())){const root=path.join(owned,'case-'+Date.now()+'-'+(++serial));await mkdir(root);await mkdir(path.join(root,'fresh-evidence'));await mkdir(path.join(root,'fresh-evidence','connect'));const file=path.join(root,'fresh-evidence','connect','42.json');if(bytes!==null)await writeFile(file,bytes);return {root,file};}
const refused=r=>{assert.equal(r.ok,false);assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.ok(Object.isFrozen(r));};
test('reads only exact fixed PID file as immutable DATA and raw byte hash',async()=>{const s=JSON.stringify(raw()),f=await fixture(s);const r=await read(f.root,42);assert.equal(r.ok,true);assert.equal(r.rawBytes,Buffer.byteLength(s));assert.equal(r.rawSha256,createHash('sha256').update(s).digest('hex'));assert.deepEqual(r.decoded.observation,raw());assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.decoded.observation.captureCodes));assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.equal(await readFile(f.file,'utf8'),s);});
test('missing fixed file never falls back to another PID',async()=>{const f=await fixture(null);await writeFile(path.join(path.dirname(f.file),'43.json'),JSON.stringify(raw()));refused(await read(f.root,42));});
test('invalid primitives and extra arguments refuse without coercion hooks',async()=>{let hooks=0;const x=new Proxy({},{get(){hooks++;throw Error('secret');}});for(const [root,pid] of [[x,42],['relative',42],['C:\\',42],[null,42],[owned,x],[owned,0],[owned,-1],[owned,1.5],[owned,4294967296],[owned,'42']])refused(await read(root,pid));refused(await read(owned,42,x));assert.equal(hooks,0);});
test('size cap rejects overlong file and malformed canonical JSON',async()=>{for(const s of ['x'.repeat(32769),'x'.repeat(32768),'',JSON.stringify(raw())+'\n','{']){const f=await fixture(s);refused(await read(f.root,42));}});
test('fatal UTF8 and BOM reject rather than silently replacing or stripping bytes',async()=>{for(const b of [Buffer.from([0xc3,0x28]),Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify(raw()))]),Buffer.from([0xff])]){const f=await fixture(b);refused(await read(f.root,42));}});
test('structurally adverse and PID-inconsistent records remain DATA without admission',async()=>{const value={...raw(),creatorPid:999,count:2,duplicate:true,phase:'NATIVE_THROW',returnStatus:'THREW',captureCodes:['DUPLICATE_CONNECT']};const f=await fixture(JSON.stringify(value)),r=await read(f.root,42);assert.equal(r.ok,true);assert.deepEqual(r.decoded.observation,value);assert.equal(r.inputAuthorized,false);});
test('directory at fixed file path refuses as nonregular',async()=>{const f=await fixture(null);await mkdir(f.file);refused(await read(f.root,42));});
test('lexical anchor aliases refuse without repairing caller path',async()=>{const f=await fixture();for(const root of [f.root+path.sep,f.root+path.sep+'..'+path.sep+path.basename(f.root)])refused(await read(root,42));});
test('fixed descendants with wrong on-disk case refuse despite Windows case-insensitive resolution',async()=>{for(const component of ['fresh-evidence','connect','42.json']){const f=await fixture();const p=component==='fresh-evidence'?path.join(f.root,component):component==='connect'?path.dirname(f.file):f.file;await rename(p,path.join(path.dirname(p),component.toUpperCase()));refused(await read(f.root,42));}});
test('real hardlinked file refuses single-link requirement',async()=>{const f=await fixture();await link(f.file,path.join(f.root,'other.json'));refused(await read(f.root,42));});
test('real linked ancestor refuses rather than following target',async()=>{const f=await fixture();const alias=path.join(owned,'alias-'+Date.now()+'-'+(++serial));await symlink(f.root,alias,'junction');refused(await read(alias,42));});

// CONDITIONAL SOURCE EVIDENCE ONLY: isolated reader with finite private IO
// substitutes. Does not attest an actual filesystem race or native process.
async function conditional(options={}){
 const source=await readFile(new URL('./terminal-connect-raw-file.mjs',import.meta.url),'utf8');
 const code=source.replace(/^import .*;\r?\n/gm,'').replace('export async function readTerminalConnectRawFile','async function readTerminalConnectRawFile');
 const anchor='C:\\owned\\job',target=anchor+'\\fresh-evidence\\connect\\42.json';
 const payload=options.payload??Buffer.from(JSON.stringify(raw()));
 const counters={allocations:[],reads:[],opens:0,closes:0,pathChecks:0,decoded:0};
 const base={dev:1n,ino:9n,mode:33188n,nlink:1n,size:BigInt(options.size??payload.length),mtimeNs:10n,ctimeNs:11n};
 const make=(file,overrides={})=>({...base,...(!file?{mode:16877n,size:0n}:{}),...overrides,isSymbolicLink:()=>!!options.link,isDirectory:()=>!file,isFile:()=>file});
 let checks=0,handleStats=0;
 const context={path:path.win32,process:{platform:'win32'},constants:{O_RDONLY:0,O_NOFOLLOW:0},TextDecoder,createHash,
  Buffer:{byteLength:Buffer.byteLength,alloc(n){counters.allocations.push(n);return Buffer.alloc(n);}},
  decodeTerminalConnectRawJson(s){counters.decoded++;return decodeTerminalConnectRawJson(s);},
  realpathSync(p){return options.alias&&p===target?p.toUpperCase():p;},
  async opendir(p,opts){assert.equal(opts.bufferSize,32);const name=p===anchor?'fresh-evidence':p===anchor+'\\fresh-evidence'?'connect':'42.json';return {async *[Symbol.asyncIterator](){yield {name:options.memberAlias?name.toUpperCase():name};if(options.memberDuplicate)yield {name:name.toUpperCase()};if(options.entryCap)for(let i=0;i<8192;i++)yield {name:'unrelated-'+i};}};},
  async lstat(p){const file=p===target;if(file){checks++;counters.pathChecks++;}return make(file,options.multilink&&file?{nlink:2n}:options.pathSwap&&file&&checks>=3?{ino:10n}:options.ancestorSwap&&p===anchor&&checks>=2?{ino:10n}:{});},
  async open(p,flags){assert.equal(p,target);assert.equal(flags,0);counters.opens++;if(options.openError)throw Error('private path secret');return {async stat(){handleStats++;return make(true,options.handleSwap&&handleStats===1?{ino:10n}:options.handleTimeChange&&handleStats>=2?{mtimeNs:12n}:{});},async read(buffer,offset,length,position){counters.reads.push({capacity:buffer.length,offset,length,position});if(options.readError)throw Error('private payload secret');const available=Math.max(0,payload.length-position),n=options.shortRead?0:Math.min(available,length,options.chunk??length);payload.copy(buffer,offset,position,position+n);return {bytesRead:n};},async close(){counters.closes++;if(options.closeError)throw Error('private close secret');}};}
 };
 const sandbox=vm.createContext(context);vm.runInContext(code,sandbox,{timeout:500});
 const result=await sandbox.readTerminalConnectRawFile(anchor,42);
 return {result,counters};
}
test('conditional fixed one-buffer reads partial chunks to EOF without unbounded allocation',async()=>{const {result:r,counters:c}=await conditional({chunk:7});assert.equal(r.ok,true);assert.deepEqual(c.allocations,[32769]);assert.ok(c.reads.length>2);assert.ok(c.reads.every(x=>x.capacity===32769&&x.offset+x.length===32769&&x.offset===x.position));assert.equal(c.closes,1);assert.equal(c.decoded,1);});
test('conditional oversized stat refuses before allocation or opening',async()=>{const {result:r,counters:c}=await conditional({size:32769});refused(r);assert.equal(r.code,'RAW_FILE_SIZE_REFUSED');assert.deepEqual(c.allocations,[]);assert.equal(c.opens,0);assert.equal(c.decoded,0);});
test('conditional growing file hits sentinel cap before decoding and closes',async()=>{const {result:r,counters:c}=await conditional({size:1,payload:Buffer.alloc(50000)});refused(r);assert.equal(r.code,'RAW_FILE_SIZE_REFUSED');assert.deepEqual(c.allocations,[32769]);assert.equal(c.reads.length,1);assert.equal(c.decoded,0);assert.equal(c.closes,1);});
test('conditional short read refuses rather than accepting shorter bytes',async()=>{const {result:r,counters:c}=await conditional({shortRead:true});refused(r);assert.equal(r.code,'RAW_FILE_IDENTITY_CHANGED');assert.equal(c.decoded,0);assert.equal(c.closes,1);});
test('conditional same-byte path replacement and ancestor identity change refuse',async()=>{for(const options of [{pathSwap:true},{ancestorSwap:true}]){const {result:r,counters:c}=await conditional(options);refused(r);assert.equal(r.code,'RAW_FILE_IDENTITY_CHANGED');assert.equal(c.decoded,0);assert.equal(c.closes,1);}});
test('conditional handle mismatch and handle time drift refuse and close',async()=>{for(const options of [{handleSwap:true},{handleTimeChange:true}]){const {result:r,counters:c}=await conditional(options);refused(r);assert.equal(r.code,'RAW_FILE_IDENTITY_CHANGED');assert.equal(c.decoded,0);assert.equal(c.closes,1);}});
test('conditional noncanonical or visible-link path refuses before open',async()=>{for(const options of [{link:true},{alias:true}]){const {result:r,counters:c}=await conditional(options);refused(r);assert.equal(r.code,'RAW_FILE_PATH_REFUSED');assert.equal(c.opens,0);}});
test('conditional read open and close exceptions refuse without raw errors',async()=>{for(const options of [{readError:true},{openError:true},{closeError:true}]){const {result:r,counters:c}=await conditional(options);refused(r);assert.equal(r.code,'RAW_FILE_UNAVAILABLE');assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal(c.closes,options.openError?0:1);}});
test('conditional multi-link file refuses before open independently of blocked real fixture setup',async()=>{const {result:r,counters:c}=await conditional({multilink:true});refused(r);assert.equal(r.code,'RAW_FILE_PATH_REFUSED');assert.equal(c.opens,0);assert.deepEqual(c.allocations,[]);});
test('conditional exact-member spelling and folded duplicate refusal precede open',async()=>{for(const options of [{memberAlias:true},{memberDuplicate:true}]){const {result:r,counters:c}=await conditional(options);refused(r);assert.equal(r.code,'RAW_FILE_PATH_REFUSED');assert.equal(c.opens,0);}});
test('conditional directory entry cap refuses before opening raw file',async()=>{const {result:r,counters:c}=await conditional({entryCap:true});refused(r);assert.equal(r.code,'RAW_FILE_PATH_REFUSED');assert.equal(c.opens,0);});
