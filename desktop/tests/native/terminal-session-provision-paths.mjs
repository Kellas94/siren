// Pure location derivation for the disposable hosted probe; no filesystem work.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {join,resolve,isAbsolute,sep} from 'node:path';
export function sessionProvisionLocations(moduleURL,runnerTemp,nonce){
 const root=resolve(fileURLToPath(new URL('../../../',moduleURL)));
 assert.equal(typeof runnerTemp,'string');assert.ok(isAbsolute(runnerTemp));
 const temp=resolve(runnerTemp);assert.match(temp,/^[A-Z]:\\/);assert.ok(temp.toLowerCase()!==root.toLowerCase()&&!temp.toLowerCase().startsWith(root.toLowerCase()+sep));
 assert.match(nonce,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 return Object.freeze({root,work:join(temp,'siren-session-provision-'+nonce)});
}
