// Pure source preparation checks only. Never compile/load the native candidate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PUBLICATION_INPUTS} from './native/terminal-peer-endpoints-contract.mjs';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const hash=b=>createHash('sha256').update(b).digest('hex');
const source=await read('../native/terminal-creator-peer/ownership.cc');
const binding=await read('../native/terminal-creator-peer/binding.gyp');
const endpointSource=await read('../native/terminal-creator-peer/peer-endpoints.inc');
// Captured before this batch; permanent tests do not depend on ignored logs.
const frozen94=[
 [".github/workflows/terminal-ownership-candidate.yml",8298,"3a5d0fa1512d21b7929131f6286e44831fbf0704f48f7cf50b7e73766dcca361"],
 [".github/workflows/terminal-prerequisite.yml",25068,"38823361cac2a5383089f8e04c3b89f03146a29e5befc7366d0029bcfdb0de4d"],
 ["desktop/package.json",1079,"3c0bf4d8fa257852a8c438f261bcaf77f032175f9f1c3457fbd1e78717d3b434"],
 ["desktop/package-lock.json",47469,"2c887168ab1ff14bef19b7e05a1b76856569e6f393d7477e5aba2658bf0d8247"],
 ["desktop/native/terminal-ownership/ownership.cc",26147,"f0557cefb26dc337f4acfbc2f8e3302822f2f3f2371a9842e6c9c8b5cf536d3c"],
 ["desktop/native/terminal-ownership/binding.gyp",504,"559f2a28158cc4695324494e526114627696589c6f91514687d8f9138bc95ce0"],
 ["desktop/tests/native/build-terminal-ownership-candidate.mjs",13272,"3c76ec476de5e4214821b4039146466904e5a8dd835e0dd80a4df69bcee5c5d2"],
 ["desktop/tests/native/terminal-ownership-candidate-contract.mjs",10984,"1100b400892b1d0709a4886addaec067e7a7f9513cf887520cdd6b1318968918"],
 ["desktop/tests/native/terminal-ownership-candidate.test.mjs",12708,"fb311319c16b526afac049544d22971dc14b937a363abe751e73f839fd93e75f"],
 ["desktop/tests/native/terminal-session-composition.mjs",15606,"92210151a252b3c0f10559129abe67e88b0d81e3e586cef42c801c07161b14d2"],
 ["desktop/tests/native/terminal-session-composition-derive.mjs",1809,"20ebff62d474b6006574d51a7d6e7da8bb308bfbd3e21f2da1b6271fe05317af"],
 ["desktop/tests/native/terminal-session-composition-verdict.mjs",5871,"2a7b06dcec36c87e5ae324f34b67e621715448c36169f7d33673c4a083bdba2a"],
 ["desktop/tests/native/terminal-session-composition-test-fixture.mjs",2387,"3b9c648daec48e66695255769138ccee769890ab01c9d997cf966fe0513e7986"],
 ["desktop/tests/native/terminal-conpty-platform.mjs",1086,"b3bb4ec35f7a9357e225a9a1353e8b619bfb89411fff3ef49af5803b357dcb77"],
 ["desktop/tests/native/terminal-electron-broker-worker.mjs",4288,"63dedc6426c9e9506854c074431eebfd93dc579c317a701dfbc9ce49e5ebd2ed"],
 ["desktop/tests/native/terminal-candidate-graph.mjs",16115,"bd2b6834f3eff8f81183192d37669055bd643578e9023cad46e9c8970553d2e5"],
 ["desktop/tests/fixtures/terminal-host-guard/host.cc",12920,"2683a5d2cd2d6576ddf7d79fe607a54cc92b00cd4010f596e4620c1f4bb2dcf7"],
 ["desktop/tests/fixtures/terminal-session-composition.inc",13364,"2cd157f5534a10659c582d538b34dee9e136148ab0192dfe8b2b433102a9b00d"],
 ["desktop/tests/fixtures/terminal-job-list.cs",21862,"a978af9537ff1c50cdb99849bca18f1f3dbf8181ccfdce41ad7448ab0a2f680a"],
 ["desktop/tests/fixtures/terminal-main-owner-observer.cs",18987,"19222580db0df96b9fc30f8dbc0e232a31360ef2f71210101569d1bd84322bbc"],
 ["desktop/tests/fixtures/terminal-session-composition-observer.cs",4765,"c6c2a4b901d246121b19e107901a128446323e3b5890ec18d3f1ff9fd23da1d1"],
 ["desktop/tests/fixtures/terminal-node-pty/package.json",194,"72ae3aec251ddba6c63bc02e855bb0a5b7dc17f6ae85d78f7758ed89c3920cbf"],
 ["desktop/tests/fixtures/terminal-node-pty/package-lock.json",1989,"2ab2c10ae92ebcf8b581f833139499bce2e47ef7a134a154c58f7f8179c458ba"],
 [".github/workflows/terminal-minimal-env.yml",8741,"9d66c3d35b73787b19111f4cf2c29ee9e095e5174de0524a764ca7e2fd4963d7"],
 ["desktop/native/terminal-ownership-minimal-env/ownership.cc",26617,"f0de9350b5f3ee66df6f989e43e6a70e397144cb4a2d29010e2ce93002fdef3f"],
 ["desktop/native/terminal-ownership-minimal-env/binding.gyp",516,"e9c2927fe014c1a12a9357cfcf8da8a98ded95caf6c910a923b6aacd34063366"],
 ["desktop/tests/native/build-terminal-minimal-env.mjs",13503,"a682508c45b6fdd4da268ee1be20916d4ee6dd9940012a9387670752c7d55d60"],
 ["desktop/tests/native/terminal-minimal-env-contract.mjs",5620,"11d4b88355f825c2cef82b0e05d5a40ad212f08bcf4865d1514b5efc0d9d60d9"],
 ["desktop/tests/native/terminal-minimal-env-derive.mjs",5578,"f4e7dcf5ff6e76ec0bbacbdb8f56ef3a3bc49c7c3a56b59fee4b981e573ffa64"],
 ["desktop/tests/native/terminal-minimal-env.test.mjs",9242,"9892bb8e57333f51c2e2df14c7d6bc52edaa5e475e4e5434b881d28d50af7216"],
 ["desktop/tests/native/terminal-minimal-env.mjs",16491,"fa2ad7a74493261c7e660426da050d15ebab7a003df3170aa3cc1dfa4d6e67d8"],
 ["desktop/tests/fixtures/terminal-minimal-env-observer.cs",4859,"8df809aeb90416312f51ef37b0dca8b50620ee85c52e4027f3730d7f96c6bed8"],
 [".github/workflows/terminal-bootstrap-async.yml",10094,"41ea75cb9c972b44009bef57691e2b82f76768fb566d7d198a5b4a246ec38bd0"],
 ["desktop/native/terminal-creator-bootstrap/ownership.cc",34659,"ff7ce2656234f45b90f8f079e3fb0f482ceb75a58e1d93ceb75a0107bd86dfcc"],
 ["desktop/native/terminal-creator-bootstrap/binding.gyp",512,"412c6d7e176ab78c1d6152d04f20be39b4ba37fa74f66cf8a905b5c1dd9f610b"],
 ["desktop/native/terminal-creator-async/ownership.cc",39695,"69b6780f6edf1fa838f97fbf0835a819d9433d01dbf6a4460f8294336c090659"],
 ["desktop/native/terminal-creator-async/binding.gyp",508,"8d2847b9e34fa5466d16a2f53e94c795ab7f745d49967752e39789072eee4751"],
 ["desktop/src/terminal/bootstrap-codec.mjs",3730,"3112d429307826264519faac6752b28589342c99fced23ae8fbc1205015e4389"],
 ["desktop/src/terminal/bootstrap-reader.mjs",3398,"670703c8d7f1cb7e78d268487bdb40dd46fd9ebab42e78f0deadf8498d38a1e3"],
 ["desktop/src/terminal/creator-bootstrap-source.mjs",6677,"d36314f7b2fe7a58194ed65fe00cc3a95f233834e20fca3628dca623a0692e6d"],
 ["desktop/src/terminal/async-cleanup-source.mjs",6417,"da840f08041c4f82e6d623982bdda6d62b9684bc11d9ab03db3c32d3c7f3e277"],
 ["desktop/src/terminal/creator-environment-source.mjs",2940,"dc6caec202da0990eb99d6e82640967f85487b67e111abd92a8830b0daf7a5e6"],
 ["desktop/tests/terminal-bootstrap-codec.test.mjs",5461,"8ee1dcb9c058145b431bfbc914029c5b05372fcea10707057ab45f0051ff7eee"],
 ["desktop/tests/terminal-bootstrap-reader.test.mjs",4045,"dc5373dbb52a5f905a76e0fbada9ff9743a5a474c6a73cb06e60d52cb4939f23"],
 ["desktop/tests/terminal-creator-bootstrap-source.test.mjs",4286,"c0811938578510cea95ed72714b773826dce0b20ec44219c9f6e57d427a65791"],
 ["desktop/tests/terminal-async-cleanup-source.test.mjs",4381,"e96ec6155acf878fbd4529ff8dc151eb24ad83f2af08c6b6e5b350b67554bd2a"],
 ["desktop/tests/terminal-bootstrap-review-regressions.test.mjs",3487,"0adec04400bc0b26853385981217a606b0f94becdae5aad52f4f2845b94ef8c0"],
 ["desktop/tests/native/build-terminal-bootstrap-async.mjs",13597,"3f940578e914d103f3f899ec111502f107e74f70dc66ae352e9141ce88e467c9"],
 ["desktop/tests/native/terminal-bootstrap-async.mjs",18934,"1db6ae8783fe44661360e4614694b80149a9d1064fe9e79734aa29c556cf001a"],
 ["desktop/tests/native/terminal-bootstrap-async-contract.mjs",5478,"9630260ad6bf4f7ad2b898756e578bcc35aa005db0ab6b10e04307c730ea5122"],
 ["desktop/tests/native/terminal-bootstrap-async-derive.mjs",6848,"63ef91a40eec2ef9a904144dcc305d7b6c8b39fec830d7ce5794c5995d63182c"],
 ["desktop/tests/native/terminal-bootstrap-async.test.mjs",4989,"d92f630e72d90d4351b967aa0780f9f49a56c17b2111dd5a1832ac61eba0eb31"],
 [".github/workflows/terminal-normal-powershell.yml",11458,"0e9abfb2bd558f2b6a39ae142423dcfba0cfff2967783cfffcfa02b9fae10124"],
 ["desktop/src/terminal/control-channel.mjs",8186,"24da76d449c01a310f6dc67cc1e8c0a03cf1b7b7689fefcbadc1980d7f12d4f6"],
 ["desktop/src/terminal/history-channel.mjs",12725,"abad642f8aae2b830f0807cee07b817497890e5d56c182ae79b54614d9b682da"],
 ["desktop/src/terminal/remote-output.mjs",9206,"d7e3217b45c8d7fac339b50d36eccdaf19d1d0674ecbbfac1fa778b72adcb953"],
 ["desktop/src/terminal/output.mjs",9161,"a72063934c63d554f3da69a584ea5d807902f67cac3efc08153bcccac94800d0"],
 ["desktop/src/terminal/credits.mjs",2678,"e739005886735bdf39faf0b62e60cb995a0718d1ec0755686220990d354b0f16"],
 ["desktop/src/terminal/contracts.mjs",4172,"1637bc7b9b7687b988ea45b7bee5418727e0c4e00a284e966953d0a56efae79e"],
 ["desktop/src/terminal/input-gate.mjs",5785,"4499838bfe40e6e28e7e86aa01fa37595516341f28547d35af38127a48a5adce"],
 ["desktop/src/terminal/gate-link.mjs",6299,"aaba529f6c2ba03c6420bb5e725143668265c1724466291b6f1e81c0b5ab2242"],
 ["desktop/src/terminal/session-state.mjs",7649,"fba62bdb7dbb940aa15db3ed52f8ba5fdccd23a55cc278b6c230d757428c3353"],
 ["desktop/tests/fixtures/terminal-normal-observer.cs",5547,"e43d3c704aad80ca94d76626d5cf11743600a2c99e193ca791e421e5dbe094e1"],
 ["desktop/tests/native/terminal-normal-probe-core.mjs",2508,"573ada8fbb08fe717fef36dac0b72d02cb3c383cd6fccc38a9efab0781136b99"],
 ["desktop/tests/native/terminal-normal-worker.mjs",6156,"4832c3c65b3073af4a92f5e0b8d22abf2fdf4307ee4c4798fc866bfc9875b91b"],
 ["desktop/tests/native/terminal-normal-powershell.mjs",16885,"c38cb94d2675fc7685367266e3db5bc911e009ea9ee52d88196ff7b7dab71c57"],
 ["desktop/tests/native/terminal-normal-powershell-contract.mjs",14485,"c813b97b878d3adbeb716faa80f1590b98789ebf96ab2f64496df97f61828e34"],
 ["desktop/tests/native/terminal-normal-powershell-derive.mjs",3426,"29ed5d5aeb8c69a2f7952b0d5914f110bd555f2a83bd252c61953ded5fe82959"],
 ["desktop/tests/native/build-terminal-normal-powershell.mjs",13533,"04e312ea71a1dc046b0417bf3606414c16d2481af931da51f5337652ed496d81"],
 ["desktop/tests/native/terminal-normal-contract-fixture.mjs",4136,"f8f76972c86d99ac61573c4c1d7a4ec394c9518feab4dff29583aae20a4295a9"],
 ["desktop/tests/terminal-normal-probe.test.mjs",3998,"930f53c804c3b88abbac0f73bab03622a26bea5d73f0225c406f1b9a94f09de2"],
 ["desktop/tests/terminal-normal-contract.test.mjs",5946,"3f4fc6d7d6d323f5295b9d6a9ebb7a81ee982e7d4ede0f1c25ed3d4b4ffcd960"],
 ["desktop/tests/terminal-normal-builder.test.mjs",3452,"ae85be16cc802335c5dceab18edbeed5ce9dd25a46544d80f107669d0fc5cc81"],
 ["desktop/src/terminal/shell-environment.mjs",2973,"1a451ee6da4c5bd3339feb90e6b37d4d456bdbe28e27f59b78f5e74ad6884d68"],
 ["desktop/tests/terminal-shell-environment.test.mjs",5760,"a278e60423aec5b2b73b051524ecd6b52677d5c96da79f204d94e56f1e1e47e6"],
 [".github/workflows/terminal-peer-endpoints.yml",12936,"61215adadb4ab36b129e984e17006766d4045b03e752a64e20c016ec219e7ce9"],
 ["desktop/native/terminal-creator-peer/ownership.cc",46944,"cad20d5b5920cbf56ac8921de146682ce1208020eb3f64efa09ac3b97462594f"],
 ["desktop/native/terminal-creator-peer/binding.gyp",531,"e687bcfd32044f431060fc1fe5471ae45cb3dd3bf5dbad5e8ca05b2f606655e7"],
 ["desktop/native/terminal-creator-peer/peer-endpoints.inc",44532,"9cbbaa14ea8a2274141051c99d800463ab47b2f0d19dc5cddf5877999233e8bf"],
 ["desktop/src/terminal/peer-endpoint-source.mjs",5796,"69b18f685eb3482433b1975b4baa775a8ec8a9175a7485fd7560f8c8ca5bdf25"],
 ["desktop/src/terminal/peer-bootstrap-reader.mjs",9092,"3563b5bcf8f88486afd96963922da9775a0b3b62bd2d3770d5b4993b071f218f"],
 ["desktop/src/terminal/native-peer-stream.mjs",8512,"07fd7a06e8dc7dc7beb873af98cedc3ba24c44c603f923a42bd61f83d9358120"],
 ["desktop/tests/terminal-peer-endpoint-source.test.mjs",6964,"e4bf36390c9b4de86b5f44c84b319b0a24a7d296a67f40135dd1e0e723a95d1c"],
 ["desktop/tests/terminal-peer-bootstrap-reader.test.mjs",19048,"3a65d660888a75eabdcc2d242b06b94bbf1c09251d102155e5273fbff2d503be"],
 ["desktop/tests/terminal-native-peer-stream.test.mjs",20710,"dda3acfe37e62df1b712f99a3a19fbac070f1c947775b9fca79a8a3c8839ab29"],
 ["desktop/tests/native/terminal-peer-endpoints-contract.mjs",5712,"4607c8f28c5315dfa19ab11d4fbc54167bf91810e6568d53a8f44bf6bbac19e8"],
 ["desktop/tests/native/terminal-peer-probe-derive.mjs",13790,"b1e73714a0b4c674eab3ef97a3143e6194bb327a5c8e5096cdb55c6ff04338d5"],
 ["desktop/tests/native/terminal-peer-endpoints.mjs",25496,"59cd8cb5ce45352ebc03341a5b877931ac745178141a6d567f3b069e1a42ea81"],
 ["desktop/tests/native/terminal-peer-worker.mjs",6625,"387bc928aa1342d01bfeb7912c57d1182eebeaf3e2c00bbf5942d258f6609a7c"],
 ["desktop/tests/native/terminal-peer-ci-derive.mjs",5083,"5fa5c61d876b3e31bee92b40b0acddfd1b9f06338859182b33c6a553c8d4c18b"],
 ["desktop/tests/native/build-terminal-peer-endpoints.mjs",13831,"1ed5750698bb0be021206289e65c8b06c0a0baeb33593ba74dce1a99995a44a3"],
 ["desktop/tests/terminal-peer-endpoints-contract.test.mjs",5084,"5486e02005e4ec0fb01e2892caa4566172e2d02c1363650853f82aad956bc424"],
 ["desktop/tests/terminal-peer-probe-source.test.mjs",15084,"317c955bf685c388343d02d0c52b71c42484c7c363bebeee382152457ddc98d5"],
 ["desktop/tests/terminal-peer-builder.test.mjs",2703,"aa3c8708c808dac6ea5d03f20e669a86c26e105aa846e772aff4915f2c1a3370"],
];
const baseline={rows:frozen94.map(([path,bytes,sha256])=>({path,bytes,sha256}))};
const api=await import('../src/terminal/three-lane-endpoint-source.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
function candidate(){assert.equal(typeof api.deriveThreeLaneEndpointOwnership,'function','Separate three-lane derivation required');return api.deriveThreeLaneEndpointOwnership({source,binding,endpointSource});}
const section=(s,start,end)=>{const a=s.indexOf(start),b=s.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Expected unique source section');return s.slice(a,b);};
const tags=s=>[...s.matchAll(/const napi_type_tag \w+=\{([^}]+)\};/g)].map(m=>m[1]);

const historicalBaselinePath=path=>path==='.github/workflows/terminal-prerequisite.yml'?'./fixtures/terminal-peer-prerequisite-baseline.yml':path==='desktop/src/terminal/input-gate.mjs'?'./fixtures/terminal-peer-input-gate-baseline.mjs':path==='desktop/package.json'?'./fixtures/terminal-peer-package-baseline.json':path==='desktop/tests/fixtures/terminal-job-list.cs'?'./fixtures/terminal-peer-job-list-baseline.cs':path==='desktop/tests/native/terminal-session-composition-derive.mjs'?'./fixtures/terminal-peer-session-composition-baseline.mjs':'../../'+path;
function assertHistoricalRow(row,bytes){assert.equal(bytes.length,row.bytes,row.path);assert.equal(hash(bytes),row.sha256,row.path);}

async function unchanged94(){
 assert.equal(PUBLICATION_INPUTS.length,94);assert.equal(baseline.rows.length,94);
 assert.deepEqual(baseline.rows.map(r=>r.path),[...PUBLICATION_INPUTS]);
 // This historical peer-preparation baseline retains its original input fence
 // and package bytes, plus exact historical fixture and Session recipe bytes.
 // Current fence, runner and fixture-version behavior have separate tests;
 // these raw historical inputs do not qualify the evolving native application.
 for(const row of baseline.rows){const path=historicalBaselinePath(row.path);const bytes=await readFile(new URL(path,import.meta.url));assertHistoricalRow(row,bytes);}
}

test('all 94 frozen peer inputs match the captured raw-byte baseline before preparation',unchanged94);
test('preparation refuses changed original ownership, recipe, include and missing inputs',()=>{
 candidate();
 for(const key of ['source','binding','endpointSource']){const args={source,binding,endpointSource};args[key]+='\n';assert.throws(()=>api.deriveThreeLaneEndpointOwnership(args),/THREE_LANE_SOURCE_DRIFT/);}
 assert.throws(()=>api.deriveThreeLaneEndpointOwnership(),/THREE_LANE_SOURCE_DRIFT/);
 // Missing/duplicated transformation anchors are changed parent bytes, so the
 // public boundary must refuse them before any output can be generated.
 for(const changed of [endpointSource.replace('PeerLane lanes[2]','PeerLane lanes[9]'),endpointSource+'\nPeerLane lanes[2];'])assert.throws(()=>api.deriveThreeLaneEndpointOwnership({source,binding,endpointSource:changed}),/THREE_LANE_SOURCE_DRIFT/);
});
test('counted anchors independently refuse missing and duplicate matches after a simulated pin update',async()=>{
 const recipe=await read('../src/terminal/three-lane-endpoint-source.mjs');
 const anchor='const napi_type_tag tag={0x506eb4ba9e124a07ULL,0x880cfe94dbdc69a1ULL};';
 for(const changed of [source.replace(anchor,anchor.replace('tag=','oldTag=')),source+'\n'+anchor]){
  // Advance only the in-memory test recipe's parent hash to reach its second
  // guard. The real recipe and frozen parent files are never modified.
  const simulated=recipe.replace("const SOURCE='"+hash(source)+"'","const SOURCE='"+hash(changed)+"'");
  const prepared=await import('data:text/javascript;base64,'+Buffer.from(simulated).toString('base64'));
  assert.throws(()=>prepared.deriveThreeLaneEndpointOwnership({source:changed,binding,endpointSource}),/THREE_LANE_SOURCE_ANCHOR_DRIFT/);
 }
});
test('new checked-in candidate equals exact deterministic preparation and has a distinct target',async()=>{
 const a=candidate(),b=candidate();assert.deepEqual(a,b);assert.equal(a.compiled,false);assert.equal(a.admitted,false);
 assert.equal(a.source,await read('../native/terminal-creator-three-lane/ownership.cc'));
 assert.equal(a.endpointSource,await read('../native/terminal-creator-three-lane/peer-endpoints.inc'));
 assert.deepEqual(a.binding,JSON.parse(await read('../native/terminal-creator-three-lane/binding.gyp')));
 assert.equal(a.binding.targets[0].target_name,'siren_terminal_creator_three_lane');
 assert.deepEqual(a.binding.targets[0].libraries,['kernel32.lib','advapi32.lib']);
 assert.equal(a.sha256,hash(a.source));assert.equal(a.endpointSha256,hash(a.endpointSource));
 assert.equal(a.baseSha256,hash(source));assert.equal(a.baseBindingSha256,hash(binding));assert.equal(a.baseEndpointSha256,hash(endpointSource));
});
test('all five Owner Session group endpoint witness tags are distinct from the original addon',()=>{
 const r=candidate(),old=tags(source+'\n'+endpointSource),fresh=tags(r.source+'\n'+r.endpointSource);
 assert.equal(old.length,5);assert.equal(fresh.length,5);assert.equal(new Set(fresh).size,5);
 for(const tag of fresh)assert.ok(!old.includes(tag),'Cross-variant tag must refuse old capability');
});
test('only peer startup changes to the new bounded native bootstrap reader',()=>{
 const r=candidate(),legacy=section(source,'bool ReadBootstrap(','struct BootstrapPipe {');
 assert.ok(r.source.includes(legacy));
 const oldCreation=section(source,'napi_value CreateBootstrappedSession(','// Cleanup only:');assert.ok(r.source.includes(oldCreation));
 const worker=section(source,'struct AsyncStopWork {','napi_value StopAndCloseSessionAsync(');assert.ok(r.source.includes(worker));
 const startup=section(r.source,'napi_value CreatePeerSession(','napi_value CreateBootstrappedSession(');
 assert.match(startup,/ReadThreeLaneBootstrap\(env,a\[4\],packet\)/);assert.doesNotMatch(startup,/!ReadBootstrap\(/);
});
test('native SIRENTB2 reader checks five lengths three names and all secret pairs',()=>{
 const r=candidate(),s=section(r.source,'bool ThreeLaneBootstrapFields(','struct BootstrapPipe {');
 for(const text of ['SIRENTB2','size<114||size>2048','offset=18','fields)[5]','lengths)[5]','i<5','size-96-offset','offset+96!=size','siren-terminal-control-','siren-terminal-data-','siren-terminal-command-'])assert.ok(s.includes(text),text);
 assert.match(s,/present\[3\]/);assert.match(s,/different\[3\]/);
 for(const pair of ['p[offset+i]^p[offset+32+i]','p[offset+i]^p[offset+64+i]','p[offset+32+i]^p[offset+64+i]'])assert.ok(s.includes(pair),pair);
 assert.match(s,/packet\.bytes\.assign\(p,p\+size\)/);
});
test('outer SIRENTP3 and consumption keep bounded ownership and inheritance ordering',()=>{
 const s=candidate().endpointSource,prepare=section(s,'bool PeerPrepareStartup(','bool PeerBindCreator('),consume=section(s,'napi_value PeerConsumeBootstrap(','napi_value PeerAcceptLane(');
 assert.match(prepare,/'S','I','R','E','N','T','P','3'/);assert.match(consume,/'S','I','R','E','N','T','P','3'/);
 assert.match(consume,/size<130\|\|size>2064/);assert.match(consume,/PeerWipe inputWipe/);assert.match(consume,/PeerWipe payloadWipe/);assert.match(consume,/ReadThreeLaneBootstrap\(env,payload,oldPacket\)/);
 const adopt=consume.indexOf('Handle original(inherited)'),clear=consume.indexOf('SetHandleInformation(original.h,HANDLE_FLAG_INHERIT,0)'),duplicate=consume.indexOf('PeerDuplicate(original.h,peerProcessRights'),close=consume.indexOf('CloseHandle(original.h)'),allocate=consume.indexOf('PeerNewPair(env,false)');
 assert.ok(adopt>=0&&adopt<clear&&clear<duplicate&&duplicate<close&&close<allocate);
 assert.match(consume,/for\(unsigned lane=0;lane<peerLaneCount;\+\+lane\)p->lanes\[lane\]\.name=names\[lane\]/);
 assert.doesNotMatch(s,/napi_create_bigint|napi_get_value_bigint|OpenProcess\(/);
});
test('three inherited handles and two Job entries remain independent of stream lane count',()=>{
 const s=candidate().source,startup=section(s,'napi_value CreatePeerSession(','napi_value CreateBootstrappedSession(');
 assert.match(startup,/HANDLE inherited\[\]=\{bootstrap\.read\.h,bootstrap\.discard\.h,inheritedWitness\.h\}/);
 assert.match(startup,/HANDLE jobs\[\]=\{host->job\.h,p->job\.h\}/);
 assert.match(s,/PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,3\*sizeof\(HANDLE\)/);
 assert.match(s,/PROC_THREAD_ATTRIBUTE_JOB_LIST,jobs,2\*sizeof\(HANDLE\)/);
 assert.doesNotMatch(startup,/inherited\[\].*lanes|commandSecret/);
 const bind=startup.indexOf('PeerBindCreator(env,pair,p.get())'),fill=startup.indexOf('bootstrap.Fill(peerPacket.bytes)'),resume=startup.indexOf('ResumeThread(thread.h)');assert.ok(bind>=0&&bind<fill&&fill<resume);
 assert.match(startup,/PeerAbortStartup\(pair\)/);assert.match(startup,/guard\.committed=true/);
});
test('exact three lane strings names snapshots and listener argument arity have no two-lane fallback',()=>{
 const s=candidate().endpointSource;
 assert.match(s,/peerLaneCount=3/);assert.match(s,/PeerLane lanes\[peerLaneCount\]/);assert.match(s,/lane>=peerLaneCount/);
 for(const name of ['control','history','command'])assert.ok(s.includes('L"'+name+'"'),name);
 assert.match(s,/PeerLaneNames\[peerLaneCount\]=\{"control","history","command"\}/);
 assert.match(s,/napi_create_string_utf8\(env,PeerLaneNames\[cap->lane\]/);
 const listeners=section(s,'napi_value PeerCreateListeners(','bool PeerPrepareStartup(');assert.match(listeners,/napi_value a\[4\];if\(!Args\(env,info,4,a\)\)/);assert.match(listeners,/names\[peerLaneCount\]/);
 assert.doesNotMatch(s,/lanes\[2\]|lane<2|lane>1|lane==0\?|cap->lane==0\?|names\[2\]/);
});
test('request and byte budgets include completed native work awaiting JS delivery',()=>{
 const s=candidate().endpointSource;
 for(const text of ['peerReadLimit=32768','peerWriteLimits[peerLaneCount]={2048,90120,90120}','peerWriteCountLimit=32,peerCloseCountLimit=32,peerRequestLimit=134','ready[peerRequestLimit]','p->requests.reserve(peerRequestLimit)','!r->nativeDone||!r->jsDone','!r->nativeDone||!r->jsDone||r->bytesReleased','r->delivering=true','r->nativeDone&&r->jsDone'])assert.ok(s.includes(text),text);
 for(const method of ['Read','Write']){const part=section(s,'napi_value Peer'+method+'(','napi_value Peer'+(method==='Read'?'Write':'AssertCurrent')+'(');const check=part.indexOf('p->requests.size()>=peerRequestLimit'),copy=part.indexOf(method==='Read'?'r->buffer.resize':'r->buffer.assign');assert.ok(check>=0&&check<copy,method+' aggregate check before allocation');}
});
test('finite wait capacity is nine on main eight on creator with one event-driven worker per side',()=>{
 const s=candidate().endpointSource;
 assert.match(s,/peerWaitLimit=1\+2\*peerLaneCount\+2/);assert.match(s,/static_assert\(peerWaitLimit==9/);assert.match(s,/HANDLE waits\[peerWaitLimit\]/);assert.match(s,/count>=peerWaitLimit/);assert.match(s,/p->server\?peerWaitLimit:peerWaitLimit-1/);
 assert.equal((s.match(/CreateThread\(/g)??[]).length,1);assert.match(s,/512\*1024/);assert.match(s,/limit=server\?8:1/);assert.match(s,/napi_create_threadsafe_function[^\n]*name,1,1/);
 assert.doesNotMatch(s,/napi_async_work|napi_queue_async_work|uv_threadpool|FlushFileBuffers|WaitNamedPipe|DisconnectNamedPipe/);
});
test('witness close finalization and startup deadline all require all three connected lanes',()=>{
 const s=candidate().endpointSource;
 assert.match(s,/bool PeerAllConnectedLocked\(PeerPair\* p\)/);
 assert.match(s,/cap->type==&peerWitnessTag&&PeerAllConnectedLocked\(cap->pair.get\(\)\)/);
 assert.match(s,/if\(!PeerAllConnectedLocked\(cap->pair.get\(\)\)\)PeerRetireLocked/);
 assert.match(s,/now>=p->startupDeadline&&!PeerAllConnectedLocked\(p.get\(\)\)/);
});
test('both exact native peer directions Jobs and listener security are retained',()=>{
 const s=candidate().endpointSource;
 for(const text of ['GetNamedPipeClientProcessId','GetNamedPipeServerProcessId','GetProcessTimes','QueryFullProcessImageNameW','observed!=p->peer.pid','MemberOf(p->peer.process.h,p->commonJob.h)','MemberOf(p->peer.process.h,p->sessionJob.h)','PeerHeldCurrent(p->hostWitness)','PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE','JOB_OBJECT_QUERY','FILE_FLAG_FIRST_PIPE_INSTANCE','PIPE_REJECT_REMOTE_CLIENTS','TokenLogonSid','FILE_READ_DATA|FILE_WRITE_DATA|FILE_READ_ATTRIBUTES|SYNCHRONIZE'])assert.ok(s.includes(text),text);
});
test('whole-group cancellation idle reads and native reap/finalizer ownership stay bounded',()=>{
 const r=candidate(),s=r.endpointSource;
 for(const text of ['for(auto& l:p->lanes)if(l.pipe.h)CancelIoEx(l.pipe.h,nullptr)','GetOverlappedResult','PeerDrainLocked','WaitForSingleObject(p->thread.h,INFINITE)','l.readEvent=Handle();l.writeEvent=Handle()','peerRegistry.erase(it)','PeerEnvironmentFinished(environment)','p->environment=nullptr','readIdleTimeout'])assert.ok(s.includes(text),text);
 assert.match(s,/r->kind!=PeerRequestKind::Read[^\n]*now>=r->deadline/);assert.match(s,/r->kind!=PeerRequestKind::Read[^\n]*GetTickCount64\(\)>=r->deadline/);
 assert.match(r.source,/PeerRetireOwner\(this\);if\(job.h&&!TerminateJobObject\(job.h,77\)\)return false/);
 assert.match(r.source,/PeerRetireSession\(p\);work.release\(\)/);
 assert.doesNotMatch(s,/nativeExecutionAdmitted[=:]true|detach\(\)/);
});
test('all 94 frozen peer inputs are unchanged after repeated successful and refused preparation',async()=>{candidate();await unchanged94();});

function assertCurrentRunnerCompatibility(current,historical){
 const {scripts:currentScripts,...currentFields}=current;
 const {scripts:historicalScripts,...historicalFields}=historical;
 assert.deepEqual(currentFields,historicalFields,'Non-script package fields must retain their historical values');
 const {test:currentTest,verify:currentVerify,...currentOtherScripts}=currentScripts;
 const {test:historicalTest,verify:historicalVerify,...historicalOtherScripts}=historicalScripts;
 assert.deepEqual(currentOtherScripts,historicalOtherScripts,'Only test and verify scripts may differ');
 const expected='node --expose-gc --experimental-vm-modules --test --test-concurrency=4 tests/*.test.mjs';
 assert.equal(currentTest,expected,'test must use the required GC/VM flags and fixed concurrency');
 assert.equal(currentVerify,expected,'verify must use the same required bounded runner');
}

// Current runner compatibility is a separate source-only assertion. It does not
// repin the historical peer baseline or admit the current native application.
test('current package preserves historical fields except the two required runner scripts',async()=>{
 const historical=JSON.parse(await read('./fixtures/terminal-peer-package-baseline.json'));
 const current=JSON.parse(await read('../package.json'));
 assertCurrentRunnerCompatibility(current,historical);
});
test('runner compatibility refuses dependency, engine, other-script and command drift',async()=>{
 const historical=JSON.parse(await read('./fixtures/terminal-peer-package-baseline.json'));
 const current=JSON.parse(await read('../package.json'));
 const changed=mutate=>{const p=structuredClone(current);mutate(p);assert.throws(()=>assertCurrentRunnerCompatibility(p,historical),{code:'ERR_ASSERTION'});};
 for(const mutate of [p=>p.dependencies.jose='0.0.0',p=>p.devDependencies.electron='0.0.0',p=>p.engines.node='>=1',p=>p.main='elsewhere.mjs',p=>p.name='different',p=>p.extra=true,p=>p.scripts.start='node other.mjs',p=>p.scripts.extra='node injected.mjs',p=>delete p.scripts['native:shell']])changed(mutate);
 const command='node --expose-gc --experimental-vm-modules --test --test-concurrency=4 tests/*.test.mjs';
 for(const key of ['test','verify'])for(const bad of [historical.scripts[key],command.replace(' --expose-gc',''),command.replace(' --experimental-vm-modules',''),command.replace('=4','=0'),command.replace('=4','=8'),command.replace(' tests/*.test.mjs',' tests/subset.test.mjs'),command+' --allow-child-process'])changed(p=>p.scripts[key]=bad);
});


test('each historical Terminal baseline row is exact data and refuses independent byte corruption',async t=>{
 for(const logical of ['desktop/tests/native/terminal-session-composition-derive.mjs','desktop/tests/fixtures/terminal-job-list.cs'])await t.test(logical,async()=>{
  const row=baseline.rows.find(value=>value.path===logical);assert.ok(row);
  const historical=await readFile(new URL(historicalBaselinePath(logical),import.meta.url));assertHistoricalRow(row,historical);
  const appended=Buffer.concat([historical,Buffer.from('\n')]),changed=Buffer.from(historical);changed[0]^=1;
  assert.throws(()=>assertHistoricalRow(row,appended));assert.throws(()=>assertHistoricalRow(row,changed));
  const current=await readFile(new URL('../../'+logical,import.meta.url));assert.notEqual(hash(current),row.sha256,'Current qualified version is separate from historical evidence');
 });
});
