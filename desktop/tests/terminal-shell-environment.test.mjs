// Pure shell environment preparation only. No shell, process or native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/terminal/shell-environment.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
function fixture(){const root='C:\\Windows',cwd='D:\\SIREN workspace Ω 😀\\private session';return {environment:{ComSpec:root+'\\System32\\cmd.exe',ELECTRON_RUN_AS_NODE:'1',PATH:root+'\\System32;'+root,SystemRoot:root,TEMP:cwd,TMP:cwd,windir:root},shell:root+'\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',cwd};}
const create=request=>{assert.equal(typeof api.createSystemPowerShellEnvironment,'function');return api.createSystemPowerShellEnvironment(request);};
test('only approved system PowerShell modules and six safe OS keys reach the frozen shell environment',()=>{
 const request=fixture(),before=structuredClone(request),env=create(request);assert.deepEqual(env,{COMSPEC:'C:\\Windows\\System32\\cmd.exe',PATH:'C:\\Windows\\System32;C:\\Windows',SYSTEMROOT:'C:\\Windows',TEMP:request.cwd,TMP:request.cwd,WINDIR:'C:\\Windows',PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'});assert.equal(Object.isFrozen(env),true);assert.deepEqual(request,before);assert.equal(Object.hasOwn(env,'ELECTRON_RUN_AS_NODE'),false);assert.equal(Object.keys(env).length,7);
});
test('case-insensitive native Windows keys and paths normalize to the same approved environment',()=>{
 const r=fixture();r.environment={comspec:'c:\\windows\\system32\\CMD.EXE',electron_run_as_node:'1',Path:'c:\\windows\\system32;C:\\WINDOWS',systemroot:'C:\\Windows',temp:r.cwd.toLowerCase(),tmp:r.cwd.toUpperCase(),WINDIR:'c:\\WINDOWS'};const env=create(r);assert.equal(env.COMSPEC,'C:\\Windows\\System32\\cmd.exe');assert.equal(env.PATH,'C:\\Windows\\System32;C:\\Windows');assert.equal(env.TEMP,r.cwd);assert.equal(env.PSModulePath,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules');
});
test('no ambient environment, unknown key, duplicate case alias or private secret is accepted',()=>{
 const missing=fixture();delete missing.environment;assert.throws(()=>create(missing),/SHELL_ENVIRONMENT_REFUSED/);
 for(const key of ['OPENAI_API_KEY','PRIVATE_APPLICATION_SECRET','PSModulePath','NODE_OPTIONS','NODE_PATH','ELECTRON_NO_ASAR','Path','__proto__']){const r=fixture();Object.defineProperty(r.environment,key,{value:'untrusted',enumerable:true});assert.throws(()=>create(r),/SHELL_ENVIRONMENT_REFUSED/);}
 for(const key of Object.keys(fixture().environment)){const r=fixture();delete r.environment[key];assert.throws(()=>create(r),/SHELL_ENVIRONMENT_REFUSED/);}
});
test('accessors, proxies, prototypes and hidden or symbolic fields are refused without executing hooks',()=>{
 let hooks=0;const getter=()=>{hooks++;return fixture().environment;};const r=fixture();Object.defineProperty(r,'environment',{enumerable:true,get:getter});assert.throws(()=>create(r),/SHELL_ENVIRONMENT_REFUSED/);
 const e=fixture();Object.defineProperty(e.environment,'PATH',{enumerable:true,get(){hooks++;return 'C:\\Windows';}});assert.throws(()=>create(e),/SHELL_ENVIRONMENT_REFUSED/);
 for(const target of ['outer','environment']){const r=fixture(),proxy=new Proxy(target==='outer'?r:r.environment,{getPrototypeOf(){hooks++;return Object.prototype;},ownKeys(){hooks++;return [];},get(){hooks++;return 'unsafe';}});assert.throws(()=>create(target==='outer'?proxy:{...r,environment:proxy}),/SHELL_ENVIRONMENT_REFUSED/);}
 assert.equal(hooks,0);
 for(const mutate of [r=>Object.setPrototypeOf(r,{inherited:true}),r=>Object.setPrototypeOf(r.environment,{inherited:true}),r=>Object.defineProperty(r.environment,'PATH',{enumerable:false,value:r.environment.PATH}),r=>r[Symbol('extra')]=true,r=>r.environment[Symbol('extra')]='unsafe',r=>r.extra=true]){const r=fixture();mutate(r);assert.throws(()=>create(r),/SHELL_ENVIRONMENT_REFUSED/);}
});
test('foreign shell, COMSPEC, PATH, temporary directory, windir or Electron mode fails closed',()=>{
 for(const mutate of [r=>r.shell='C:\\tools\\pwsh.exe',r=>r.shell='C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe',r=>r.environment.ComSpec='C:\\tools\\cmd.exe',r=>r.environment.PATH+=';C:\\tools',r=>r.environment.PATH='C:\\Windows;C:\\Windows\\System32',r=>r.environment.TEMP='D:\\other',r=>r.environment.TMP='D:\\other',r=>r.environment.windir='C:\\OtherWindows',r=>r.environment.ELECTRON_RUN_AS_NODE='0',r=>r.environment.ELECTRON_RUN_AS_NODE=1]){const r=fixture();mutate(r);assert.throws(()=>create(r),/SHELL_ENVIRONMENT_REFUSED/);}
});
test('unsafe path spellings cannot redirect system modules or private temporary files',()=>{
 const paths=['C:\\Windows\\..\\evil','C:\\Windows\\.','C:\\Windows\\','C:/Windows','\\\\server\\Windows','\\\\?\\C:\\Windows','C:Windows','C:\\Windows:stream','C:\\Windows;C:\\evil','C:\\Windows\\bad.','C:\\Windows\\bad ','C:\\Windows\\CON','C:\\Windows\\LPT1.txt','C:\\Windows\\bad\nname','C:\\Windows\\bad\0name','C:\\Windows\\bad\ud800'];
 for(const value of paths){for(const where of ['root','cwd','shell']){const r=fixture();if(where==='root')r.environment.SystemRoot=value;else r[where]=value;assert.throws(()=>create(r),/SHELL_ENVIRONMENT_REFUSED/);}}
});
test('null-prototype data records work while invalid argument shapes never fall back',()=>{
 const r=fixture(),env=Object.assign(Object.create(null),r.environment),request=Object.assign(Object.create(null),{environment:env,shell:r.shell,cwd:r.cwd});assert.equal(create(request).PSModulePath,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules');
 for(const request of [undefined,null,[],()=>{},'environment',new Date(),{environment:[],shell:r.shell,cwd:r.cwd}])assert.throws(()=>create(request),/SHELL_ENVIRONMENT_REFUSED/);
});
