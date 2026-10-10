// Pure text derivation. Never compiles, loads or executes a native artifact.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex');
function once(source,before,after){assert.equal(source.split(before).length,2,'OWNERSHIP_SOURCE_ANCHOR_DRIFT');return source.replace(before,()=>after);}
function unconditional(source,name){
 const pattern=new RegExp('#ifndef '+name+'\\n([\\s\\S]*?)#endif\\n','g'),matches=[...source.matchAll(pattern)];
 assert.equal(matches.length,1,'OWNERSHIP_SOURCE_ANCHOR_DRIFT');return source.replace(pattern,(_all,body)=>body);
}
export function deriveTerminalOwnershipSource({host,extension}={}){
 assert.equal(typeof host,'string','HOST_SOURCE_DRIFT');assert.equal(typeof extension,'string','EXTENSION_SOURCE_DRIFT');
 const inputs={host:digest(host),extension:digest(extension)};
 assert.equal(inputs.host,'2683a5d2cd2d6576ddf7d79fe607a54cc92b00cd4010f596e4620c1f4bb2dcf7','HOST_SOURCE_DRIFT');
 assert.equal(inputs.extension,'2cd157f5534a10659c582d538b34dee9e136148ab0192dfe8b2b433102a9b00d','EXTENSION_SOURCE_DRIFT');
 host=host.replaceAll('\r\n','\n');extension=extension.replaceAll('\r\n','\n');
 host=unconditional(host,'SIREN_TEST_DISABLE_HOST_MONITOR');
 extension=unconditional(extension,'SIREN_TEST_DISABLE_SESSION_ROOT_MONITOR');
 host=once(host,' DWORD injectedStopFailures=0;\n','');
 host=once(host,'||!Set(env,result,"injectedStopFailures",Integer(env,p->injectedStopFailures))','');
 const legacy=/#ifdef SIREN_TEST_LEGACY_STOP_LATCH\n[\s\S]*?#endif\n/g;
 assert.equal([...host.matchAll(legacy)].length,1,'OWNERSHIP_SOURCE_ANCHOR_DRIFT');host=host.replace(legacy,'');
 const fault=/ BOOL terminated=FALSE;\n#ifdef SIREN_TEST_FAIL_SECOND_STOP\n[\s\S]*?#else\n([\s\S]*?)#endif\n/g;
 assert.equal([...host.matchAll(fault)].length,1,'OWNERSHIP_SOURCE_ANCHOR_DRIFT');host=host.replace(fault,(_all,normal)=>' BOOL terminated=FALSE;\n'+normal);
 host=once(host,'+64*sizeof(ULONG_PTR)','+128*sizeof(ULONG_PTR)');
 host=once(host,'list->NumberOfProcessIdsInList>64','list->NumberOfProcessIdsInList>128');
 extension=once(extension,'list->NumberOfProcessIdsInList<5','list->NumberOfProcessIdsInList<2');
 host=once(host,'// Test-owned prototype. Only main loads it. No process creation, raw HANDLE\n// exposure, PTY import, renderer entrypoint or product admission.',
  '// Candidate reusable ownership core. Main-only opaque capabilities.\n// Source preparation is not native qualification or product admission.');
 extension=once(extension,'// Test-only extension to the exact preserved host guard, within its namespace.\n// Main alone owns both Job handles. No renderer/product/native admission.',
  '// Atomically pre-contained creator and held-identity Session ownership.\n// Main alone owns both Job handles; no renderer capability or raw HANDLE.');
 const methods=[['createSession','CreateSession'],['watchRoot','WatchRoot'],['captureSession','CaptureSession'],['snapshotSession','ReadSession'],['stopSession','StopSession'],['closeSession','CloseSession'],['captureCompositionHost','RefreshCompositionHost']].map(([name,fn])=>`  {"${name}",nullptr,${fn},nullptr,nullptr,nullptr,napi_default,nullptr},\n`).join('');
 let source=once(host,'}\nNAPI_MODULE_INIT(){',extension+'}\nNAPI_MODULE_INIT(){');
 source=once(source,'const napi_property_descriptor methods[]={\n','const napi_property_descriptor methods[]={\n'+methods);
 assert.doesNotMatch(source,/SIREN_TEST|injectedStopFailures|stop77Count/);
 const binding={targets:[{target_name:'siren_terminal_ownership',sources:['ownership.cc'],defines:['NAPI_VERSION=10','_WIN32_WINNT=0x0A00','WIN32_LEAN_AND_MEAN','NOMINMAX'],win_delay_load_hook:'true',libraries:['kernel32.lib'],msvs_settings:{VCCLCompilerTool:{AdditionalOptions:['/std:c++20']}}}]};
 return {source,binding,inputs,sha256:digest(source),admitted:false,compiled:false};
}
