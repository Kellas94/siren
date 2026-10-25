// CI compatibility observation only; no app boot, addon load or admission.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const expected=Object.freeze({electron:'44.9.3',node:'24.22.0',chrome:'152.0.7977.167',v8:'15.2.124.43-electron.0',modules:'149',napi:'10'});
assert.equal(process.env.ELECTRON_RUN_AS_NODE,'1','Run with the exact installed Electron in RUN_AS_NODE mode');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
assert.equal(manifest.devDependencies.electron,expected.electron);
assert.equal(lock.packages[''].devDependencies.electron,expected.electron);
assert.equal(lock.packages['node_modules/electron'].version,expected.electron);
for(const [key,value]of Object.entries(expected))assert.equal(process.versions[key],value,`Unexpected embedded ${key}`);
console.log(JSON.stringify({kind:'ELECTRON_RUNTIME_COMPATIBILITY_OBSERVATION',platform:process.platform,arch:process.arch,runtime:Object.fromEntries(Object.keys(expected).map(key=>[key,process.versions[key]])),embeddedUndici:process.versions.undici,npmUndici:lock.packages['node_modules/undici'].version,nativeAddonCompatibilityQualified:false,packagedApplicationQualified:false}));
