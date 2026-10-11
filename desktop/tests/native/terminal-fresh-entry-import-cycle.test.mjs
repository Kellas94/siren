import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';

// Execute only the literal current CLI orchestration over inert fixtures.
// No archived code, provider, shell, compiler, addon or native process is run.
const provision = await readFile(new URL('./terminal-fresh-runtime-provision.mjs',import.meta.url),'utf8');
const driver = await readFile(new URL('./terminal-fresh-pair-driver.mjs',import.meta.url),'utf8');
const backImport = "import {recheckProvisionedFreshRuntime} from './terminal-fresh-runtime-provision.mjs';";
assert.equal(driver.split(backImport).length,2,'The real driver still has this import boundary');
const marker='if(import.meta.main===true){';
assert.equal(provision.split(marker).length,2,'Select the actual unique CLI entry');
const actualCli=marker+provision.split(marker)[1];
const staticDriverImport="import {runFreshTerminalPair} from './terminal-fresh-pair-driver.mjs';";
const actualImport=provision.includes(staticDriverImport)?staticDriverImport+'\n':'';
async function run({buildOk=true,pairThrows=false,legacy=false}={}){
 const parent=resolve('evidence/terminal-entry-cycle');await mkdir(parent,{recursive:true});
 const folder=await mkdtemp(join(parent,'case-'));
 const header=`import {types} from 'node:util';\n${actualImport}const flags={nativeAdmission:false};const entryMode='fixed-pathext-pair';
 export async function provisionFreshTerminalRuntime(){return Object.freeze({ok:${buildOk},status:'INERT_BUILD',jobRoot:null});}
 export async function recheckProvisionedFreshRuntime(receipt){return receipt.ok===true;}
 `;
 let cli=actualCli;
 if(legacy){
  cli=cli.replace('const pair=await runFreshTerminalPair(receipt);',"const {runFreshTerminalPair}=await import('./terminal-fresh-pair-driver.mjs'),pair=await runFreshTerminalPair(receipt);");
 }
 await writeFile(join(folder,'terminal-fresh-runtime-provision.mjs'),(legacy?header.replace(staticDriverImport+'\n',''):header)+cli);
 await writeFile(join(folder,'terminal-fresh-pair-driver.mjs'),backImport+`
 export async function runFreshTerminalPair(receipt){
  if(!await recheckProvisionedFreshRuntime(receipt))throw Error('Receipt refused');
  ${pairThrows?"throw Error('Inert continuation refusal');":"return {ok:true,status:'FRESH_PAIR_OBSERVED_NOT_ADMITTED',hasAdverseArm:false};"}
 }
 `);
 const result=spawnSync(process.execPath,[join(folder,'terminal-fresh-runtime-provision.mjs')],{cwd:folder,windowsHide:true,encoding:'utf8',timeout:10000,maxBuffer:65536});
 assert.equal(result.error,undefined,'Actual Node fixture process starts and finishes');
 return {...result,records:result.stdout.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)};
}

test('literal actual CLI completes the provisioner/driver import boundary and reaches the inert pair exactly once',async()=>{
 const result=await run();assert.equal(result.status,0,result.stderr);
 assert.equal(result.records.length,2);assert.equal(result.records[0].status,'INERT_BUILD');
 assert.equal(result.records[1].status,'FRESH_PAIR_OBSERVED_NOT_ADMITTED');
 assert.equal(result.records.every(row=>row.nativeAdmission===false),true);
 assert.doesNotMatch(result.stderr,/unsettled top-level await/i);
});
test('the original dynamic back-import is a causal Node exit13 control, not a native failure',async()=>{
 const result=await run({legacy:true});assert.equal(result.status,13);assert.equal(result.records.length,1);
 assert.match(result.stderr,/unsettled top-level await/i);
});
test('failed provisioning does not call the pair and remains exit1',async()=>{
 const result=await run({buildOk:false});assert.equal(result.status,1,result.stderr);assert.equal(result.records.length,1);assert.equal(result.records[0].ok,false);
});
test('a real continuation rejection remains a refused exit1 and is never a passing pair',async()=>{
 const result=await run({pairThrows:true});assert.equal(result.status,1,result.stderr);assert.equal(result.records.length,2);assert.equal(result.records[1].status,'FRESH_PAIR_CONTINUATION_UNAVAILABLE');assert.equal(result.records[1].ok,false);
});
