import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,join,sep} from 'node:path';
import {sessionProvisionLocations} from './terminal-session-provision-paths.mjs';
const moduleURL=new URL('./terminal-session-provision.mjs',import.meta.url),root=resolve(fileURLToPath(new URL('../../../',moduleURL))),nonce='12345678-1234-4234-8234-123456789abc';
test('URL repository directory is canonical without rejected trailing component',()=>{
 const result=sessionProvisionLocations(moduleURL,'D:\\SirenProbeTemp',nonce);assert.equal(result.root,root);assert.equal(result.root.endsWith(sep),false);
 assert.equal(result.work,'D:\\SirenProbeTemp\\siren-session-provision-'+nonce);
});
test('execution provisioning refuses temp equal to source root',()=>assert.throws(()=>sessionProvisionLocations(moduleURL,root,nonce)));
test('execution provisioning refuses temp within source root',()=>assert.throws(()=>sessionProvisionLocations(moduleURL,join(root,'temp'),nonce)));
test('execution provisioning permits an independently named sibling directory',()=>assert.ok(sessionProvisionLocations(moduleURL,root+'-temp',nonce).work.startsWith(root+'-temp')));
test('execution provisioning refuses relative temp rather than resolving cwd',()=>assert.throws(()=>sessionProvisionLocations(moduleURL,'relative',nonce)));
test('execution provisioning refuses caller traversal in generated directory id',()=>assert.throws(()=>sessionProvisionLocations(moduleURL,'D:\\SirenProbeTemp','..\\escape')));
