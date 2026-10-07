import assert from 'node:assert/strict';
import {readFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashOwnedFile} from '../../src/updates/download.mjs';

/** Run the identical native UI probe from its own byte-verified portable copy. */
export async function copiedPackageContext(evidence){
 const at=process.argv.indexOf('--package');if(at<0)return null;
 assert.ok(process.argv[at+1],'Package root required');
 const root=resolve(process.argv[at+1]),receipt=JSON.parse(await readFile(join(root,'BUILD-IDENTITY.json'),'utf8'));
 assert.equal(receipt.kind,'development-preview');assert.equal(receipt.releaseAdmitted,false);
 assert.match(receipt.sourceCommit,/^[a-f0-9]{40}$/);assert.equal(receipt.appRelativePath,'App/versions/0.1.0/SIREN.exe');
 const copy=join(evidence,'Pachet-Știință-UI');await cp(root,copy,{recursive:true,errorOnExist:true,force:false});
 const verify=async()=>{
  assert.deepEqual(await hashOwnedFile(join(copy,'App/versions/0.1.0/resources/app.asar'),1024**3),receipt.appArchive);
  assert.deepEqual(await hashOwnedFile(join(copy,receipt.appRelativePath),1024**3),receipt.runtimeBinary);
  assert.ok(receipt.processReader,'Copied runtime requires the committed fixed process reader receipt');
  assert.deepEqual(await hashOwnedFile(join(copy,'App/versions/0.1.0/resources/siren-process-identity.exe'),131072),receipt.processReader.binary);
  assert.deepEqual(JSON.parse(await readFile(join(copy,'App/versions/0.1.0/resources/siren-process-identity.json'),'utf8')),receipt.processReader);
 };
 await verify();
 return {copy,data:join(copy,'Data'),receipt,launch:{executable:join(copy,receipt.appRelativePath),packaged:true},verify};
}
