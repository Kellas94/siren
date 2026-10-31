"""Input contracts and mocked census file controls; no application/process query."""
from pathlib import Path
import copy,json,runpy,sys,unittest
MODULE=Path(__file__).with_name('producer_inputs.py')
API=runpy.run_path(str(MODULE)) if MODULE.exists() else {}
RECORDS=[]

def config(mode='development'):
    pin=lambda path:{'path':path,'bytes':12345,'sha256':'d'*64}
    value={'schema':1,'mode':mode,'appRoot':'D:/Runner work/Știință/app','runtimes':{'node':pin('E:/tools/node.exe'),'python':pin('E:/Python 3/python.exe'),'powershell':pin('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')}}
    if mode=='package':value['package']={'root':'F:/Preview Știință/build-a','receipt':{'schema':1,'kind':'development-preview','releaseAdmitted':False,'sourceCommit':'a'*40,'appRelativePath':'App/versions/0.1.0/SIREN.exe','appArchive':{'bytes':98765,'sha256':'b'*64},'runtimeBinary':{'bytes':654321,'sha256':'c'*64},'renderer':{'additionalReceiptData':'retained by physical caller'}}}
    return value

def expected_result(c):
    if c['mode']=='development':return {'status':'COMPLETE'}
    r=c['package']['receipt'];return {'status':'COMPLETE','package':{'sourceCommit':r['sourceCommit'],'archive':copy.deepcopy(r['appArchive']),'runtime':copy.deepcopy(r['runtimeBinary'])}}

def call(c,evidence=None,result=None):
    if not API:raise AssertionError('PRODUCER_INPUT_ADAPTER_CAPABILITY_MISSING')
    plan=API['plan_producer'](c)
    evidence=evidence or plan['evidenceParent']+'\\2026-10-17T12-00-00.000Z'
    bound=API['bind_producer_output'](plan,evidence,expected_result(c) if result is None else result)
    return {'plan':plan,'bound':bound}

class Inputs(unittest.TestCase):
    def test_development(self):
        c=config();r=call(c);RECORDS.append({'case':self.id(),'input':c,'actual':r})
        self.assertEqual(r['plan']['producerArguments'],[])
        self.assertEqual(r['plan']['sourceScript'],'D:\\Runner work\\Știință\\app\\tests\\native\\source-sync.mjs')
        self.assertEqual(r['bound']['dataRoot'],r['bound']['evidenceRoot']+'\\owned-data')
        self.assertFalse(r['bound']['physicalAdmissionEstablished'])
    def test_package(self):
        c=config('package');r=call(c);RECORDS.append({'case':self.id(),'input':c,'actual':r})
        self.assertEqual(r['plan']['producerArguments'],['--package','F:\\Preview Știință\\build-a'])
        self.assertEqual(r['bound']['dataRoot'],r['bound']['evidenceRoot']+'\\Pachet-Știință-Sync\\Data')
        self.assertEqual(r['plan']['archivePath'],'F:\\Preview Știință\\build-a\\App\\versions\\0.1.0\\resources\\app.asar')
    def test_other_checkout_and_runtimes(self):
        c=config('package');c['appRoot']='Z:/different/checkout/desktop';c['runtimes']['node']['path']='Y:/Node new/node.exe';c['runtimes']['node']['sha256']='e'*64;c['package']['root']='X:/another/preview';r=call(c)
        RECORDS.append({'case':self.id(),'input':c,'actual':r});self.assertEqual(r['plan']['runtimes'],c['runtimes']);self.assertEqual(r['plan']['archivePath'],'X:\\another\\preview\\App\\versions\\0.1.0\\resources\\app.asar')
    def test_no_input_aliases(self):
        c=config('package');r=call(c);c['runtimes']['node']['bytes']=99;c['package']['receipt']['appArchive']['bytes']=1
        RECORDS.append({'case':self.id(),'actual':r});self.assertEqual(r['plan']['runtimes']['node']['bytes'],12345);self.assertEqual(r['plan']['packageResultExpected']['archive']['bytes'],98765)
    def test_plan_output_tamper(self):
        if not API:raise AssertionError('PRODUCER_INPUT_ADAPTER_CAPABILITY_MISSING')
        c=config();plan=API['plan_producer'](c);plan['evidenceParent']='D:\\unrelated'
        row={'case':self.id(),'plan':plan,'expected':'PRODUCER_PLAN_REQUIRED'};RECORDS.append(row)
        with self.assertRaisesRegex(ValueError,'^PRODUCER_PLAN_REQUIRED$'):API['bind_producer_output'](plan,'D:/unrelated/run',expected_result(c))

def attach(name,change,code,mode='package',output=None):
    def test(self):
        c=config(mode);change(c);evidence=None;result=None
        if output:
            evidence,result=output(c)
        row={'case':self.id(),'input':c,'evidence':evidence,'result':result,'expected':code};RECORDS.append(row)
        try:row['accepted']=call(c,evidence,result)
        except ValueError as error:row['actualError']=str(error);self.assertEqual(str(error),code)
        else:self.fail('INVALID_INPUT_ACCEPTED')
    setattr(Inputs,'test_'+name,test)

attach('schema_boolean',lambda c:c.update(schema=True),'PRODUCER_CONFIG_REQUIRED')
attach('unknown_mode',lambda c:c.update(mode='portable'),'PRODUCER_MODE_REQUIRED')
attach('unknown_key',lambda c:c.update(extra=True),'PRODUCER_CONFIG_REQUIRED')
attach('development_unexpected_package',lambda c:c.update(mode='development'),'PRODUCER_PACKAGE_MODE_REQUIRED')
attach('package_missing',lambda c:c.pop('package'),'PRODUCER_PACKAGE_MODE_REQUIRED')
attach('runtime_missing',lambda c:c['runtimes'].pop('python'),'PRODUCER_RUNTIME_IDENTITIES_REQUIRED')
attach('runtime_boolean_size',lambda c:c['runtimes']['node'].update(bytes=True),'PRODUCER_RUNTIME_IDENTITIES_REQUIRED')
attach('runtime_bad_sha',lambda c:c['runtimes']['node'].update(sha256='G'*64),'PRODUCER_RUNTIME_IDENTITIES_REQUIRED')
attach('runtime_unknown_field',lambda c:c['runtimes']['node'].update(extra=1),'PRODUCER_RUNTIME_IDENTITIES_REQUIRED')
attach('runtime_relative',lambda c:c['runtimes']['node'].update(path='node.exe'),'BOUNDED_ABSOLUTE_WINDOWS_PATH_REQUIRED')
for name,value in [('drive_relative','D:app'),('unc','//server/share/app'),('device','//?/D:/app'),('traversal','D:/app/../else'),('dot','D:/app/./child'),('alias_dot','D:/app.'),('alias_space','D:/app '),('reserved','D:/NUL/app'),('ads','D:/app:stream'),('duplicate_separator','D:/app//child')]:
    attach('path_'+name,lambda c,v=value:c.update(appRoot=v),'BOUNDED_ABSOLUTE_WINDOWS_PATH_REQUIRED')
attach('receipt_schema_boolean',lambda c:c['package']['receipt'].update(schema=True),'DEVELOPMENT_PACKAGE_RECEIPT_REQUIRED')
attach('receipt_release',lambda c:c['package']['receipt'].update(releaseAdmitted=True),'DEVELOPMENT_PACKAGE_RECEIPT_REQUIRED')
attach('receipt_false_integer',lambda c:c['package']['receipt'].update(releaseAdmitted=0),'DEVELOPMENT_PACKAGE_RECEIPT_REQUIRED')
attach('receipt_kind',lambda c:c['package']['receipt'].update(kind='release'),'DEVELOPMENT_PACKAGE_RECEIPT_REQUIRED')
attach('receipt_commit',lambda c:c['package']['receipt'].update(sourceCommit='a'*39),'DEVELOPMENT_PACKAGE_RECEIPT_REQUIRED')
attach('receipt_archive_boolean',lambda c:c['package']['receipt']['appArchive'].update(bytes=True),'DEVELOPMENT_PACKAGE_RECEIPT_REQUIRED')
attach('receipt_app_traversal',lambda c:c['package']['receipt'].update(appRelativePath='../SIREN.exe'),'DEVELOPMENT_PACKAGE_LAYOUT_REQUIRED')
attach('receipt_app_absolute',lambda c:c['package']['receipt'].update(appRelativePath='C:/SIREN.exe'),'DEVELOPMENT_PACKAGE_LAYOUT_REQUIRED')
attach('wrong_evidence_parent',lambda c:None,'EXPLICIT_SOURCE_SYNC_EVIDENCE_REQUIRED',output=lambda c:('D:/unrelated/2026',expected_result(c)))
attach('nested_evidence',lambda c:None,'EXPLICIT_SOURCE_SYNC_EVIDENCE_REQUIRED',output=lambda c:(c['appRoot']+'/evidence/source-sync/nested/run',expected_result(c)))
attach('wrong_result_archive',lambda c:None,'PRODUCER_PACKAGE_IDENTITY_REQUIRED',output=lambda c:(None,{**expected_result(c),'package':{**expected_result(c)['package'],'archive':{'bytes':98766,'sha256':'b'*64}}}))
attach('wrong_result_commit',lambda c:None,'PRODUCER_PACKAGE_IDENTITY_REQUIRED',output=lambda c:(None,{**expected_result(c),'package':{**expected_result(c)['package'],'sourceCommit':'f'*40}}))
attach('missing_result_package',lambda c:None,'PRODUCER_PACKAGE_IDENTITY_REQUIRED',output=lambda c:(None,{'status':'COMPLETE'}))
attach('unexpected_development_package_result',lambda c:None,'PRODUCER_PACKAGE_IDENTITY_REQUIRED',mode='development',output=lambda c:(None,{'status':'COMPLETE','package':{}}))
attach('result_adverse',lambda c:None,'PRODUCER_RESULT_COMPLETION_REQUIRED',output=lambda c:(None,{**expected_result(c),'status':'ADVERSE'}))
attach('result_identity_unknown_key',lambda c:None,'PRODUCER_PACKAGE_IDENTITY_REQUIRED',output=lambda c:(None,{**expected_result(c),'package':{**expected_result(c)['package'],'extra':True}}))
attach('result_boolean_archive_size',lambda c:c['package']['receipt']['appArchive'].update(bytes=1),'PRODUCER_PACKAGE_IDENTITY_REQUIRED',output=lambda c:(None,{**expected_result(c),'package':{**expected_result(c)['package'],'archive':{'bytes':True,'sha256':'b'*64}}}))
attach('runtime_negative_size',lambda c:c['runtimes']['node'].update(bytes=-1),'PRODUCER_RUNTIME_IDENTITIES_REQUIRED')

attach('receipt_app_unsupported_version',lambda c:c['package']['receipt'].update(appRelativePath='App/versions/12.34.56/SIREN.exe'),'DEVELOPMENT_PACKAGE_LAYOUT_REQUIRED')

import ast, tempfile, types, subprocess, time, os, stat, hashlib
from unittest.mock import patch
CIM_RECORDS=[]
HERE=Path(__file__).resolve().parent

class CensusDiagnostics(unittest.TestCase):
    def observe(self,mode):
        # Execute actual maintained functions only; no module imports or processes.
        source=(HERE/'producer_collector.py').read_text(encoding='utf8');tree=ast.parse(source)
        selected=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['need','no_links','pin','save','census']]
        ns=dict(Path=Path,hashlib=hashlib,json=json,os=os,stat=stat,subprocess=subprocess,time=time,POWERSHELL=Path('C:/inert-fixture/powershell.exe'))
        exec(compile(ast.Module(body=selected,type_ignores=[]),'actual-maintained-census-functions','exec'),ns)
        raw=json.dumps(dict(querySucceeded=True,totalObserved=1,nullExecutableFields=0,nullCommandFields=0,owned=[])).encode('utf8')
        stderr=b'SIREN_CIM_STAGE|script-entered\r\nSIREN_CIM_STAGE|scope-read\r\n';code=0;seen={}
        if mode=='markers-only':raw=b''
        if mode=='malformed':raw=b'{bad'
        if mode=='nonzero':code=3
        if mode=='false-query':raw=b'{"querySucceeded":false,"owned":[]}'
        with tempfile.TemporaryDirectory(prefix='siren-census-stage-') as folder:
            root=Path(folder);scope=root/'scope.json';scope.write_text('{"processPrefixes":["C:/inert-fixture"]}',encoding='utf8')
            def invoke(command,**kwargs):
                self.assertEqual(command[:4],['C:\\inert-fixture\\powershell.exe','-NoProfile','-NonInteractive','-Command'])
                self.assertEqual(kwargs,dict(capture_output=True,timeout=10,creationflags=subprocess.CREATE_NO_WINDOW));seen['script']=command[4]
                if mode=='timeout':raise subprocess.TimeoutExpired(command,10,output=b'',stderr=stderr)
                return types.SimpleNamespace(returncode=code,stdout=raw,stderr=stderr)
            error=None;value=None
            with patch.object(subprocess,'run',side_effect=invoke):
                try:value=ns['census'](scope,root,'case',10)
                except ValueError as e:error=str(e)
            # The record and partial streams must exist before refusal escapes.
            record=json.loads((root/'case.json').read_bytes());out=(root/'case-stdout.bin').read_bytes();err=(root/'case-stderr.bin').read_bytes()
            row=dict(mode=mode,record=record,stdout=out.decode('utf8'),stderr=err.decode('utf8'),error=error,script=seen['script'])
            CIM_RECORDS.append(row);return row,value

    def test_five_fixed_flushed_markers_surround_unchanged_operations(self):
        row,_=self.observe('success');script=row['script'];stages=['script-entered','scope-read','cim-returned','ownership-filtered','json-written']
        positions=[]
        for stage in stages:
            marker="[Console]::Error.WriteLine('SIREN_CIM_STAGE|"+stage+"'); [Console]::Error.Flush();"
            self.assertEqual(script.count(marker),1);positions.append(script.index(marker))
        self.assertEqual(positions,sorted(positions))
        self.assertLess(positions[0],script.index('$s=Get-Content'))
        self.assertLess(script.index('$s=Get-Content'),positions[1]);self.assertLess(positions[1],script.index('$all=@(Get-CimInstance'))
        self.assertLess(script.index('$all=@(Get-CimInstance'),positions[2]);self.assertLess(positions[2],script.index('$owned=@('))
        self.assertLess(script.index('$owned=@('),positions[3]);self.assertLess(positions[3],script.index('@{querySucceeded=$true'))
        self.assertLess(script.index('ConvertTo-Json -Depth 5 -Compress'),positions[4])
        self.assertEqual(script.count('Get-CimInstance -ClassName Win32_Process -ErrorAction Stop'),1)
        # Exact published39c script, after removing only the five diagnostics.
        preserved=script
        for stage in stages:
            marker="[Console]::Error.WriteLine('SIREN_CIM_STAGE|"+stage+"'); [Console]::Error.Flush();"
            preserved=preserved.replace('; '+marker,'') if stage=='json-written' else preserved.replace(marker+' ','')
        preserved=preserved.replace(row['record']['scope']['path'],str(Path('C:/inert-fixture/scope.json')))
        self.assertEqual(hashlib.sha256(preserved.encode('utf8')).hexdigest(),'9ea2f7c6604209855a42a4cb9f424b050adb6e6bccf49b257b0cd2647f60e2bc')

    def test_timeout_partial_stages_and_exact_script_hash_precede_unchanged_refusal(self):
        row,value=self.observe('timeout');self.assertIsNone(value);self.assertEqual(row['error'],'CIM_OBSERVATION_UNAVAILABLE')
        self.assertEqual(row['record']['error']['type'],'TimeoutExpired');self.assertEqual(row['record']['timeoutSeconds'],10)
        self.assertEqual(row['stdout'],'');self.assertEqual(row['stderr'],'SIREN_CIM_STAGE|script-entered\r\nSIREN_CIM_STAGE|scope-read\r\n')
        self.assertEqual(row['record']['observationScriptSha256'],hashlib.sha256(row['script'].encode('utf8')).hexdigest())
        self.assertNotIn('returncode',row['record'])

    def test_valid_json_and_zero_exit_remain_required_and_unchanged(self):
        row,value=self.observe('success');self.assertIsNone(row['error']);self.assertEqual(value['returncode'],0)
        self.assertIs(value['querySucceeded'],True);self.assertEqual(value['owned'],[]);self.assertEqual(value['totalObserved'],1)
        self.assertEqual(value['observationScriptSha256'],hashlib.sha256(row['script'].encode('utf8')).hexdigest())

    def test_markers_cannot_admit_empty_malformed_nonzero_or_false_query(self):
        for mode in ['markers-only','malformed','nonzero','false-query']:
            with self.subTest(mode=mode):
                row,value=self.observe(mode);self.assertIsNone(value);self.assertEqual(row['error'],'CIM_OBSERVATION_UNAVAILABLE')
                self.assertIn('SIREN_CIM_STAGE|scope-read',row['stderr'])

if __name__=='__main__':
    suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(Inputs),unittest.defaultTestLoader.loadTestsFromTestCase(CensusDiagnostics)]);result=unittest.TextTestRunner(stream=sys.stderr,verbosity=2).run(suite)
    print(json.dumps({'status':'PURE_CONTROLS_COMPLETE' if result.wasSuccessful() else 'ADVERSE','cases':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'records':RECORDS,'censusDiagnosticRecords':CIM_RECORDS,'applicationExecuted':False},ensure_ascii=False));raise SystemExit(0 if result.wasSuccessful() else 1)
