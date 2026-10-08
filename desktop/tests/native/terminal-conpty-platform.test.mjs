import assert from 'node:assert/strict';
import test from 'node:test';
import {requireQualifiedConptyPlatform,requireSelectedOsConpty,isQualifiedOsConptyObservation} from './terminal-conpty-platform.mjs';
const current={platform:'win32',arch:'x64',windowsVersion:'10.0.26100'};
test('only explicit x64 Windows ConPTY branch is eligible before loading or spawning',()=>{
 for(const windowsVersion of ['10.0.18309','10.0.19045','10.0.26100'])assert.equal(requireQualifiedConptyPlatform({...current,windowsVersion}),undefined);
});
test('old or unknown platform refuses before upstream can silently select winpty',()=>{
 for(const change of [{platform:'linux'},{platform:'darwin'},{arch:'arm64'},{arch:'ia32'},{windowsVersion:'10.0.18308'},{windowsVersion:'6.3.9600'},{windowsVersion:'11.0.26100'},{windowsVersion:'10.1.26100'},{windowsVersion:'10.0.026100'},{windowsVersion:'10.0.26100.1'},{windowsVersion:'10.0.26100\n'},{windowsVersion:'10.0.9007199254740992'},{windowsVersion:26100}])assert.throws(()=>requireQualifiedConptyPlatform({...current,...change}),/CONPTY_PLATFORM_REFUSED/);
 for(const value of [null,undefined,{},[],false])assert.throws(()=>requireQualifiedConptyPlatform(value),/CONPTY_PLATFORM_REFUSED/);
});
test('request options do not substitute for observed exact pinned agent backend',()=>{
 assert.equal(requireSelectedOsConpty({useConpty:true,useConptyDll:false}),undefined);
 for(const value of [{useConpty:false,useConptyDll:false},{useConpty:true,useConptyDll:true},{useConpty:'true',useConptyDll:false},{useConpty:true},{},{useConpty:true,useConptyDll:0},null])assert.throws(()=>requireSelectedOsConpty(value),/CONPTY_BACKEND_REFUSED/);
});
test('native predicates require observed platform/backend fields, not requested flags',()=>{
 const worker={runtime:{platform:'win32',arch:'x64'},windowsRelease:'10.0.26100',osConpty:true,useConptyDll:false};
 assert.equal(isQualifiedOsConptyObservation(worker),true);
 for(const change of [{windowsRelease:'10.0.18308'},{windowsRelease:undefined},{osConpty:false},{useConptyDll:undefined},{useConptyDll:true},{runtime:{platform:'linux',arch:'x64'}}])assert.equal(isQualifiedOsConptyObservation({...worker,...change}),false);
 for(const value of [null,undefined,{}])assert.equal(isQualifiedOsConptyObservation(value),false);
});
