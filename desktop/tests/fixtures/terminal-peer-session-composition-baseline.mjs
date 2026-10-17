import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
function once(source,before,after){assert.equal(source.split(before).length,2,'COMPOSITION_ANCHOR_DRIFT');return source.replace(before,()=>after);}
export function deriveSessionComposition({host,fixture,extension}){
 assert.equal(sha(host),'2683a5d2cd2d6576ddf7d79fe607a54cc92b00cd4010f596e4620c1f4bb2dcf7','HOST_SOURCE_DRIFT');
 assert.equal(sha(fixture),'a978af9537ff1c50cdb99849bca18f1f3dbf8181ccfdce41ad7448ab0a2f680a','FIXTURE_SOURCE_DRIFT');
 assert.ok(typeof extension==='string'&&extension.length>0&&extension.length<=65536,'EXTENSION_REFUSED');
 host=host.replaceAll('\r\n','\n');fixture=fixture.replaceAll('\r\n','\n');
 const methods=[['createSession','CreateSession'],['watchRoot','WatchRoot'],['captureSession','CaptureSession'],['snapshotSession','ReadSession'],['stopSession','StopSession'],['closeSession','CloseSession'],['captureCompositionHost','RefreshCompositionHost']].map(([name,fn])=>`  {"${name}",nullptr,${fn},nullptr,nullptr,nullptr,napi_default,nullptr},\n`).join('');
 host=once(host,'}\nNAPI_MODULE_INIT(){',extension+'}\nNAPI_MODULE_INIT(){');
 host=once(host,'const napi_property_descriptor methods[]={\n','const napi_property_descriptor methods[]={\n'+methods);
 fixture=once(fixture,'Thread.Sleep(12000);return 0;\n    }\n    static bool Member',
  'var natural=Stopwatch.StartNew();while(natural.ElapsedMilliseconds<12000){if(mode=="root"&&File.Exists(Path.Combine(directory,"root-exit.request")))return 51;Thread.Sleep(5);}return 0;\n    }\n    static bool Member');
 fixture=once(fixture,'return Fixture(args[0],args[1]);','Console.WriteLine("SIREN_NATIVE_FIXED_READY");return Fixture(args[0],args[1]);');
 return {host,fixture};
}
