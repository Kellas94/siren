"""One owned packaged SourceSync producer, family zero, then actual Data readback."""
from pathlib import Path
import base64,hashlib,json,os,subprocess,sys,time
R=Path(__file__).resolve().parent;OUT=R/'operation';APP=R/'app'
sys.path.insert(0,str(R/'helpers'))
from package_owned_job import OwnedJob
import producer_admission as rules
import producer_inputs as input_rules
import producer_collector as collect
from producer_collector import need,pin,save
import portable_support

def read(path):return json.loads(Path(path).read_bytes())
def error(value):return {'type':type(value).__name__,'message':str(value)[:3000]}
def tree(root):
    files=[];dirs=[]
    for p in Path(root).rglob('*'):
        if Path(root)==APP and p.relative_to(APP).parts[0]=='evidence':continue
        collect.no_links(p);relative=p.relative_to(root).as_posix()
        (dirs if p.is_dir() else files).append(relative)
    digest=lambda rows:hashlib.sha256('\n'.join(sorted(rows)).encode()).hexdigest()
    return {'root':str(Path(root).resolve()),'files':len(files),'directories':len(dirs),'filePathsetSha256':digest(files),'directoryPathsetSha256':digest(dirs)}

def main():
    need(sys.argv[1:]==['--execute-automated-once'] and sys.flags.isolated and sys.flags.no_site and sys.flags.dont_write_bytecode and sys.flags.utf8_mode==1 and not sys.flags.optimize,'EXPLICIT_FIXED_FLAGS_REQUIRED')
    outer=portable_support.await_outer_go()
    source_pin=pin(R/'SOURCE-PINS.json');source=read(source_pin['path'])
    portable_support.validate_stage(source,R,__file__,sys.executable,'producer')
    collect.POWERSHELL=source['powershell']['path']
    need(pin(sys.executable)==source['python'] and not OUT.exists() and not (R/'host-attempt.json').exists() and not (APP/'evidence').exists(),'PINNED_RUNTIME_AND_FRESH_OWNED_OUTPUT_REQUIRED')
    plan=input_rules.plan_producer(source['producerInputConfig']);need(plan['mode'] in ['development','package'] and plan['cwd']==str(APP) and plan['runtimes']['node']==source['node'] and plan['runtimes']['python']==source['python'] and plan['runtimes']['powershell']==source['powershell'],'EXACT_PACKAGE_INPUT_PLAN_REQUIRED')
    started=time.monotonic();deadline=started+240;cutoff=started+210
    result={'status':'ADVERSE','primaryError':None,'finalErrors':[],'jobs':[],'scope':'One automated SourceSync producer and post-quiescence admission; external independent DATA review required; no graceful producer Quit, physical focus or release admission'}
    result['eventClock']={'name':'perf_counter_ns','info':vars(time.get_clock_info('perf_counter')),'strictOrderRequired':True,'fabricatedIncrements':False}
    jobs=[];children=[];o={'errors':[],'forcedCleanup':None};before=[source_pin,*source['files']]
    def remaining(limit):
        value=min(limit,deadline-time.monotonic());need(value>0,'WHOLE_OPERATION_BUDGET_EXHAUSTED');return value
    def inputs():return {name:pin(APP/name)['sha256'] for name in source['sourceInputs']}
    def run_node(name,script,cwd,payload,timeout):
        job=OwnedJob();jobs.append((name,job));record={'name':name};result['jobs'].append(record)
        with (OUT/(name+'-stdout.bin')).open('xb') as stdout,(OUT/(name+'-stderr.bin')).open('xb') as stderr:
            child=subprocess.Popen([source['node']['path'],str(script)],cwd=cwd,env=environment,stdin=subprocess.PIPE,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW);children.append((name,child));record['pid']=child.pid
            record['assignment']=job.assign(child);record['assignedAtNs']=time.perf_counter_ns();record['identityBefore']=collect.held_identity(job,child)
            record['goAtNs']=time.perf_counter_ns();go={'pid':child.pid,'assignment':record['assignment'],**payload};save(OUT/(name+'-go.json'),go);child.stdin.write((json.dumps(go)+'\n').encode());child.stdin.flush();child.stdin.close()
            record['exitCode']=child.wait(timeout=timeout);record['exitObservedAtNs']=time.perf_counter_ns();record['identityAfter']=collect.held_identity_after_exit(job,child,record['identityBefore'])
        record['waitEmpty']=job.wait_empty(remaining(5));record['accountingAfterWait']=job.accounting();save(OUT/(name+'-exit-observed.json'),record)
        return child,job,record
    try:
        for row in before:need(pin(row['path'])==row,'BEFORE_PIN_DRIFT')
        for row in source['inputTrees']:need(tree(row['root'])==row,'BEFORE_TREE_DRIFT')
        if plan['mode']=='package':need(input_rules.typed_equal(read(Path(source['producerInputConfig']['package']['root'])/'BUILD-IDENTITY.json'),source['producerInputConfig']['package']['receipt']),'PHYSICAL_BUILD_RECEIPT_BINDING_REQUIRED')
        OUT.mkdir();save(R/'host-attempt.json',{'source':source_pin,'outerHostGo':outer,'once':True,'budgetSeconds':240,'actorCutoffSeconds':210,'finalizationReserveSeconds':30})
        environment=dict(os.environ)
        for key in list(environment):
            if key.upper() in ['NODE_OPTIONS','NODE_PATH','ELECTRON_RUN_AS_NODE','PYTHONHOME','PYTHONPATH','PYTHONPYCACHEPREFIX']:environment.pop(key)
        environment['TEMP']=str(OUT/'Temp');environment['TMP']=environment['TEMP'];Path(environment['TEMP']).mkdir()
        initial=collect.census(R/'process-scope.json',OUT,'initial-census',remaining(10));rules.empty_census(initial)
        o['sourceInputsBefore']=inputs();need(o['sourceInputsBefore']==source['sourceInputs'],'SOURCE_INPUT_ADMISSION_REQUIRED')
        evidence_before={'parent':str(APP/'evidence/source-sync'),'parentAbsent':not (APP/'evidence/source-sync').exists(),'names':[]};need(evidence_before['parentAbsent'],'FRESH_EVIDENCE_PARENT_REQUIRED');save(OUT/'evidence-parent-before.json',evidence_before)
        child,producer,record=run_node('producer',R/'bootstrap.mjs',APP,{'producerArguments':plan['producerArguments']},max(.001,cutoff-time.monotonic()))
        o.update({'producerPid':child.pid,'assignment':record['assignment'],'identityBefore':record['identityBefore'],'identityAfter':record['identityAfter'],'assignedAtNs':record['assignedAtNs'],'goAtNs':record['goAtNs'],'exitObservedAtNs':record['exitObservedAtNs'],'childExitCode':record['exitCode']})
        if record['exitCode']!=0:result['primaryError']={'origin':'SourceSync-producer','type':'ProducerExitFailure','exitCode':record['exitCode'],'message':'Original producer failure retained in raw stdout/stderr and its owned evidence; no successful handoff inferred.'}
        o['closure']=collect.empty_observation(producer,R/'process-scope.json',OUT,remaining(10))
        # Validate natural complete family zero before touching actual Data.
        need(o['closure']['errors']==[],'CLOSURE_OBSERVATION_ERRORS');rules.empty_pids(o['closure']['beforePids']);rules.empty_pids(o['closure']['afterPids']);rules.empty_accounting(o['closure']);rules.empty_census(o['closure']['census'])
        need(record['exitCode']==0,'PRODUCER_EXIT_ZERO_REQUIRED')
        need(time.monotonic()<cutoff,'PRODUCER_ACTOR_CUTOFF_EXCEEDED')
        stdout=(OUT/'producer-stdout.bin').read_bytes();need(len(stdout)<=1024*1024,'PRODUCER_STDOUT_BUDGET')
        save(OUT/'summary-input.json',{'stdoutBase64':base64.b64encode(stdout).decode(),'context':{'expectedEvidenceParent':str(APP/'evidence/source-sync'),'expectedCases':len(source['caseNames'])}})
        _,summary_job,summary_record=run_node('summary',R/'summary-cli.mjs',R,{},remaining(10));need(summary_record['exitCode']==0 and summary_job.accounting()['activeProcesses']==0,'SUMMARY_PARSER_COMPLETION_REQUIRED')
        parsed=read(OUT/'summary-result.json');need(parsed['status']=='SUMMARY_COMPLETE_REQUIRES_DATA_READBACK' and parsed['primaryError'] is None and parsed['finalErrors']==[],'SUMMARY_PARSER_COMPLETION_REQUIRED')
        summary=parsed['value'];evidence=Path(summary['evidence']);collect.no_links(evidence);need(evidence.parent==APP/'evidence/source-sync','EXACT_PHYSICAL_EVIDENCE_PARENT_REQUIRED');o['evidenceFresh']=evidence_before['parentAbsent'] and evidence.name not in evidence_before['names']
        result_path=Path(summary['resultPath']);manifest_path=Path(summary['capturePath']);capture_root=manifest_path.parent/'files'
        for path in [result_path,manifest_path,capture_root]:collect.no_links(path)
        producer_result=read(result_path);bound=input_rules.bind_producer_output(plan,str(evidence),producer_result);data=Path(bound['dataRoot']);save(OUT/'producer-input-binding.json',{'plan':plan,'output':bound})
        for path in [result_path,manifest_path,capture_root,data]:collect.no_links(path)
        o['result']=read(result_path);o['manifest']=read(manifest_path)
        observed_pins=lambda:{'stdout':pin(OUT/'producer-stdout.bin')['sha256'],'result':pin(result_path)['sha256'],'manifest':pin(manifest_path)['sha256'],'parser':pin(R/'producer-summary.mjs')['sha256']}
        o['pinsBeforeRead']=observed_pins();o['sourceInputsAfter']=inputs();o['readback']={'startedAtNs':time.perf_counter_ns()}
        o['readback']['actualBefore']=collect.domain_inventory(data);o['readback']['captured']=collect.domain_inventory(capture_root,capture_root=True);o['readback']['actualAfter']=collect.domain_inventory(data);o['readback']['completedAtNs']=time.perf_counter_ns()
        o['censusAfterRead']=collect.census(R/'process-scope.json',OUT,'after-read-census',remaining(10));o['pinsAfterRead']=observed_pins()
        save(OUT/'observations-before-admission.json',o)
        result['admission']=rules.admit(o,{'nodePath':source['node']['path'],'expectedDataRoot':str(data),'expectedCases':source['caseNames'],'expectedSourceInputs':source['sourceInputs']})
        result['producerEvidence']={'root':str(evidence),'result':pin(result_path),'manifest':pin(manifest_path),'summary':pin(OUT/'summary-result.json'),'dataRoot':str(data)}
        result['status']='OWNED_PRODUCER_COMPLETE_REQUIRES_INDEPENDENT_DATA'
    except BaseException as failure:
        if result['primaryError'] is None:result['primaryError']=error(failure)
        else:result['finalErrors'].append({'stage':'secondary-after-primary',**error(failure)})
    finally:
        for name,job in jobs:
            try:
                if job.accounting()['activeProcesses']:
                    result['finalErrors'].append({'stage':'owned-containment','job':name,'cleanup':job.terminate_owned(),'type':'AdverseContainmentCleanup'})
                result[name+'-finalJob']=job.accounting()
            except BaseException as failure:result['finalErrors'].append({'stage':'job-finalization','job':name,**error(failure)})
            finally:
                try:job.close()
                except BaseException as failure:result['finalErrors'].append({'stage':'job-close','job':name,**error(failure)})
        for name,child in children:
            try:result[name+'-finalChildExit']=child.wait(timeout=5)
            except BaseException as failure:result['finalErrors'].append({'stage':'child-finalization','child':name,**error(failure)})
        if OUT.exists():
            try:save(OUT/'host-observations-final.json',o)
            except BaseException as failure:result['finalErrors'].append({'stage':'observations-retention',**error(failure)})
            try:result['finalCensus']=collect.census(R/'process-scope.json',OUT,'final-census',remaining(10));rules.empty_census(result['finalCensus'])
            except BaseException as failure:result['finalErrors'].append({'stage':'final-census',**error(failure)})
        for row in before:
            try:need(pin(row['path'])==row,'FINAL_PIN_DRIFT')
            except BaseException as failure:result['finalErrors'].append({'stage':'pin','path':row['path'],**error(failure)})
        for row in source['inputTrees']:
            try:need(tree(row['root'])==row,'FINAL_TREE_DRIFT')
            except BaseException as failure:result['finalErrors'].append({'stage':'tree','root':row['root'],**error(failure)})
        result['elapsedSeconds']=time.monotonic()-started
        if result['elapsedSeconds']>240:result['finalErrors'].append({'stage':'budget','type':'WholeOperationDeadlineExceeded'})
        if result['finalErrors']:result['status']='ADVERSE'
        try:save(R/'host-result.json',result)
        except BaseException as failure:result['status']='ADVERSE';result['finalErrors'].append({'stage':'result-retention',**error(failure)});result['fallbackDiagnosticOnly']=True
        result['elapsedThroughResultSeconds']=time.monotonic()-started
        if result['elapsedThroughResultSeconds']>240:result['status']='ADVERSE';result['finalErrors'].append({'stage':'through-result-budget'});result['fallbackDiagnosticOnly']=True
    print(json.dumps(result));return 0 if result['status']=='OWNED_PRODUCER_COMPLETE_REQUIRES_INDEPENDENT_DATA' else 1
if __name__=='__main__':raise SystemExit(main())
