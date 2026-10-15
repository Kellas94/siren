// Executed only inside the disposable, network-disabled Windows Sandbox.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
const input=dirname(fileURLToPath(import.meta.url)),local='C:/SirenQualification',shared='C:/SirenResults';
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const result={scope:'DISPOSABLE_WINDOWS_SANDBOX_NODE_QUALIFICATION',nativeExecutionAdmitted:false,status:'STARTED',os:os.version(),release:os.release(),runtime:process.versions};
try{
 assert.equal(input.toLowerCase().replaceAll('\\','/'),'c:/sireninput');
 assert(existsSync(shared));assert(!existsSync(local),'FRESH_SANDBOX_REQUIRED');
 const manifest=JSON.parse(readFileSync(join(input,'bundle-manifest.json'),'utf8'));
 for(const row of manifest.files)assert.equal(digest(join(input,row.path)),row.sha256,'READONLY_BUNDLE_DRIFT');
 mkdirSync(local);cpSync(join(input,'portable'),join(local,'portable'),{recursive:true,errorOnExist:true,force:false});
 cpSync(join(input,'runtime'),join(local,'runtime'),{recursive:true,errorOnExist:true,force:false});
 const output=join(local,'qualification');mkdirSync(output);mkdirSync(join(output,'build'));
 cpSync(join(input,'candidate.node'),join(output,'build/siren_terminal_host_roster_candidate.node'),{errorOnExist:true,force:false});
 const node=join(local,'runtime/node.exe'),runner=join(local,'portable/desktop/tests/native/terminal-host-roster-local-runner.mjs');
 assert.equal(digest(node),manifest.nodeHash);assert.equal(digest(join(output,'build/siren_terminal_host_roster_candidate.node')),manifest.addonHash);
 try{result.stdout=execFileSync(node,[runner,output],{cwd:join(local,'portable'),windowsHide:true,timeout:240000,maxBuffer:4*1048576,encoding:'utf8'});result.exit=0;}
 catch(e){result.exit=e.status??null;result.error=e.message;result.stdout=String(e.stdout??'');result.stderr=String(e.stderr??'');}
 cpSync(output,join(shared,'qualification'),{recursive:true,errorOnExist:true,force:false});
 if(result.exit===0){const qualified=JSON.parse(readFileSync(join(output,'result.json'),'utf8'));assert.equal(qualified.status,'BOUNDED_LOCAL_NATIVE_CASES_PASSED');assert.equal(qualified.cases.length,10);assert(qualified.cases.every(c=>c.passed===true));}
 result.status=result.exit===0?'BOUNDED_SANDBOX_CASES_COMPLETED':'SANDBOX_QUALIFICATION_FAILED';
}catch(e){result.status='SANDBOX_SETUP_FAILED';result.error=e.stack;}
writeFileSync(join(shared,'sandbox-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
