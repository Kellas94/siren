import test from 'node:test';
import assert from 'node:assert/strict';
import * as native from '../src/help/native.mjs';
import {HELP_ARTICLES} from '../src/help/catalog.mjs';
import {createHelpResolver} from '../src/help/resolve.mjs';
const resolver=createHelpResolver(HELP_ARTICLES);
const observed='An Application Control policy has blocked this file.\r\n\\\\?\\C:\\private\\creator.node';
const error=(message=observed,code='ERR_DLOPEN_FAILED')=>Object.assign(Error(message),{code});
const classify=value=>native.classifyNativeTerminalLoadError(value);
test('exact observed native load refusal becomes a frozen identity without raw path or message',()=>{
 assert.equal(typeof native.classifyNativeTerminalLoadError,'function');
 const identity=classify(error());assert.deepEqual(identity,{namespace:'terminal',operation:'native-load',code:'NATIVE_APPLICATION_CONTROL_REFUSED'});assert.ok(Object.isFrozen(identity));
 assert.doesNotMatch(JSON.stringify(identity),/private|creator\.node|blocked this file/);
 for(const message of ['An Application Control policy has blocked this file.','An Application Control policy has blocked this file.\nC:\\private\\creator.node'])assert.deepEqual(classify(error(message)),identity);
});
test('unrelated load failure or embedded policy phrase never becomes a policy diagnosis',()=>{
 for(const value of [error('The specified module could not be found.'),error('The specified procedure could not be found.'),error('not a valid Win32 application'),error('Report: '+observed),error(observed,'ENOENT'),error('An Application Control policy has blocked this file. This is a quoted note.')])assert.equal(classify(value),null);
});
test('malformed own descriptors, inherited metadata and proxies invoke no user code',()=>{
 let touched=0;const getter={code:'ERR_DLOPEN_FAILED'};Object.defineProperty(getter,'message',{get(){touched++;return observed;}});
 const codeGetter={message:observed};Object.defineProperty(codeGetter,'code',{get(){touched++;return 'ERR_DLOPEN_FAILED';}});
 const proxy=new Proxy({},{get(){touched++;throw 0;},getOwnPropertyDescriptor(){touched++;throw 0;},getPrototypeOf(){touched++;throw 0;}}),revocable=Proxy.revocable({},{});revocable.revoke();
 for(const value of [null,undefined,observed,[],getter,codeGetter,Object.create({code:'ERR_DLOPEN_FAILED',message:observed}),proxy,revocable.proxy])assert.equal(classify(value),null);
 assert.equal(touched,0);
});
test('classification message budget and scalar types fail closed without coercion',()=>{
 let touched=0;for(const message of [{toString(){touched++;return observed;}},1,null,'An Application Control policy has blocked this file.\n'+'x'.repeat(16384)])assert.equal(classify({code:'ERR_DLOPEN_FAILED',message}),null);
 assert.equal(touched,0);
});
test('policy article resolves only its exact operation and remains locally searchable',()=>{
 const identity=classify(error());assert.equal(resolver.resolve(identity).id,'terminal-native-policy');
 for(const patch of [{namespace:'source'},{operation:'create'},{operation:'input'},{code:'ERR_DLOPEN_FAILED'}])assert.equal(resolver.resolve({...identity,...patch}).id,'unknown-error');
 for(const query of ['Application Control','signed','NATIVE_APPLICATION_CONTROL_REFUSED'])assert.ok(resolver.search({query,category:'terminal'}).includes('terminal-native-policy'));
});
test('guidance retains Windows policy and offers trusted signed builds/admin help, without execution authority',()=>{
 const article=resolver.get('terminal-native-policy');assert.ok(article);
 assert.match(article.recovery,/trusted signed SIREN build/i);assert.match(article.recovery,/administrator/i);assert.match(article.recovery,/policy in place/i);
 assert.match(article.technical,/ERR_DLOPEN_FAILED/);assert.match(article.technical,/does not identify/i);
 assert.doesNotMatch(JSON.stringify(article),/powershell -|Set-ExecutionPolicy|Unblock-File|bypass|untrusted certificate/i);
 assert.equal(Object.hasOwn(article,'action'),false);
});
