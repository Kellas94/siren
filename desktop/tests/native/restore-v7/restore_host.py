"""One owned 240-second native actor; held job before GO, real live/exit barriers."""
from pathlib import Path
import sys,json,hashlib,subprocess,os,time,stat
R=Path(__file__).resolve().parent;OUT=R/'operation';DATA=OUT/'Data'
sys.path.insert(0,str(R/'helpers'))
from package_owned_job import OwnedJob
import package_process_census
from package_process_census import census
import portable_support
import job_members,baseline_rules
def need(ok,msg):
    if not ok:raise ValueError(msg)
def pin(p):
    p=Path(p)
    for q in (p,*p.parents):
        s=q.lstat();need(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&1024,'LINK_REFUSED')
    b=p.read_bytes();return {'path':str(p.resolve()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def read(p):return json.loads(Path(p).read_bytes())
def save(p,v):
    with Path(p).open('x',encoding='utf-8',newline='\n') as f:json.dump(v,f,indent=2,ensure_ascii=False);f.write('\n');f.flush();os.fsync(f.fileno())
def publish_protocol(path,value):
    path=Path(path);pending=path.with_name(path.name+'.pending-owned-host');save(pending,value);need(not path.exists(),'PROTOCOL_TARGET_ALREADY_EXISTS');os.replace(pending,path)
def tree(root):
    root=Path(root);files=[];dirs=[]
    for p in root.rglob('*'):
        if root==R/'package' and p.relative_to(root).parts[0]=='Data':continue
        s=p.lstat();need(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&1024,'TREE_LINK')
        if p.is_dir():dirs.append(p.relative_to(root).as_posix())
        else:need(p.is_file(),'TREE_TYPE');files.append(p.relative_to(root).as_posix())
    digest=lambda rows:hashlib.sha256('\n'.join(sorted(rows)).encode()).hexdigest()
    return {'root':str(root.resolve()),'files':len(files),'directories':len(dirs),'filePathsetSha256':digest(files),'directoryPathsetSha256':digest(dirs)}
def err(e):return {'type':type(e).__name__,'message':str(e)[:3000]}
def final_raw():
    need(DATA.is_dir(),'NO_NATIVE_DATA_AVAILABLE');target=OUT/'host-final-raw';target.mkdir();files=[];directories=[];total=0
    for part in ['Projects','Recovery']:
        original=DATA/part;need(original.is_dir(),'RAW_DOMAIN_MISSING');(target/part).mkdir();directories.append(part)
        for p in sorted(original.rglob('*')):
            relative=p.relative_to(DATA);s=p.lstat();need(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&1024,'RAW_LINK')
            if p.is_dir():(target/relative).mkdir();directories.append(relative.as_posix())
            else:
                need(p.is_file() and s.st_size<=64*1024**2 and len(files)<5000,'RAW_BUDGET');total+=s.st_size;need(total<512*1024**2,'RAW_TOTAL_BUDGET');before=pin(p)
                with (target/relative).open('xb') as f:f.write(p.read_bytes())
                copied=pin(target/relative);need(before==pin(p) and copied['bytes']==before['bytes'] and copied['sha256']==before['sha256'],'RAW_COPY_DRIFT');files.append({'relativePath':relative.as_posix(),'input':before,'copy':copied})
    selection=DATA/'session-selection.json'
    if selection.exists():
        before=pin(selection)
        with (target/'session-selection.json').open('xb') as f:f.write(selection.read_bytes())
        copied=pin(target/'session-selection.json');need(before==pin(selection) and copied['sha256']==before['sha256'],'SELECTION_COPY_DRIFT');files.append({'relativePath':'session-selection.json','input':before,'copy':copied})
    receipt={'root':str(target),'files':files,'directories':directories,'scope':'After final owned-job zero and successful empty scoped CIM observation'};save(OUT/'host-final-raw.json',receipt);return {'files':len(files),'directories':len(directories),'receipt':pin(OUT/'host-final-raw.json')}
def main():
    need(sys.argv[1:]==['--execute-automated-once'],'EXPLICIT_EXECUTION_REQUIRED');need(sys.flags.isolated and sys.flags.no_site and sys.flags.dont_write_bytecode and sys.flags.utf8_mode==1 and not sys.flags.optimize,'PINNED_FLAGS_REQUIRED')
    outer=portable_support.await_outer_go()
    sourcePin=pin(R/'SOURCE-PINS.json');source=read(sourcePin['path'])
    portable_support.validate_stage(source,R,__file__,sys.executable,'restore')
    global DATA
    packaged=source['mode']=='package'
    DATA=R/'package/Data' if packaged else OUT/'Data'
    job_members.POWERSHELL=source['powershell']['path']
    need(pin(sys.executable)==source['python'] and pin(__file__) in source['files'],'SELF_RUNTIME_REQUIRED')
    need(not OUT.exists() and not (R/'host-attempt.json').exists() and not DATA.exists(),'ONE_EXECUTION_ONLY')
    need(source['harnessConsole'] in source['files'],'FROZEN_CONSOLE_BINARY_REQUIRED')
    if packaged:
        need(source['electron']==source['physicalPackage']['executable'] and source['physicalPackage']['archive'] in source['files'],'FROZEN_PHYSICAL_PACKAGE_REQUIRED')
        need(Path(source['physicalPackage']['dataRoot'])==DATA and DATA==(Path(source['electron']['path']).parent/'../../..'/'Data').resolve(),'REAL_PACKAGED_DATA_LAYOUT_REQUIRED')
    started=time.monotonic();job=child=None;handled=set();result={'status':'ADVERSE','primaryError':None,'finalErrors':[],'barriers':[],'barrierObservations':[],'scope':'Automated development or physical-package Restore; independent external DATA review required; no installed/release qualification'}
    baseline=None;result['baselineObservations']=[];result['memberObservations']=[];result['closedMembershipReceipts']=[];job_members.OUT=OUT;job_members.ACTOR_DEADLINE=started+210
    package_process_census.configure(source['powershell']['path'],R/'census',started+240)
    before=[sourcePin,*source['files']]
    try:
        for row in before:need(pin(row['path'])==row,'BEFORE_PIN_DRIFT')
        for row in source['inputTrees']:need(tree(row['root'])==row,'BEFORE_TREE_DRIFT')
        result['censusBefore']=census(R/'process-scope.json');need(result['censusBefore']['owned']==[],'OWNED_DATA_ALREADY_RUNNING')
        save(R/'host-attempt.json',{'source':sourcePin,'outerHostGo':outer,'reviewMode':portable_support.REVIEW_MODE,'once':True,'startedAt':time.time(),'budgetSeconds':240,'actorCutoffSeconds':210,'reservedFinalizationSeconds':30});OUT.mkdir()
        job=OwnedJob();env=dict(os.environ)
        for key in list(env):
            if key.upper() in ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME','PYTHONPYCACHEPREFIX']:env.pop(key)
        env['TEMP']=str(OUT/'Temp');env['TMP']=env['TEMP'];Path(env['TEMP']).mkdir()
        command=[source['node']['path'],str(R/'actor.mjs')];result['command']=command
        with (OUT/'stdout.bin').open('xb') as stdout,(OUT/'stderr.bin').open('xb') as stderr:
            child=subprocess.Popen(command,cwd=R,env=env,stdin=subprocess.PIPE,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW)
            result['assignment']=job.assign(child);need(time.monotonic()-started<240,'BUDGET_BEFORE_GO')
            go={'pid':child.pid,'assignment':result['assignment'],'electron':source['electron']['path'],'sourcePinsSha256':sourcePin['sha256']};save(OUT/'held-job-go.json',go);child.stdin.write((json.dumps(go)+'\n').encode());child.stdin.flush();child.stdin.close()
            while child.poll() is None:
                need(time.monotonic()-started<210,'ACTOR_CUTOFF_RESERVES_FINALIZATION_WITHIN_240')
                baselinePath=OUT/'barrier-0-baseline-request.json'
                if baseline is None and baselinePath.exists():
                    request=read(baselinePath);need(request['number']==0 and request['stage']=='baseline' and request['pid']==child.pid and request['launchCount']==0,'ACTUAL_PRE_ELECTRON_BASELINE_REQUEST_REQUIRED')
                    observed=job_members.snapshot(job,'harness-baseline',child.pid,result['baselineObservations']);result['baselineCensus']=census(R/'process-scope.json');need(result['baselineCensus']['owned']==[],'NO_APP_BEFORE_BASELINE_REQUIRED')
                    baseline=baseline_rules.admit_baseline(observed,child.pid,source['node'],source['harnessConsole']);result['harnessBaseline']=baseline
                    publish_protocol(OUT/'barrier-0-baseline-ack.json',{**request,'accepted':True,'baselinePids':sorted(row['pid'] for row in baseline['members']),'baselineObservation':pin(OUT/'harness-baseline-snapshot.json'),'acknowledgedAt':time.time()})
                for number in [1,2]:
                    for stage in ['live','closed']:
                        name=f'barrier-{number}-{stage}';request=OUT/(name+'-request.json')
                        if name in handled or not request.exists():continue
                        req=read(request);need(req['number']==number and req['stage']==stage and isinstance(req['pid'],int),'BARRIER_REQUEST')
                        accounting=job.accounting();sample={**req,'accounting':accounting,'census':None,'observedAt':time.time(),'validationPending':True}
                        try:sample['census']=census(R/'process-scope.json')
                        except BaseException as e:
                            sample['censusError']=err(e);result['barrierObservations'].append(sample)
                            try:save(OUT/(name+'-observed-before-validation.json'),sample)
                            except BaseException as secondary:result['finalErrors'].append({'stage':'barrier-observation-retention',**err(secondary)})
                            raise
                        result['barrierObservations'].append(sample);save(OUT/(name+'-observed-before-validation.json'),sample);observed=sample['census'];owned=observed['owned']
                        need(baseline is not None,'PRE_ELECTRON_BASELINE_MUST_PRECEDE_APP_BARRIER')
                        if stage=='live':
                            matches=[r for r in owned if r['ProcessId']==req['pid']];need(len(matches)==1 and matches[0]['ExecutablePath'].lower()==source['electron']['path'].replace('/','\\').lower() and accounting['activeProcesses']>1,'LIVE_PROCESS_IDENTITY_REQUIRED')
                        else:
                            members=job_members.snapshot(job,f'closed-{number}-members',child.pid,result['memberObservations']);membership=baseline_rules.require_closed(members,baseline,req['pid']);result['closedMembershipReceipts'].append({'number':number,**membership});need(owned==[],'FAMILY_ZERO_BEFORE_RESTART_REQUIRED')
                        ack={**req,'accepted':True,'accounting':accounting,'census':observed,'acknowledgedAt':time.time()};publish_protocol(OUT/(name+'-ack.json'),ack);result['barriers'].append(ack);handled.add(name)
                time.sleep(.1)
            result['actorExitCode']=child.wait(timeout=1)
        actor=read(OUT/'actor-result.json');result['actorStatus']=actor['status'];result['actorPrimaryError']=actor.get('primaryError');result['actorFinalErrors']=actor.get('finalErrors')
        if actor.get('primaryError') is not None:result['primaryError']={'origin':'actor',**actor['primaryError']}
        need(result['actorExitCode']==0 and actor['status']=='NATIVE_RESTORE_V7_QUIT_RESTART_COMPLETE_REQUIRES_INDEPENDENT_DATA','ACTOR_EXPECTED_COMPLETION_REQUIRED');need(len(handled)==4 and baseline is not None and len(result['closedMembershipReceipts'])==2,'BASELINE_AND_FOUR_PROCESS_BARRIERS_REQUIRED')
        result['status']='NATIVE_RESTORE_V7_HOST_COMPLETE_REQUIRES_INDEPENDENT_DATA'
    except BaseException as e:
        if result['primaryError'] is None:result['primaryError']=getattr(e,'observedPrimary',err(e));result['finalErrors'].extend(getattr(e,'observedSecondary',[]))
        else:result['finalErrors'].append({'stage':'host-after-actor-primary',**err(e)})
    finally:
        for stage,action in [
            ('owned-cleanup',lambda:job.terminate_owned() if job and job.accounting()['activeProcesses'] else None),
            ('child-exit',lambda:child.wait(timeout=15) if child else None),
            ('final-job',lambda:job.accounting() if job else None),
            ('job-close',lambda:job.close() if job else None),
            ('final-census',lambda:census(R/'process-scope.json'))]:
            try:result[stage]=action()
            except BaseException as e:result['finalErrors'].append({'stage':stage,**err(e)})
        if result.get('owned-cleanup'):result['finalErrors'].append({'stage':'cleanup','type':'AdverseContainmentCleanup','message':'Job termination is not normal Quit'})
        for row in before:
            try:need(pin(row['path'])==row,'FINAL_PIN_DRIFT')
            except BaseException as e:result['finalErrors'].append({'stage':'pin','path':row['path'],**err(e)})
        for row in source['inputTrees']:
            try:need(tree(row['root'])==row,'FINAL_TREE_DRIFT')
            except BaseException as e:result['finalErrors'].append({'stage':'tree','root':row['root'],**err(e)})
        if (result.get('final-job') or {}).get('activeProcesses')!=0 or (result.get('final-census') or {}).get('owned')!=[]:result['finalErrors'].append({'stage':'closure','type':'QuiescenceUnproven','message':'Final job and scoped census required'})
        else:
            try:result['finalRaw']=final_raw()
            except BaseException as e:result['finalErrors'].append({'stage':'final-raw',**err(e)})
        result['sourcePinsUnchanged']=not any(x['stage'] in ['pin','tree'] for x in result['finalErrors']);result['elapsedSeconds']=time.monotonic()-started
        if result['elapsedSeconds']>240:result['finalErrors'].append({'stage':'overall-wall-budget','type':'OverallDeadlineExceeded','message':'All preflight, actor and finalization must complete within240seconds'})
        if result['finalErrors']:result['status']='ADVERSE'
        try:save(R/'host-result.json',result)
        except BaseException as e:result['finalErrors'].append({'stage':'result-retention',**err(e)});result['status']='ADVERSE';result['fallbackDiagnosticOnly']=True
        result['elapsedThroughResultSeconds']=time.monotonic()-started
        if result['elapsedThroughResultSeconds']>240:
            result['finalErrors'].append({'stage':'overall-through-result-budget','type':'OverallDeadlineExceeded','message':'Durable result retention also exceeded240seconds'});result['status']='ADVERSE';result['fallbackDiagnosticOnly']=True
    print(json.dumps({k:result.get(k) for k in ['status','primaryError','finalErrors','actorExitCode','actorStatus','sourcePinsUnchanged','elapsedSeconds','elapsedThroughResultSeconds','fallbackDiagnosticOnly']}));return 0 if result['status']=='NATIVE_RESTORE_V7_HOST_COMPLETE_REQUIRES_INDEPENDENT_DATA' else 1
if __name__=='__main__':raise SystemExit(main())
