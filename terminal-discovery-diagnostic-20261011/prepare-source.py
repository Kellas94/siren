"""One-use transparent source derivation. No launch, compiler, addon or network."""
from pathlib import Path
import hashlib, json

root = Path(__file__).resolve().parent.parent
out = Path(__file__).resolve().parent
sha = lambda b: hashlib.sha256(b).hexdigest()
def write(name, data):
    with (root / name).open('xb') as f:
        f.write(data if isinstance(data, bytes) else data.encode('utf-8'))
def once(text, before, after):
    assert text.count(before) == 1, before
    return text.replace(before, after)

worker = (root / 'desktop/tests/native/terminal-cmdlet-runtime-worker.mjs').read_bytes()
assert sha(worker) == '26da5371f6af6e53aade79ebc340d7687596a1b5bbd427dc13cc35caa7f2ab33'
qualified = once(worker.decode('utf-8'),
    "import {createSingleCmdletFixture} from './terminal-cmdlet-fixture.mjs';",
    "import {createQualifiedSingleCmdletFixture as createSingleCmdletFixture} from './terminal-discovery-fixture.mjs';")
write('desktop/tests/native/terminal-discovery-worker.mjs', qualified)

driver = (root / 'desktop/tests/native/terminal-cmdlet-runtime.mjs').read_bytes()
assert sha(driver) == '5a6cb54a2d1de6c5c0db00e1b2e310600a64c46ac19a080088d1f6144d108549'
text = driver.decode('utf-8')
changes = [
 ("import {createSingleCmdletFixture} from './terminal-cmdlet-fixture.mjs';", "import {createComparedCmdletFixture,coldCmdletComparisonCases} from './terminal-discovery-fixture.mjs';"),
 ('value,{run,commit,control,fixture}', 'value,{run,commit,control,mode,fixture}'),
 ('createSingleCmdletFixture({control,projectDirectory:dirname(fixture.scriptPath),token:fixture.expected})', 'createComparedCmdletFixture({control,mode,projectDirectory:dirname(fixture.scriptPath),token:fixture.expected})'),
 ("out=join(root,'desktop/evidence/terminal-cmdlet-runtime',suffix)", "out=join(root,'desktop/evidence/terminal-discovery-runtime',suffix)"),
 ("scope:'HOSTED_COLD_SINGLE_CMDLET_DIAGNOSIS'", "scope:'HOSTED_COLD_CMDLET_RESOLUTION_COMPARISON'"),
 ("join(root,'desktop/tests/native/terminal-cmdlet-runtime-inputs.json')", "join(root,'desktop/tests/native/terminal-discovery-runtime-inputs.json')"),
 ("manifest.scope,'CMDLET_DIAGNOSTIC_SOURCE_PINS'", "manifest.scope,'CMDLET_COMPARISON_SOURCE_PINS'"),
 ("  for(const required of ['desktop/tests/native/terminal-cmdlet-runtime.mjs'", "  for(const required of ['desktop/tests/native/terminal-discovery-runtime.mjs','desktop/tests/native/terminal-discovery-worker.mjs','desktop/tests/native/terminal-discovery-fixture.mjs','desktop/tests/native/terminal-discovery-fixture.test.mjs','desktop/tests/terminal-discovery-runtime.test.mjs','desktop/tests/native/terminal-cmdlet-runtime.mjs'"),
 ("'.github/workflows/terminal-cmdlet-runtime.yml'])assert.ok", "'.github/workflows/terminal-discovery-runtime.yml'])assert.ok"),
 ('  for(const control of controls){', '  for(const {armId,control,mode} of coldCmdletComparisonCases){'),
 ('const armOut=join(out,control);', 'const armOut=join(out,armId);'),
 ("const entryPath=join(armOut,'runtime-entry.mjs');await writeFile(entryPath,createCmdletRuntimeEntry(join(root,'desktop/tests/native/terminal-cmdlet-runtime-worker.mjs'),options),{flag:'wx'});", "const workerPath=join(root,'desktop/tests/native',mode==='original'?'terminal-cmdlet-runtime-worker.mjs':'terminal-discovery-worker.mjs');\r\n   const entryPath=join(armOut,'runtime-entry.mjs');await writeFile(entryPath,createCmdletRuntimeEntry(workerPath,options),{flag:'wx'});"),
 ("const arm={control,status:'STARTED'", "const arm={armId,mode,control,status:'STARTED'"),
 ('validateSingleCmdletResult(worker,{...context,control,fixture})', 'validateSingleCmdletResult(worker,{...context,control,mode,fixture})'),
 ("assert.equal(worker.control,control);assert.equal(worker.cleanupVerified,true);", "assert.equal(worker.control,control);assert.equal(worker.fixtureVariant,createComparedCmdletFixture({control,mode,projectDirectory:join(armOut,'project țară 日本語'),token:'a'.repeat(32)}).variant);assert.equal(worker.cleanupVerified,true);"),
 ("assert.deepEqual(receipt.arms.map(a=>a.control),controls);", "assert.deepEqual(receipt.arms.map(a=>a.armId),coldCmdletComparisonCases.map(a=>a.armId));"),
 ("'CMDLET_DIAGNOSTIC_ADVERSE'", "'CMDLET_COMPARISON_ADVERSE'"),
 ("'TWO_COLD_CMDLET_CONTROLS_OBSERVED_NOT_ORIGINAL_LOCK_QUALIFICATION'", "'FOUR_COLD_CMDLET_COMPARISON_ARMS_OBSERVED_NOT_ORIGINAL_LOCK_QUALIFICATION'"),
]
for before, after in changes:
    text = once(text, before, after)
write('desktop/tests/native/terminal-discovery-runtime.mjs', text)

workflow = (root / '.github/workflows/terminal-cmdlet-runtime.yml').read_text(encoding='utf-8')
workflow = once(workflow, 'name: Terminal cold single-cmdlet diagnosis (not admitted)', 'name: Terminal cold command-resolution comparison (not admitted)')
workflow = workflow.replace('terminal-cmdlet-runtime', 'terminal-discovery-runtime')
workflow = once(workflow, "      - 'desktop/tests/native/terminal-cmdlet-*'", "      - 'desktop/tests/native/terminal-discovery-*'")
workflow = once(workflow, 'Observe two separate cold-session original cmdlets and native cleanup', 'Compare original and module-qualified cmdlets in four fresh processes')
workflow = once(workflow, '            desktop/tests/native/terminal-cmdlet-*', '            desktop/tests/native/terminal-cmdlet-*\n            desktop/tests/native/terminal-discovery-*\n            desktop/tests/terminal-discovery-runtime.test.mjs')
write('.github/workflows/terminal-discovery-runtime.yml', workflow)
write('terminal-discovery-diagnostic-20261011/source-derivation.json', json.dumps({
    'author':'/root', 'classification':'PREPARED_SOURCE_ONLY_NOT_EXECUTED',
    'workerOriginalSha256':sha(worker), 'driverOriginalSha256':sha(driver),
    'workerChange':'Only the fixed fixture import; native lifecycle, timers and graph unchanged.',
    'driverLiteralReplacements':[{'before':a,'after':b} for a,b in changes],
    'originalSourcesModified':False, 'nativeExecutionAdmitted':False,
}, indent=2)+'\n')
print('Prepared fixed comparison source; no native work or dispatch.')
