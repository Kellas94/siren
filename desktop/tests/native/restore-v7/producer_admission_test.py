"""Pure synthetic refusal controls; no application, process API or Data access."""
from pathlib import Path
import copy, hashlib, json, runpy, struct, sys, unittest

HERE=Path(__file__).resolve().parent
try:
    admit=runpy.run_path(str(HERE/'producer_admission.py'))['admit']
except FileNotFoundError:
    admit=None
ACTUAL=[]

def fixture():
    sha=hashlib.sha256(b'{}').hexdigest()
    rows=[{'relativePath':'Projects','kind':'directory'}, {'relativePath':'Projects/p','kind':'directory'}, {'relativePath':'Projects/p/current.json','kind':'file','bytes':2,'sha256':sha}, {'relativePath':'Recovery','kind':'directory'}, {'relativePath':'session-selection.json','absent':True}]
    files=[{k:v for k,v in row.items() if k!='kind'} for row in rows if row.get('kind')=='file']
    dirs=[r for r in rows if r.get('kind')=='directory']
    pointers=[{**r,'unchanged':True} for r in rows if r['relativePath'].endswith('/current.json') or r['relativePath']=='session-selection.json']
    manifest={'schema':1,'phase':'after-close','source':'C:\\qa\\run\\owned-data','scope':['Projects/**','Recovery/**','session-selection.json'],'coherence':'POST_CLOSE_REQUIRES_EXTERNAL_QUIESCENCE','errors':[],'errorCount':0,'captureComplete':True,'stableAroundCopy':True,'limits':{'files':4096,'fileBytes':16777216,'totalBytes':134217728},'before':copy.deepcopy(rows),'after':copy.deepcopy(rows),'files':files,'directories':dirs,'pointerStability':pointers}
    names=['case '+str(n) for n in range(5)]
    inputs={'tests/native/source-sync.mjs':'a'*64,'generated/windows/code.html':'b'*64}
    result={'status':'COMPLETE','cases':[{'name':name,'ok':True} for name in names],'inputs':inputs,'afterInputs':copy.deepcopy(inputs),'inputsUnchanged':True,'driverCloseReturned':True,'dataAdmissions':{'ownedData':{'path':manifest['source'],'state':'ABSENT'}},'rawEvidence':{'afterClose':copy.deepcopy(manifest)}}
    pids={'querySucceeded':True,'winError':0,'assigned':0,'returned':0,'pids':[],'returnedBytes':8,'capacity':512,'rawHex':(struct.pack('<II',0,0)+bytes(4096)).hex(),'complete':True}
    decoded=dict(zip(['user','kernel','periodUser','periodKernel','pageFaults','totalProcesses','activeProcesses','terminatedProcesses'],[0,0,0,0,0,2,0,0]))
    raw={'querySucceeded':True,'winError':0,'hex':struct.pack('<qqqqIIII',*decoded.values()).hex(),'returnedBytes':48,'decoded':decoded}
    accounting={'totalProcesses':2,'activeProcesses':0,'terminatedProcesses':0}
    identity={'pid':41,'handlePid':41,'executablePath':'C:\\qa\\node.exe','creationFiletime':134367098977200493,'exitCode':259,'fromHeldChildHandle':True}
    obs={'producerPid':41,'assignment':{'assignedActualHeldHandlePID':41,'limitKillOnJobClose':True},'identityBefore':identity,'identityAfter':{**identity,'exitCode':0},'assignedAtNs':10,'goAtNs':20,'exitObservedAtNs':30,'childExitCode':0,'forcedCleanup':None,'errors':[],
      'closure':{'startedAtNs':40,'completedAtNs':50,'beforePids':pids,'afterPids':copy.deepcopy(pids),'helperAccounting':accounting,'afterAccounting':copy.deepcopy(accounting),'rawAccounting':raw,'errors':[],'census':{'returncode':0,'querySucceeded':True,'owned':[],'observedAtNs':45}},
      'readback':{'startedAtNs':60,'completedAtNs':70,'actualBefore':copy.deepcopy(rows),'actualAfter':copy.deepcopy(rows),'captured':copy.deepcopy(rows)},'censusAfterRead':{'returncode':0,'querySucceeded':True,'owned':[],'observedAtNs':80},
      'evidenceFresh':True,'sourceInputsBefore':copy.deepcopy(inputs),'sourceInputsAfter':copy.deepcopy(inputs),'result':result,'manifest':manifest,'pinsBeforeRead':{'stdout':'1'*64,'result':'2'*64,'manifest':'3'*64,'parser':'4'*64},'pinsAfterRead':{'stdout':'1'*64,'result':'2'*64,'manifest':'3'*64,'parser':'4'*64}}
    return obs,{'nodePath':identity['executablePath'],'expectedDataRoot':manifest['source'],'expectedCases':names,'expectedSourceInputs':inputs}

def change(path,value):
    def mutate(obs,ctx):
        target=obs
        for part in path[:-1]:target=target[part]
        target[path[-1]]=value
    return mutate

class Controls(unittest.TestCase):
    pass

def attach(name,mutate=None,expected=None,expected_files=1):
    def control(self):
        obs,ctx=fixture()
        if mutate:mutate(obs,ctx)
        row={'name':name,'expectedError':expected,'input':copy.deepcopy(obs),'context':copy.deepcopy(ctx)}
        if admit is None:row['actual']={'error':'CAPABILITY_MISSING'}
        else:
            try:row['actual']={'value':admit(obs,ctx)}
            except BaseException as error:row['actual']={'error':str(error),'type':type(error).__name__}
        ACTUAL.append(row)
        self.assertTrue(callable(admit),'Producer closure/readback admission capability is missing')
        if expected is None:
            self.assertNotIn('error',row['actual'])
            self.assertEqual(row['actual']['value']['status'],'PRODUCER_OBSERVATIONS_ACCEPTED_REQUIRES_INDEPENDENT_DATA')
            self.assertEqual(row['actual']['value']['files'],expected_files)
        else:self.assertEqual(row['actual'].get('error'),expected)
    setattr(Controls,'test_'+name,control)

attach('exact_empty_job_and_temporal_readback')
attach('full_precision_identity_preserved',lambda o,c:o['identityAfter'].update(creationFiletime=134367098977200493))
attach('source_case_failed',change(['result','status'],'ADVERSE'),'PRODUCER_RESULT_REQUIRED')
attach('wrong_case_count',lambda o,c:o['result']['cases'].pop(),'PRODUCER_CASES_REQUIRED')
attach('one_case_not_executed',change(['result','cases',2,'ok'],False),'PRODUCER_CASES_REQUIRED')
attach('source_inputs_drift',change(['sourceInputsAfter','tests/native/source-sync.mjs'],'c'*64),'SOURCE_INPUTS_CHANGED')
attach('result_source_drift',change(['result','afterInputs','tests/native/source-sync.mjs'],'c'*64),'SOURCE_INPUTS_CHANGED')
attach('unavailable_census',change(['closure','census','querySucceeded'],False),'SUCCESSFUL_EMPTY_CENSUS_REQUIRED')
attach('failed_census_exit',change(['closure','census','returncode'],1),'SUCCESSFUL_EMPTY_CENSUS_REQUIRED')
attach('remaining_scoped_process',change(['censusAfterRead','owned'],[{'ProcessId':98}]),'SUCCESSFUL_EMPTY_CENSUS_REQUIRED')
attach('forced_job_termination',change(['forcedCleanup'],{'terminated':True}),'NO_FORCED_CONTAINMENT_REQUIRED')
attach('wrong_assigned_child',change(['assignment','assignedActualHeldHandlePID'],42),'ACTUAL_HELD_PRODUCER_REQUIRED')
attach('changed_process_identity',change(['identityAfter','creationFiletime'],134367098977200494),'ACTUAL_HELD_PRODUCER_REQUIRED')
attach('rounded_process_identity',change(['identityAfter','creationFiletime'],float(134367098977200493)),'ACTUAL_HELD_PRODUCER_REQUIRED')
attach('producer_failed_exit',change(['childExitCode'],1),'PRODUCER_EXIT_ZERO_REQUIRED')
attach('membership_query_failed',change(['closure','beforePids','querySucceeded'],False),'COMPLETE_EMPTY_JOB_PIDS_REQUIRED')
attach('remaining_job_member',change(['closure','afterPids','pids'],[98]),'COMPLETE_EMPTY_JOB_PIDS_REQUIRED')
attach('raw_pid_header_disagrees',change(['closure','beforePids','rawHex'],(struct.pack('<II',1,1)+struct.pack('<Q',98)+bytes(4088)).hex()),'COMPLETE_EMPTY_JOB_PIDS_REQUIRED')
attach('raw_accounting_disagrees',change(['closure','rawAccounting','decoded','activeProcesses'],1),'RAW_JOB_ACCOUNTING_REQUIRED')
attach('accounting_changed_after_sample',change(['closure','afterAccounting','totalProcesses'],3),'RAW_JOB_ACCOUNTING_REQUIRED')
attach('readback_precedes_closure',change(['readback','startedAtNs'],49),'TEMPORAL_READBACK_REQUIRED')
attach('stale_evidence_handoff',change(['evidenceFresh'],False),'FRESH_EXPLICIT_HANDOFF_REQUIRED')
attach('capture_pin_drift',change(['pinsAfterRead','manifest'],'f'*64),'EVIDENCE_PIN_DRIFT')
attach('incomplete_capture',change(['manifest','captureComplete'],False),'COMPLETE_STABLE_CAPTURE_REQUIRED')
attach('live_capture',change(['manifest','phase'],'before-close-success'),'COMPLETE_STABLE_CAPTURE_REQUIRED')
attach('wrong_data_root',change(['manifest','source'],'C:\\unrelated\\Data'),'EXPECTED_DATA_ROOT_REQUIRED')
attach('actual_file_changed',change(['readback','actualAfter',2,'sha256'],'d'*64),'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
attach('actual_empty_directory_missing',lambda o,c:o['readback']['actualBefore'].pop(3),'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
attach('extra_capture_file',lambda o,c:o['readback']['captured'].append({'relativePath':'Projects/extra','kind':'file','bytes':0,'sha256':'e'*64}),'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
attach('selection_absence_mismatch',lambda o,c:o['readback']['actualAfter'].pop(),'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
attach('unsafe_relative_path',change(['readback','actualBefore',2,'relativePath'],'Projects/../escape'),'SAFE_DOMAIN_INVENTORY_REQUIRED')
attach('case_alias_duplicate',lambda o,c:o['readback']['actualBefore'].append({'relativePath':'projects','kind':'directory'}),'SAFE_DOMAIN_INVENTORY_REQUIRED')

def alter_domains(omitted=(),replacement=None):
    def mutate(obs,ctx):
        def update(rows):
            result=[]
            for row in rows:
                if row['relativePath'] in omitted:continue
                if replacement and row['relativePath']==replacement['relativePath']:row=copy.deepcopy(replacement)
                result.append(row)
            return result
        for key in ['before','after']:obs['manifest'][key]=update(obs['manifest'][key])
        for key in ['actualBefore','actualAfter','captured']:obs['readback'][key]=update(obs['readback'][key])
        rows=obs['manifest']['before']
        obs['manifest']['files']=[{k:v for k,v in row.items() if k!='kind'} for row in rows if row.get('kind')=='file']
        obs['manifest']['directories']=[row for row in rows if row.get('kind')=='directory']
        obs['manifest']['pointerStability']=[{**row,'unchanged':True} for row in rows if row['relativePath'].endswith('/current.json') or row['relativePath']=='session-selection.json']
        obs['result']['rawEvidence']['afterClose']=copy.deepcopy(obs['manifest'])
    return mutate

attach('omitted_recovery_in_all_observations',alter_domains(('Recovery',)),'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
attach('omitted_selection_in_all_observations',alter_domains(('session-selection.json',)),'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
attach('omitted_two_domains_in_all_observations',alter_domains(('Recovery','session-selection.json')),'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
attach('explicit_recovery_absence_preserved',alter_domains(replacement={'relativePath':'Recovery','absent':True}))
attach('present_selection_file_preserved',alter_domains(replacement={'relativePath':'session-selection.json','kind':'file','bytes':80,'sha256':'f'*64}),expected_files=2)

if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Pass a fresh evidence JSON path')
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Controls))
    with Path(sys.argv[1]).open('x',encoding='utf-8',newline='\n') as handle:json.dump({'syntheticOnly':True,'applicationExecuted':False,'cases':ACTUAL,'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors)},handle,indent=2);handle.write('\n')
    raise SystemExit(0 if result.wasSuccessful() else 1)
