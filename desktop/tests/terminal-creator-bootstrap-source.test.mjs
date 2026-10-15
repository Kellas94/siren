// Source preparation only. Native compiler/loader/process execution prohibited.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const derive=await import('../src/terminal/creator-bootstrap-source.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const source=await read('../native/terminal-ownership-minimal-env/ownership.cc'),binding=await read('../native/terminal-ownership-minimal-env/binding.gyp');
test('bootstrap is a separate pinned native target; historical minimal source cannot drift',async()=>{
 assert.equal(typeof derive.deriveBootstrappedOwnership,'function');const r=derive.deriveBootstrappedOwnership({source,binding});
 assert.equal(r.compiled,false);assert.equal(r.admitted,false);assert.equal(r.source,await read('../native/terminal-creator-bootstrap/ownership.cc'));assert.deepEqual(r.binding,JSON.parse(await read('../native/terminal-creator-bootstrap/binding.gyp')));
 assert.equal(r.binding.targets[0].target_name,'siren_terminal_creator_bootstrap');for(const v of [{source:source+'\n',binding},{source,binding:binding+'\n'}])assert.throws(()=>derive.deriveBootstrappedOwnership(v),/BOOTSTRAP_SOURCE_DRIFT/);
});
test('native bootstrap does not replace original four-argument Session or native monitors',()=>{
 assert.equal(typeof derive.deriveBootstrappedOwnership,'function');const r=derive.deriveBootstrappedOwnership({source,binding});
 const old=source.slice(source.indexOf('napi_value CreateSession('),source.indexOf('napi_value WatchRoot('));assert.ok(r.source.includes(old));
 assert.ok(r.source.includes('{"createBootstrappedSession",nullptr,CreateBootstrappedSession'));
 assert.match(r.source,/napi_value a\[5\];if\(!Args\(env,info,5,a\)\)/);
 // The base uses HostExit for both lifetime and creator death; there is no
 // separate SessionHostExit function. Preserve the actual callback bytes.
 for(const name of ['HostExit','ShellExit','FinalizeSession','CreatorEnvironment']){const pattern=new RegExp('(?:void(?: CALLBACK)?|bool) '+name+'\\([\\s\\S]*?(?=\\n(?:void|bool|struct|napi_value|using|const))');const m=source.match(pattern);assert.ok(m,name);assert.ok(r.source.includes(m[0]),name+' drift');}
});
test('five-argument bootstrap checks an extra argument slot and retains old signatures',()=>{
 assert.equal(typeof derive.deriveBootstrappedOwnership,'function');const s=derive.deriveBootstrappedOwnership({source,binding}).source;
 assert.match(s,/size_t count=6;napi_value args\[6\]/);assert.match(s,/count!=expected/);
 assert.match(s,/napi_value a\[4\];if\(!Args\(env,info,4,a\)\)/);
});
test('only bootstrap stdin and NUL handles inherit; keys never enter command or environment',()=>{
 assert.equal(typeof derive.deriveBootstrappedOwnership,'function');const s=derive.deriveBootstrappedOwnership({source,binding}).source;
 const f=s.slice(s.indexOf('napi_value CreateBootstrappedSession('),s.indexOf('napi_value WatchRoot('));assert.match(s,/PROC_THREAD_ATTRIBUTE_HANDLE_LIST/);assert.match(f,/HANDLE inherited\[\]=\{bootstrap\.read\.h,bootstrap\.discard\.h\}/);assert.match(f,/STARTF_USESTDHANDLES/);
 assert.match(f,/CreateProcessW\(exe\.c_str\(\),command\.data\(\),nullptr,nullptr,TRUE,/);assert.match(f,/CreatorEnvironment\(environment,directory\)/);
 assert.doesNotMatch(f,/command[^;]*packet\.bytes|environment[^;]*packet\.bytes/);assert.match(s,/SetHandleInformation\(write\.h,HANDLE_FLAG_INHERIT,0\)/);
});
test('bounded secret copy is wiped and pipe write completes before suspended child resumes',()=>{
 assert.equal(typeof derive.deriveBootstrappedOwnership,'function');const s=derive.deriveBootstrappedOwnership({source,binding}).source;
 const f=s.slice(s.indexOf('napi_value CreateBootstrappedSession('),s.indexOf('napi_value WatchRoot('));assert.match(s,/size>2048/);assert.match(s,/SecureZeroMemory/);assert.match(s,/CreatePipe\(&reader,&writer,&security,4096\)/);
 assert.ok(f.indexOf('MemberOf(p->root.process.h,p->job.h)')<f.indexOf('bootstrap.Fill(packet.bytes)'));assert.ok(f.indexOf('bootstrap.Fill(packet.bytes)')<f.indexOf('ResumeThread(thread.h)'));
 assert.match(f,/return abort\("SESSION_BOOTSTRAP_WRITE_FAILED"\)/);assert.match(s,/written==bytes\.size\(\)/);
});
