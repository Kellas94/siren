"""Owned dummy Python children and dummy package files; no SIREN import/launch."""
from pathlib import Path
import hashlib,json,os,sys,unittest,contextlib,io
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import pipeline
from portable_support import pin,save,read,REVIEW_MODE

ROOT=None
DUMMY='''from pathlib import Path
import sys
R=Path(__file__).resolve().parent
sys.path.insert(0,str(R/'helpers'))
import portable_support as s
go=s.await_outer_go()
source=s.read(R/'SOURCE-PINS.json')
s.validate_stage(source,R,__file__,sys.executable,'producer')
s.save(R/'host-attempt.json',{'dummyOnly':True,'go':go})
s.save(R/'host-result.json',{'status':'DUMMY_HOST_COMPLETE','primaryError':None,'finalErrors':[],'applicationExecuted':False})
'''

class HostBoundaries(unittest.TestCase):
    def runtime_case(self,version='44.9.3',*,node_version=b'v24.16.0\r\n',package=None):
        from types import SimpleNamespace
        app=self.root/'runtime-app';electron=app/'node_modules/electron'
        (electron/'dist').mkdir(parents=True)
        (electron/'package.json').write_text(json.dumps({'version':version}) if package is None else package,encoding='utf8')
        (electron/'dist/electron.exe').write_bytes(b'INERT RUNTIME FIXTURE, NEVER EXECUTED')
        node=self.root/'node.exe';node.write_bytes(b'INERT NODE FIXTURE, NEVER EXECUTED')
        shell=self.root/'powershell.exe';shell.write_bytes(b'INERT POWERSHELL FIXTURE, NEVER EXECUTED')
        conhost=self.root/'conhost.exe';conhost.write_bytes(b'INERT CONSOLE FIXTURE, NEVER EXECUTED')
        out=self.root/'observed';out.mkdir()
        args=SimpleNamespace(app=app,output=out,node=str(node),powershell=str(shell),conhost=str(conhost))
        response=SimpleNamespace(returncode=0,stdout=node_version,stderr=b'')
        closure={'files':[pin(sys.executable)],'scope':'controlled closure fixture; no native qualification'}
        with patch.object(pipeline.subprocess,'run',return_value=response) as run,patch.object(pipeline,'python_runtime_snapshot',return_value=closure):
            try:value=pipeline.runtime_inputs(args,out,{})
            finally:
                self.assertEqual(run.call_count,1)
                self.assertEqual(run.call_args.args[0],[str(node),'--version'])
                self.assertEqual(run.call_args.kwargs['timeout'],10)
        return out,value
    def test_current_electron_runtime_reaches_pinned_input_receipt(self):
        out,(runtimes,rows)=self.runtime_case()
        receipt=read(out/'runtime-inputs.json')
        self.assertEqual(receipt['runtimes'],runtimes)
        self.assertEqual(receipt['electron'],pin(self.root/'runtime-app/node_modules/electron/dist/electron.exe'))
        self.assertEqual(len(receipt['electronClosure']['files']),1)
        self.assertEqual(rows,[pin(sys.executable),*runtimes.values(),pin(self.root/'conhost.exe')])
        self.assertEqual((out/'node-version-stdout.bin').read_bytes(),b'v24.16.0\r\n')
        self.assertEqual((out/'node-version-stderr.bin').read_bytes(),b'')
    def test_previous_electron_runtime_is_refused(self):
        with self.assertRaisesRegex(ValueError,'PINNED_ELECTRON_44_9_3_REQUIRED'):self.runtime_case('44.5.1')
        self.assertFalse((self.root/'observed/runtime-inputs.json').exists())
    def test_other_corrective_electron_runtime_is_refused(self):
        with self.assertRaisesRegex(ValueError,'PINNED_ELECTRON_44_9_3_REQUIRED'):self.runtime_case('44.9.1')
        self.assertFalse((self.root/'observed/runtime-inputs.json').exists())
    def test_other_major_electron_runtime_is_refused(self):
        with self.assertRaisesRegex(ValueError,'PINNED_ELECTRON_44_9_3_REQUIRED'):self.runtime_case('45.0.0')
        self.assertFalse((self.root/'observed/runtime-inputs.json').exists())
    def test_node_version_cannot_substitute_for_electron_version(self):
        with self.assertRaisesRegex(ValueError,'PINNED_ELECTRON_44_9_3_REQUIRED'):self.runtime_case('24.16.0')
        self.assertFalse((self.root/'observed/runtime-inputs.json').exists())
    def test_electron_version_cannot_substitute_for_external_node_version(self):
        with self.assertRaisesRegex(ValueError,'PINNED_NODE_24_16_0_REQUIRED'):self.runtime_case(node_version=b'v24.22.0\n')
        self.assertFalse((self.root/'observed/runtime-inputs.json').exists())
    def test_missing_electron_version_cannot_publish_receipt(self):
        with self.assertRaises(KeyError):self.runtime_case(package='{}')
        self.assertFalse((self.root/'observed/runtime-inputs.json').exists())
    def test_duplicate_electron_version_cannot_publish_receipt(self):
        with self.assertRaisesRegex(ValueError,'DUPLICATE_JSON_KEY'):self.runtime_case(package='{"version":"44.5.1","version":"44.9.3"}')
        self.assertFalse((self.root/'observed/runtime-inputs.json').exists())
    def secondary_case(self,*,close_error=False,retention_error=False,early_error=False):
        from types import SimpleNamespace
        stage=self.stage();primary={'type':'ActorError','message':'CONTROL_ACTOR_PRIMARY'};secondary=[{'stage':'actor-check','message':'CONTROL_CHILD_SECONDARY'}]
        child_receipt={'status':'ADVERSE','primaryError':primary,'finalErrors':secondary};save(stage/'host-result.json',child_receipt)
        class Job:
            def assign(self,child):return {'assignedActualHeldHandlePID':child.pid,'limitKillOnJobClose':True}
            def accounting(self):return {'activeProcesses':0}
            def close(self):
                if close_error:raise RuntimeError('CONTROL_OUTER_CLOSE')
        child=SimpleNamespace(pid=123,stdin=io.BytesIO(),wait=lambda **_:1,poll=lambda:1)
        identity={'pid':123,'creationFiletime':134367365348652692}
        actual_save=pipeline.save
        def retained_save(path,value):
            if retention_error and Path(path)==stage/'outer-host-result.json':raise PermissionError('CONTROL_OUTER_RETENTION')
            return actual_save(path,value)
        before=pipeline.StageFailure(primary,secondary) if early_error else None
        diagnostic=io.StringIO()
        with patch.object(pipeline,'OwnedJob',Job),patch.object(pipeline.subprocess,'Popen',return_value=child),patch.object(pipeline.collect,'held_identity',side_effect=before,return_value=identity),patch.object(pipeline.collect,'held_identity_after_exit',return_value=identity),patch.object(pipeline,'save',retained_save),contextlib.redirect_stderr(diagnostic):
            with self.assertRaises(pipeline.StageFailure) as observed:pipeline.launch_host(stage,self.root,{})
        self.assertEqual(observed.exception.observedPrimary,primary)
        self.assertEqual(read(stage/'host-result.json'),child_receipt)
        receipt=read(self.root/'producer-outer-host-fallback.json' if retention_error else stage/'outer-host-result.json')
        self.assertEqual(receipt['primaryError'],primary);self.assertEqual(observed.exception.observedSecondary,receipt['finalErrors'])
        self.assertEqual(receipt.get('identityBefore',identity)['creationFiletime'],134367365348652692)
        return receipt
    def test_child_secondary_reaches_outer_error_without_masking_primary(self):
        receipt=self.secondary_case();self.assertEqual([r['message'] for r in receipt['finalErrors']],['CONTROL_CHILD_SECONDARY'])
    def test_child_outer_close_and_retention_secondaries_keep_order(self):
        receipt=self.secondary_case(close_error=True,retention_error=True);self.assertEqual([r['message'] for r in receipt['finalErrors']],['CONTROL_CHILD_SECONDARY','CONTROL_OUTER_CLOSE','CONTROL_OUTER_RETENTION'])
    def test_early_observed_stage_secondary_is_not_lost(self):
        receipt=self.secondary_case(early_error=True);self.assertEqual([r['message'] for r in receipt['finalErrors']],['CONTROL_CHILD_SECONDARY'])
    def setUp(self):
        self.root=ROOT/self._testMethodName;self.root.mkdir()
    def stage(self):
        stage=self.root/'producer';stage.mkdir();(stage/'helpers').mkdir()
        (stage/'host.py').write_text(DUMMY,encoding='utf8')
        (stage/'helpers/portable_support.py').write_bytes((HERE/'portable_support.py').read_bytes())
        source={'schema':1,'reviewMode':REVIEW_MODE,'stage':'producer','python':pin(sys.executable),
                'files':[pin(stage/'host.py'),pin(stage/'helpers/portable_support.py')],'inputTrees':[]}
        save(stage/'SOURCE-PINS.json',source);return stage
    def test_actual_host_streams_and_manifest_compose(self):
        stage=self.stage();value=pipeline.launch_host(stage,self.root,dict(os.environ))
        self.assertEqual(value['status'],'DUMMY_HOST_COMPLETE');self.assertFalse(value['applicationExecuted'])
        receipt=read(stage/'outer-host-result.json')
        self.assertIsNone(receipt['primaryError']);self.assertEqual(receipt['finalErrors'],[])
        self.assertEqual(receipt['identityBefore']['creationFiletime'],receipt['identityAfter']['creationFiletime'])
        self.assertTrue((self.root/'producer-host-stdout.bin').is_file())
        self.assertFalse((stage/'host-stdout.bin').exists())
    def test_assignment_failure_stops_actual_original_child_before_go(self):
        stage=self.stage();children=[];actual_popen=pipeline.subprocess.Popen
        def popen(*args,**kwargs):
            child=actual_popen(*args,**kwargs);children.append(child);return child
        with patch.object(pipeline.subprocess,'Popen',popen),patch.object(pipeline.OwnedJob,'assign',side_effect=RuntimeError('CONTROL_ASSIGNMENT_REFUSAL')):
            with self.assertRaises(pipeline.StageFailure) as failure:pipeline.launch_host(stage,self.root,dict(os.environ))
        self.assertEqual(failure.exception.observedPrimary['message'],'CONTROL_ASSIGNMENT_REFUSAL')
        self.assertEqual(len(children),1);self.assertIsNotNone(children[0].poll())
        self.assertFalse((stage/'host-attempt.json').exists())
        self.assertFalse((self.root/'producer-outer-go.json').exists())
        receipt=read(stage/'outer-host-result.json')
        self.assertEqual(receipt['primaryError']['message'],'CONTROL_ASSIGNMENT_REFUSAL')
        self.assertTrue(receipt['unassignedCleanup']['ownedOriginalPopenHandleTerminated'])
        self.assertEqual(receipt['finalJob']['activeProcesses'],0)
    def test_assignment_and_receipt_refusal_preserve_first_error(self):
        stage=self.stage();original_save=pipeline.save
        def save(path,value):
            if Path(path)==stage/'outer-host-result.json':raise PermissionError('CONTROL_OUTER_RECEIPT_REFUSAL')
            return original_save(path,value)
        diagnostic=io.StringIO()
        with patch.object(pipeline,'save',save),patch.object(pipeline.OwnedJob,'assign',side_effect=RuntimeError('CONTROL_ASSIGNMENT_PRIMARY')),contextlib.redirect_stderr(diagnostic):
            with self.assertRaises(pipeline.StageFailure) as failure:pipeline.launch_host(stage,self.root,dict(os.environ))
        self.assertEqual(failure.exception.observedPrimary['message'],'CONTROL_ASSIGNMENT_PRIMARY')
        fallback=read(self.root/'producer-outer-host-fallback.json')
        self.assertEqual(fallback['primaryError']['message'],'CONTROL_ASSIGNMENT_PRIMARY')
        self.assertEqual(fallback['finalErrors'][0]['message'],'CONTROL_OUTER_RECEIPT_REFUSAL')
        self.assertEqual(failure.exception.observedSecondary,fallback['finalErrors'])
        self.assertTrue(fallback['unassignedCleanup']['ownedOriginalPopenHandleTerminated'])
        self.assertIn('CONTROL_ASSIGNMENT_PRIMARY',diagnostic.getvalue())
        (self.root/'fallback-stderr.txt').write_text(diagnostic.getvalue(),encoding='utf8')
    def test_pipeline_result_refusal_preserves_primary_and_full_filetime(self):
        self.assertTrue(hasattr(pipeline,'retain_receipt'),'PRIMARY_RECEIPT_FALLBACK_NOT_IMPLEMENTED')
        path=self.root/'pipeline-result.json';path.mkdir()
        result={'status':'ADVERSE','primaryError':{'message':'CONTROL_PRODUCER_PRIMARY'},'finalErrors':[],'creationFiletime':134367184483756678}
        diagnostic=io.StringIO()
        with contextlib.redirect_stderr(diagnostic):pipeline.retain_receipt(path,result,self.root/'pipeline-fallback.json')
        fallback=read(self.root/'pipeline-fallback.json')
        self.assertEqual(fallback['primaryError']['message'],'CONTROL_PRODUCER_PRIMARY')
        self.assertEqual(fallback['creationFiletime'],134367184483756678)
        self.assertEqual(len(fallback['finalErrors']),1)
        self.assertTrue(fallback['fallbackDiagnosticOnly'])
        (self.root/'fallback-stderr.txt').write_text(diagnostic.getvalue(),encoding='utf8')
    def package(self,empty=False):
        package=self.root/'package';app=package/'App/versions/0.1.0';(app/'resources').mkdir(parents=True)
        exe=app/'SIREN.exe';exe.write_bytes(b'DUMMY NOT EXECUTABLE')
        archive=app/'resources/app.asar';archive.write_bytes(b'DUMMY NOT ARCHIVE')
        identity=lambda p:{k:pin(p)[k] for k in ['bytes','sha256']}
        save(package/'BUILD-IDENTITY.json',{'schema':1,'kind':'development-preview','releaseAdmitted':False,
             'sourceCommit':'a'*40,'appRelativePath':'App/versions/0.1.0/SIREN.exe','appArchive':identity(archive),'runtimeBinary':identity(exe)})
        if empty:(package/'Data').mkdir()
        return package
    def test_original_absent_data_preserved(self):
        root=self.package();_,before=pipeline.physical_package(root);pipeline.verify_package_unchanged(root,before)
        save(self.root/'observed.json',{'before':before,'after':pipeline.snapshot(root),'applicationExecuted':False})
    def test_original_empty_data_preserved(self):
        root=self.package(True);_,before=pipeline.physical_package(root);pipeline.verify_package_unchanged(root,before)
        save(self.root/'observed.json',{'before':before,'after':pipeline.snapshot(root),'applicationExecuted':False})
    def test_original_absent_data_creation_refused(self):
        root=self.package();_,before=pipeline.physical_package(root);(root/'Data').mkdir()
        with self.assertRaisesRegex(ValueError,'ORIGINAL_PACKAGE_DRIFT'):pipeline.verify_package_unchanged(root,before)
        save(self.root/'observed.json',{'before':before,'after':pipeline.snapshot(root),'expectedRefusal':'ORIGINAL_PACKAGE_DRIFT','applicationExecuted':False})
    def test_original_empty_data_population_refused(self):
        root=self.package(True);_,before=pipeline.physical_package(root);(root/'Data/unexpected.json').write_bytes(b'{}')
        with self.assertRaisesRegex(ValueError,'ORIGINAL_PACKAGE_DRIFT'):pipeline.verify_package_unchanged(root,before)
        save(self.root/'observed.json',{'before':before,'after':pipeline.snapshot(root),'expectedRefusal':'ORIGINAL_PACKAGE_DRIFT','applicationExecuted':False})

if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Pass a fresh owned evidence directory')
    ROOT=Path(sys.argv.pop()).resolve();ROOT.mkdir();pipeline.fixed_flags()
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(HostBoundaries))
    save(ROOT/'controls-result.json',{'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'applicationExecuted':False,'scope':'Owned dummy Python host and dummy package file boundaries only'})
    raise SystemExit(0 if result.wasSuccessful() else 1)
