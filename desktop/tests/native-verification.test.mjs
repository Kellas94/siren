import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const api=await import('../scripts/native-verification.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const required=["shell","protected-storage","account-transition","code-windows","desktop-ui","code-recovery","recovery-zoom","code-diagram-interaction","guided-intro","dev-first-run","access-screen","local-pin","headless-import","source-owner","source-read","source-analysis","source-diff","source-map","source-edit","source-link","source-link-create","docs-sources","source-sync","docs-edit","docs-format","diagram-preview","diagram-edit","diagram-guided","diagram-style","diagram-build","diagram-vector","diagram-export","view-control-rollback","large-source-docs","code-view-flush","domain-workspaces","readonly-roster","home-entry","home-navigation","home-recovery","home-library","home-library-search","home-documents","docs-structured","home-source-projects","presentation-render","presentation-style","presentation-cards","presentation-windows","window-focus","toast-transition"];
test('native identity is compiled before both original development groups and native unit tests',async()=>{
 const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
 const windows=workflow.slice(workflow.indexOf('  windows:'),workflow.indexOf('  native_windows:'));
 assert.ok(windows.indexOf('node scripts/build-process-reader.mjs')<windows.indexOf('node --test --test-concurrency=1'));
 const native=workflow.slice(workflow.indexOf('  native_windows:'),workflow.indexOf('  packaged_windows:'));
 assert.ok(native.indexOf('node scripts/build-process-reader.mjs')>=0);
 assert.ok(native.indexOf('node scripts/build-process-reader.mjs')<native.indexOf('node scripts/native-verification.mjs'));
});

test('shared UI package checks fail independently and retain original evidence in every named upload',async()=>{
 const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
 for(const name of ['workspace-appearance','docs-reader','docs-format','ui-personality'])assert.ok(workflow.includes('node tests/native/'+name+'.mjs --package $preview.previewRoot'));
 assert.match(workflow,/if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged shared appearance\/navigation failed" \}/);
 assert.match(workflow,/if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged semantic Docs reading failed" \}/);
 assert.match(workflow,/if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Docs formatting\/history failed" \}/);
 const check=text=>{
  const blocks=text.split(/(?=^      - )/m).map(block=>block.split(/(?=^  [A-Za-z_][A-Za-z0-9_-]*:)/m)[0]);
  for(const upload of ['desktop-development-evidence','desktop-native-${{ matrix.group }}-evidence','desktop-packaged-evidence']){
   const own=blocks.filter(block=>block.split('\n').some(line=>line.trim()==='name: '+upload));assert.equal(own.length,1);assert.match(own[0],/if: always\(\)/);
   for(const name of ['workspace-appearance','docs-reader','docs-format','ui-personality'])for(const leaf of ['result.json','electron.log','*.png'])assert.equal(own[0].split('desktop/evidence/'+name+'/*/'+leaf).length-1,1);
  }
 };
 check(workflow);const line='            desktop/evidence/docs-reader/*/result.json';
 const misplaced=workflow.replace(line+'\n','').replace(line,line+'\n'+line);assert.equal(misplaced.split(line).length-1,3);assert.throws(()=>check(misplaced));
});
test('all original native checks are assigned once to finite independent CI groups with an all-group qualification gate',async()=>{
 const additions=['window-close-keys','window-role-privacy','diagram-dock','workspace-appearance','workspace-dock','docs-reader','ui-personality','docs-context','presentation-authoring'];
 assert.equal(typeof api.nativeGroups,'object','Native group definitions must exist');assert.deepEqual(Object.keys(api.nativeGroups),['desktop','sources','diagrams']);const actual=Object.values(api.nativeGroups).flat();assert.deepEqual([...actual].sort(),[...required,...additions].sort());assert.equal(new Set(actual).size,required.length+additions.length);for(const names of Object.values(api.nativeGroups)){assert.ok(names.length>0&&names.length<=20);for(const name of names)await access(new URL('../tests/native/'+name+'.mjs',import.meta.url));}
 const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');assert.match(workflow,/fail-fast: false/);assert.match(workflow,/group: \[desktop, sources, diagrams\]/);assert.match(workflow,/run: node scripts\/native-verification.mjs --group \$\{\{ matrix.group \}\}/);assert.match(workflow,/needs: \[windows, native_windows, packaged_windows\]/);assert.match(workflow,/SIREN_NATIVE_RESULT: \$\{\{ needs.native_windows.result \}\}/);assert.match(workflow,/\$env:SIREN_NATIVE_RESULT -ne 'success'/);assert.match(workflow,/name: desktop-native-\$\{\{ matrix.group \}\}-evidence/);assert.equal((workflow.match(/timeout-minutes: 25/g)||[]).length,3);
 assert.match(workflow,/node tests\/native\/window-close-keys\.mjs --package \$preview\.previewRoot/);
 assert.match(workflow,/if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged native close commands failed" \}/);
 assert.equal((workflow.match(/desktop\/evidence\/window-close-keys\/\*\/result\.json/g)||[]).length,3);
 assert.equal((workflow.match(/desktop\/evidence\/window-close-keys\/\*\/electron\.log/g)||[]).length,3);
 const verifyExportRetention=text=>{const blocks=text.split(/(?=^      - )/m).map(block=>block.split(/(?=^  [A-Za-z_][A-Za-z0-9_-]*:)/m)[0]);for(const name of ['desktop-development-evidence','desktop-native-${{ matrix.group }}-evidence','desktop-packaged-evidence']){const own=blocks.filter(block=>block.split('\n').some(line=>line.trim()==='name: '+name));assert.equal(own.length,1,'Named upload block must be unique');assert.match(own[0],/uses: actions\/upload-artifact@/);assert.match(own[0],/if: always\(\)/);for(const leaf of ['result.json','*.log','*.png'])assert.equal(own[0].split('desktop/evidence/diagram-export/*/'+leaf).length-1,1,'Diagram export '+leaf+' must be retained in '+name);}};
 verifyExportRetention(workflow);
 const line='            desktop/evidence/diagram-export/*/result.json',misplaced=workflow.replace(line+'\n','').replace(line,line+'\n'+line);assert.equal(misplaced.split(line).length-1,3,'Planted misplaced patterns retain the old misleading global count');assert.throws(()=>verifyExportRetention(misplaced),/Diagram export/);
});
test('Diagram docking must execute in package qualification and retain originals in every named upload',async()=>{
 const workflow=await readFile(new URL('../../.github/workflows/desktop-verify.yml',import.meta.url),'utf8');
 assert.match(workflow,/node tests\/native\/diagram-dock\.mjs --package \$preview\.previewRoot --300k/);
 assert.match(workflow,/if \(\$LASTEXITCODE -ne 0\) \{ throw "Packaged Diagram docking failed" \}/);
 const check=text=>{
  const blocks=text.split(/(?=^      - )/m).map(block=>block.split(/(?=^  [A-Za-z_][A-Za-z0-9_-]*:)/m)[0]);
  for(const name of ['desktop-development-evidence','desktop-native-${{ matrix.group }}-evidence','desktop-packaged-evidence']){
   const own=blocks.filter(block=>block.split('\n').some(line=>line.trim()==='name: '+name));assert.equal(own.length,1);assert.match(own[0],/if: always\(\)/);
   for(const leaf of ['result.json','*.log','*.png'])assert.equal(own[0].split('desktop/evidence/diagram-dock/*/'+leaf).length-1,1,'Original Diagram dock '+leaf+' must be retained in '+name);
  }
 };
 check(workflow);const line='            desktop/evidence/diagram-dock/*/result.json',misplaced=workflow.replace(line+'\n','').replace(line,line+'\n'+line);
 assert.equal(misplaced.split(line).length-1,3);assert.throws(()=>check(misplaced),/Original Diagram dock/);
});
test('a native failure or spawn refusal cannot become group success, and later checks still execute exactly once',async()=>{
 assert.equal(typeof api.runNativeGroup,'function','Native group runner must exist');let calls=[];await assert.rejects(api.runNativeGroup('forged',{run:async name=>{calls.push(name);return {code:0,signal:null};}}));assert.deepEqual(calls,[]);const names=api.nativeGroups.sources;const result=await api.runNativeGroup('sources',{run:async name=>{calls.push(name);if(name===names[0])return {code:1,signal:null};if(name===names[1])throw Object.assign(Error('PLANTED_PRIVATE_BODY'),{code:'EPERM'});return {code:0,signal:null};}});assert.deepEqual(calls,names);assert.equal(result.ok,false);assert.equal(result.results.length,names.length);assert.deepEqual(result.failed,names.slice(0,2));assert.equal(JSON.stringify(result).includes('PLANTED_PRIVATE_BODY'),false);
});
