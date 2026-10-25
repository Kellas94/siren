"""Windows QA pipeline: one original producer, physical admission, synthetic R3 Restore.

Each stage is an automated observation. A successful exit still requires separate
independent review of the retained raw DATA; no peer receipts are generated here.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,runpy,shutil,struct,subprocess,sys,time
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from portable_support import REVIEW_MODE,need,safe,pin,read,save,snapshot,copy_app,python_runtime_snapshot
from package_owned_job import OwnedJob
import producer_collector as collect
from producer_inputs import plan_producer,absolute_path
from route_derivation import derive_route

FLAGS=['-B','-I','-S','-X','utf8']
PURE=['producer_admission.py','producer_inputs.py','route_derivation.py']
HELPERS=['portable_support.py','package_owned_job.py','baseline_rules.py','job_members.py',
         'producer_collector.py','package_process_census.py',*PURE]

class StageFailure(Exception):
    def __init__(self,primary,secondary=None):
        self.observedPrimary=primary;self.observedSecondary=list(secondary or []);super().__init__(primary.get('message','Owned stage failure'))

def put(path,data):
    safe(path.parent)
    with path.open('xb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())

def retain_receipt(path,receipt,fallback):
    try:save(path,receipt)
    except BaseException as failure:
        error={'stage':'result-retention','type':type(failure).__name__,'message':str(failure)[:3000]}
        if receipt.get('primaryError') is None:receipt['primaryError']=error
        else:receipt['finalErrors'].append(error)
        receipt['fallbackDiagnosticOnly']=True
        if 'status' in receipt:receipt['status']='ADVERSE'
        try:put(fallback,(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
        except BaseException as secondary:receipt['finalErrors'].append({'stage':'fallback-retention','type':type(secondary).__name__,'message':str(secondary)[:3000]})
        try:sys.stderr.write(json.dumps(receipt,ensure_ascii=False)+'\n');sys.stderr.flush()
        except BaseException as secondary:receipt['finalErrors'].append({'stage':'fallback-stderr','type':type(secondary).__name__,'message':str(secondary)[:3000]})

def copy_file(source,target):
    before=pin(source)
    with Path(source).open('rb') as src,target.open('xb') as dst:shutil.copyfileobj(src,dst,1024*1024)
    after=pin(target);need(before==pin(source) and before['sha256']==after['sha256'] and before['bytes']==after['bytes'],'STAGED_FILE_DRIFT')

def tree_shape(root,*,exclude=()):
    observed=snapshot(root,exclude=exclude)
    digest=lambda rows:hashlib.sha256('\n'.join(sorted(rows)).encode()).hexdigest()
    return {'root':str(Path(root).resolve()),'files':len(observed['files']),'directories':len(observed['directories']),
            'filePathsetSha256':digest(row['relativePath'] for row in observed['files']),
            'directoryPathsetSha256':digest(observed['directories'])}

def fixed_flags():
    need(os.name=='nt' and struct.calcsize('P')==8 and sys.version_info[:3]==(3,12,10),'WINDOWS_X64_PYTHON_3_12_10_REQUIRED')
    need(sys.flags.isolated and sys.flags.no_site and sys.flags.dont_write_bytecode and sys.flags.utf8_mode==1 and not sys.flags.optimize,'FIXED_ISOLATED_FLAGS_REQUIRED')

def clean_environment(temp):
    env=dict(os.environ)
    for key in list(env):
        if key.upper() in {'NODE_OPTIONS','NODE_PATH','ELECTRON_RUN_AS_NODE','PYTHONPATH','PYTHONHOME','PYTHONPYCACHEPREFIX'}:env.pop(key)
    temp.mkdir();env['TEMP']=str(temp);env['TMP']=str(temp);return env

def runtime_inputs(args,out,environment):
    paths={'node':args.node,'python':sys.executable,'powershell':args.powershell}
    for value in [*paths.values(),args.conhost,str(args.app),str(args.output)]:absolute_path(str(value))
    runtimes={name:pin(value) for name,value in paths.items()}
    node_version=subprocess.run([args.node,'--version'],capture_output=True,timeout=10,env=environment,creationflags=subprocess.CREATE_NO_WINDOW)
    put(out/'node-version-stdout.bin',node_version.stdout);put(out/'node-version-stderr.bin',node_version.stderr)
    need(node_version.returncode==0 and node_version.stdout.strip()==b'v24.16.0','PINNED_NODE_24_16_0_REQUIRED')
    electron=args.app/'node_modules/electron/dist/electron.exe'
    need(read(args.app/'node_modules/electron/package.json')['version']=='44.9.3','PINNED_ELECTRON_44_9_3_REQUIRED')
    python_root=Path(sys.base_prefix);safe(python_root)
    need(Path(sys.prefix)==python_root,'VIRTUAL_ENVIRONMENT_REFUSED')
    # No-site isolated sys.path can name an absent python312.zip; retain that absence.
    path_rows=[]
    for value in sys.path:
        path=Path(value)
        if path==HERE:continue
        need(path.is_absolute() and path.is_relative_to(python_root),'UNBOUNDED_PYTHON_IMPORT_PATH')
        path_rows.append({'path':str(path),'absent':not path.exists()})
    closure=python_runtime_snapshot(python_root,sys.executable)
    save(out/'runtime-inputs.json',{'reviewMode':REVIEW_MODE,'runtimes':runtimes,'pythonVersion':sys.version,
         'pythonPrefix':str(python_root),'pythonSearchPath':path_rows,'pythonClosure':closure,
         'electron':pin(electron),'electronClosure':snapshot(electron.parent),'conhost':pin(args.conhost),
         'limitations':'Windows system DLLs and PowerShell framework remain OS inputs; only selected PowerShell and console executable bytes are pinned.'})
    rows=[{k:row[k] for k in ['path','bytes','sha256']} for row in closure['files']]
    rows.extend([*runtimes.values(),pin(args.conhost)])
    return runtimes,rows

def stage_inputs(stage,kind,args,runtimes,external):
    source={'schema':1,'reviewMode':REVIEW_MODE,'stage':kind,'head':args.source_commit,
            'python':runtimes['python'],'node':runtimes['node'],'powershell':runtimes['powershell'],
            'harnessConsole':pin(args.conhost)}
    own=snapshot(stage)
    rows=[{k:row[k] for k in ['path','bytes','sha256']} for row in own['files']]
    by_path={row['path']:row for row in [*external,*rows]};source['files']=list(by_path.values())
    source['inputTrees']=[tree_shape(stage/'app',exclude=['evidence'] if kind=='producer' else []),tree_shape(stage/'helpers')]
    return source

def stage_base(root,app):
    root.mkdir();save(root/'app-copy-provenance.json',copy_app(app,root/'app'))
    (root/'helpers').mkdir()
    for name in HELPERS:copy_file(HERE/name,root/'helpers'/name)

def launch_host(stage,out,environment):
    # The outer job bounds the Python host as well as its nested actor job.
    job=OwnedJob();child=None;assigned=False;receipt={'reviewMode':REVIEW_MODE,'primaryError':None,'finalErrors':[]}
    started=time.monotonic()
    try:
        with (out/(stage.name+'-host-stdout.bin')).open('xb') as stdout,(out/(stage.name+'-host-stderr.bin')).open('xb') as stderr:
            child=subprocess.Popen([sys.executable,*FLAGS,str(stage/'host.py'),'--execute-automated-once'],cwd=stage,
                 env=environment,stdin=subprocess.PIPE,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW)
            receipt['assignment']=job.assign(child);assigned=True
            receipt['identityBefore']=collect.held_identity(job,child)
            go={'pid':child.pid,'assignment':receipt['assignment']};save(out/(stage.name+'-outer-go.json'),go)
            child.stdin.write((json.dumps(go)+'\n').encode());child.stdin.flush();child.stdin.close()
            receipt['exitCode']=child.wait(timeout=270)
            receipt['identityAfter']=collect.held_identity_after_exit(job,child,receipt['identityBefore'])
        if receipt['exitCode']!=0:
            value=read(stage/'host-result.json') if (stage/'host-result.json').exists() else {}
            raise StageFailure(value.get('primaryError') or {'type':'HostExitFailure','exitCode':receipt['exitCode'],'message':'Host failure; raw streams retained'},value.get('finalErrors',[]))
        need(job.wait_empty(5)['closed'],'OUTER_HOST_FAMILY_NOT_EMPTY')
        receipt['result']=pin(stage/'host-result.json')
    except BaseException as failure:
        receipt['primaryError']=getattr(failure,'observedPrimary',{'type':type(failure).__name__,'message':str(failure)[:3000]})
        receipt['finalErrors'].extend(getattr(failure,'observedSecondary',[]))
    finally:
        def unassigned_cleanup():
            if child is not None and not assigned and child.poll() is None:
                # Popen.terminate uses the original retained process handle, never PID reopening.
                child.terminate();return {'ownedOriginalPopenHandleTerminated':True,'exitCode':child.wait(timeout=10)}
        for name,action in [('unassignedCleanup',unassigned_cleanup),
                            ('cleanup',lambda:job.terminate_owned() if assigned and job.accounting()['activeProcesses'] else None),
                            ('childExit',lambda:child.wait(timeout=10) if child else None),('finalJob',job.accounting),('close',job.close)]:
            try:receipt[name]=action()
            except BaseException as failure:receipt['finalErrors'].append({'stage':name,'type':type(failure).__name__,'message':str(failure)})
        receipt['elapsedSeconds']=time.monotonic()-started
        retain_receipt(stage/'outer-host-result.json',receipt,out/(stage.name+'-outer-host-fallback.json'))
    if receipt['primaryError'] is not None:raise StageFailure(receipt['primaryError'],receipt['finalErrors'])
    need(receipt['finalErrors']==[] and receipt.get('cleanup') is None and receipt.get('finalJob',{}).get('activeProcesses')==0,'OWNED_HOST_COMPLETION_REQUIRED')
    return read(stage/'host-result.json')

def physical_package(root):
    root=safe(root);data=root/'Data'
    if data.exists():need(safe(data).is_dir() and list(data.iterdir())==[],'FRESH_PACKAGE_DATA_REQUIRED')
    receipt=read(root/'BUILD-IDENTITY.json')
    plan=plan_producer({'schema':1,'mode':'package','appRoot':str(root),
         'runtimes':{key:pin(sys.executable) for key in ['node','python','powershell']},'package':{'root':str(root),'receipt':receipt}})
    need({key:pin(plan['archivePath'])[key] for key in ['bytes','sha256']}==receipt['appArchive'],'PACKAGE_ARCHIVE_IDENTITY_REQUIRED')
    need({key:pin(plan['packageExecutable'])[key] for key in ['bytes','sha256']}==receipt['runtimeBinary'],'PACKAGE_RUNTIME_IDENTITY_REQUIRED')
    return receipt,snapshot(root)

def verify_package_unchanged(root,before):
    need(before==snapshot(root),'ORIGINAL_PACKAGE_DRIFT')

def pipeline(args):
    fixed_flags();args.app=safe(args.app);args.output=Path(args.output)
    need(re.fullmatch('[a-f0-9]{40}',args.source_commit) is not None,'SOURCE_COMMIT_REQUIRED')
    need(not args.output.exists() and args.output!=args.app,'FRESH_PIPELINE_OUTPUT_REQUIRED');safe(args.output.parent)
    if args.output.is_relative_to(args.app):need(args.output.relative_to(args.app).parts[0]=='evidence','OWNED_OUTPUT_LAYOUT_REQUIRED')
    if args.package:
        args.package=safe(args.package)
        need(not args.package.is_relative_to(args.output) and not args.output.is_relative_to(args.package),'PACKAGE_OUTPUT_OVERLAP_REFUSED')
    args.output.mkdir();out=args.output
    result={'status':'ADVERSE','reviewMode':REVIEW_MODE,'primaryError':None,'finalErrors':[],
            'mode':'package' if args.package else 'development','sourceCommit':args.source_commit,
            'limits':['synthetic R3 checkpoint','producer closure is quiescence, not normal Quit','no physical keyboard focus','no installed/release admission']}
    original_app=None;package_before=None;started=time.monotonic()
    try:
        environment=clean_environment(out/'Temp');runtimes,external=runtime_inputs(args,out,environment)
        original_app=snapshot(args.app,exclude=['evidence','dist','Data','.git']);save(out/'source-inputs.json',original_app)
        package_receipt=None
        if args.package:package_receipt,package_before=physical_package(args.package);save(out/'package-inputs.json',package_before)
        producer=out/'producer';stage_base(producer,args.app)
        for name in ['bootstrap.mjs','summary-cli.mjs','producer-summary.mjs']:copy_file(HERE/name,producer/name)
        copy_file(HERE/'producer_host.py',producer/'host.py')
        script=(producer/'app/tests/native/source-sync.mjs').read_text(encoding='utf8')
        paths=json.loads(re.search(r'const paths=(\[[^\n]+?\]);',script).group(1).replace("'",'"'))
        cases=re.findall(r"result\.cases\.push\(\{name:'([^']+)'",script);need(len(paths)==12 and len(set(paths))==12 and len(cases)==5,'ORIGINAL_SOURCE_SYNC_SCENARIOS_REQUIRED')
        save(producer/'process-scope.json',{'processPrefixes':[str(producer/'app')],'limitations':'Unique staged app path; sampled CIM null fields/path aliases remain; complete owned Job evidence is separate.'})
        source=stage_inputs(producer,'producer',args,runtimes,external)
        source['sourceInputs']={name:pin(producer/'app'/name)['sha256'] for name in paths};source['caseNames']=cases
        source['producerInputConfig']={'schema':1,'mode':result['mode'],'appRoot':str(producer/'app'),'runtimes':runtimes}
        if args.package:
            source['producerInputConfig']['package']={'root':str(args.package),'receipt':package_receipt}
            source['files'].extend({k:row[k] for k in ['path','bytes','sha256']} for row in package_before['files'])
            source['inputTrees'].append(tree_shape(args.package))
        save(producer/'SOURCE-PINS.json',source)
        observed=launch_host(producer,out,environment)
        need(observed['status']=='OWNED_PRODUCER_COMPLETE_REQUIRES_INDEPENDENT_DATA' and observed['primaryError'] is None and observed['finalErrors']==[],'PRODUCER_AUTOMATED_ADMISSION_REQUIRED')
        result['producer']=pin(producer/'host-result.json')
        data=read(producer/'operation/observations-before-admission.json');evidence=Path(observed['producerEvidence']['root'])
        capture=evidence/'raw-captures/after-close/files';actual=snapshot(capture)
        expected=data['manifest'];need({r['relativePath'] for r in actual['files']}=={r['relativePath'] for r in expected['files']} and set(actual['directories'])=={r['relativePath'] for r in expected['directories']},'PHYSICAL_CAPTURE_TREE_REQUIRED')
        context={'nodePath':runtimes['node']['path'],'expectedDataRoot':observed['producerEvidence']['dataRoot'],'expectedCases':cases,'expectedSourceInputs':source['sourceInputs']}
        capture_bytes={row['relativePath']:safe(Path(row['path'])).read_bytes() for row in actual['files']}
        route=derive_route(capture_bytes,data,context)
        save(out/'route-result.json',{'reviewMode':REVIEW_MODE,'route':route,'observations':pin(producer/'operation/observations-before-admission.json'),'capture':pin(evidence/'raw-captures/after-close/capture.json')})
        restore=out/'restore';stage_base(restore,args.app)
        for src,dest in [('restore_host.py','host.py'),('actor-package.mjs' if args.package else 'actor-development.mjs','actor.mjs'),('fixture.mjs','fixture.mjs')]:copy_file(HERE/src,restore/dest)
        route_config={key:route[key] for key in ['projectId','sourceId','oldPointId','v1','v7','directories']}
        route_config.update(files=actual['files'],rawRoot=str(capture),capture=pin(evidence/'raw-captures/after-close/capture.json'))
        save(restore/'config.json',{'head':args.source_commit,'routes':{'packaged' if args.package else 'native':route_config},'reviewMode':REVIEW_MODE})
        mode=result['mode'];physical=None
        if args.package:
            # Copy immutable preview only, never the producer's populated package/Data.
            save(restore/'package-copy-provenance.json',copy_app(args.package,restore/'package'))
            exe=restore/'package/App/versions/0.1.0/SIREN.exe';archive=exe.parent/'resources/app.asar'
            physical={'root':str(restore/'package'),'executable':pin(exe),'archive':pin(archive),'dataRoot':str(restore/'package/Data')}
            prefixes=[str(exe.parent),physical['dataRoot']]
        else:exe=restore/'app/node_modules/electron/dist/electron.exe';prefixes=[str(restore/'operation/Data')]
        save(restore/'process-scope.json',{'processPrefixes':prefixes,'limitations':'Unique owned Data/package paths; complete raw Job membership is separate.'})
        restore_source=stage_inputs(restore,'restore',args,runtimes,external)
        restore_source.update(mode=mode,electron=pin(exe))
        restore_source['files'].extend({k:row[k] for k in ['path','bytes','sha256']} for row in actual['files'])
        restore_source['inputTrees'].append(tree_shape(capture))
        if physical:restore_source['physicalPackage']=physical;restore_source['inputTrees'].append(tree_shape(restore/'package'))
        save(restore/'SOURCE-PINS.json',restore_source)
        restored=launch_host(restore,out,environment)
        need(restored['status']=='NATIVE_RESTORE_V7_HOST_COMPLETE_REQUIRES_INDEPENDENT_DATA' and restored['primaryError'] is None and restored['finalErrors']==[],'RESTORE_AUTOMATED_COMPLETION_REQUIRED')
        result['restore']=pin(restore/'host-result.json');result['status']='PIPELINE_COMPLETE_REQUIRES_INDEPENDENT_DATA'
    except BaseException as failure:
        result['primaryError']=getattr(failure,'observedPrimary',{'type':type(failure).__name__,'message':str(failure)[:3000]})
        result['finalErrors'].extend(getattr(failure,'observedSecondary',[]))
    finally:
        for name,action in [('source',lambda:need(original_app==snapshot(args.app,exclude=['evidence','dist','Data','.git']),'ORIGINAL_SOURCE_DRIFT') if original_app else None),
                            ('package',lambda:verify_package_unchanged(args.package,package_before) if package_before else None),
                            ('inventory',lambda:save(out/'output-inventory.json',snapshot(out)))]:
            try:action()
            except BaseException as failure:result['finalErrors'].append({'stage':name,'type':type(failure).__name__,'message':str(failure)[:3000]})
        result['elapsedSeconds']=time.monotonic()-started
        if result['finalErrors']:result['status']='ADVERSE'
        retain_receipt(out/'pipeline-result.json',result,out/'pipeline-fallback.json')
    print(json.dumps({'status':result['status'],'evidence':str(out),'reviewMode':REVIEW_MODE,'primaryError':result['primaryError'],'finalErrors':result['finalErrors']}))
    return 0 if result['status']=='PIPELINE_COMPLETE_REQUIRES_INDEPENDENT_DATA' else 1

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ['app','output','node','powershell','conhost','source-commit']:parser.add_argument('--'+name,required=True)
    parser.add_argument('--package');args=parser.parse_args();args.app=Path(args.app);args.output=Path(args.output)
    raise SystemExit(pipeline(args))
