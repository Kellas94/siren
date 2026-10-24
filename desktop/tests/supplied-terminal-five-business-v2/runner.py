"""One-use supplied Windows composition with separate physical and logical inputs."""
from pathlib import Path
import _strptime,ast,copy,ctypes,dataclasses,datetime,hashlib,io,json,linecache,math,ntpath,os,re,stat,struct,sys,time,traceback,types,unittest,weakref

BASE=Path(__file__).resolve().parent
PY=Path(sys.executable)
CANONICAL_ROOT=r'C:\Claude\SIREN_WORK\terminal-five-business-c0-t0-integration-v2-20261024\portable-v2'
LOGICAL_WORK=Path(r'C:\Claude\SIREN_WORK')
FLAG='--portable-five-business-v2'
EXPECTED_PYTHON=dict(bytes=104952,sha256='4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a')
PROGRAMS=['bridge_fixture','context_fixture','result_fixture','grouped_fixture','focus_fixture','semantic_controls','c0_fixture','t0_fixture','t0_controls','five_api','business_fixture','business_controls','integration_business_fixture','integration_focus_fixture','integration_c0_fixture','integration_t0_fixture','integration_binding','integration_controls','integration_adverse_controls']
CLASSES=['SemanticChecks','T0Checks','FiveRoleAPIChecks','BusinessChecks','IntegratedChecks','IntegratedAdverseChecks']
SELECTIONS=['PARENT_SEED_CODE','FOCUS_SEED_CODE','GUARD_WORLD_CODE','NATIVE_WORLD_CODE','GUARD_PORTS_CODE','INNER_ROUTE_CODE','INNER_ROOT_CODE','OUTER_ROOT_CODE','FIVE_INNER_PRODUCER_CODE','FIVE_OUTER_PRODUCER_CODE']
SELECTED=['SemanticChecks.test_00_native_constructor_and_effect_guards','IntegratedChecks.test_actual_new_business_c0_report_revalidation_and_t0_observation','IntegratedAdverseChecks.test_clean_owner_does_not_hide_adverse_missing_or_foreign_business','IntegratedAdverseChecks.test_cross_protocol_readers_refuse_without_widening_v1','IntegratedAdverseChecks.test_late_or_throwing_observation_delivery_keeps_original_sealed_bytes','IntegratedAdverseChecks.test_missing_owner_eof_retains_original_read_and_blocks_report','IntegratedAdverseChecks.test_nonzero_and_still_active_owner_are_not_report_completion','IntegratedAdverseChecks.test_original_clock_failure_after_report_read_stays_sticky','IntegratedAdverseChecks.test_pre_parent_failure_reserves_actor_across_both_protocols','IntegratedAdverseChecks.test_report_rechecks_floor_body_order_and_original_producer','T0Checks.test_original_c0_exit_late_stderr_and_report_all_join']
if os.name!='nt' or sys.implementation.name!='cpython' or sys.version_info[:3]!=(3,12,10) or struct.calcsize('P')!=8:
    raise RuntimeError('EXTERNAL_WINDOWS_CPYTHON_3_12_10_X64_REQUIRED')
if sys.orig_argv!=[str(PY),'-B','-I','-S','-X','utf8',str(BASE/'runner.py'),FLAG] or Path.cwd().resolve()!=BASE or sys.flags.optimize or not sys.flags.isolated or not sys.flags.no_site or not sys.dont_write_bytecode or sys.flags.utf8_mode!=1:
    raise RuntimeError('FIXED_PORTABLE_INVOCATION')

def record(path,body):return dict(path=str(path),bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
def pin(path):return record(path,path.read_bytes())
def need(value,reason):
    if value is not True:raise RuntimeError(reason)

def host_file(relative):
    # Root-to-leaf lstat prevents accepting a mapped link before target access.
    need(type(relative) is str and re.fullmatch(r'(?:inputs/[A-Za-z0-9_]+\.(?:py|json)|runner\.py|invoke\.py|SOURCE\.json|peer-source-review\.json)',relative) is not None,'CLOSED_RELATIVE_HOST_PATH')
    current=BASE
    for part in relative.split('/'):
        current=current/part;info=current.lstat()
        need(not stat.S_ISLNK(info.st_mode) and not(getattr(info,'st_file_attributes',0)&0x400),'HOST_INPUT_REPARSE_REFUSED')
    need(stat.S_ISREG(info.st_mode) and current.is_relative_to(BASE),'REGULAR_OWNED_HOST_INPUT')
    return current

interpreter=PY.read_bytes()
need(dict(bytes=len(interpreter),sha256=hashlib.sha256(interpreter).hexdigest())==EXPECTED_PYTHON,'REVIEWED_EXTERNAL_INTERPRETER_BYTES_REQUIRED')
sp=host_file('SOURCE.json');pp=host_file('peer-source-review.json')
sb=sp.read_bytes();pb=pp.read_bytes();source=json.loads(sb);peer=json.loads(pb)
canonical=source['canonicalPaths']
need(canonical==dict(root=CANONICAL_ROOT,source=CANONICAL_ROOT+'\\SOURCE.json',runner=CANONICAL_ROOT+'\\runner.py',invoker=CANONICAL_ROOT+'\\invoke.py',review=CANONICAL_ROOT+'\\peer-source-review.json'),'FIXED_LOGICAL_REVIEW_IDENTITIES')
rb=host_file('runner.py').read_bytes()
need(peer['kind']=='EXTERNAL_SUPPLY_CANDIDATE_SOURCE_REVIEW_V1' and peer['author']=='/root/burst_preflight_review' and peer['verdict']=='EXTERNAL_SUPPLY_SOURCE_ACCEPTED' and peer['findings']==[] and peer['sourceManifest']==record(canonical['source'],sb) and peer['candidate']==record(canonical['runner'],rb),'GENUINE_PORTABLE_SOURCE_REVIEW')
need(source['interpreterPolicy']==dict(implementation='cpython',version=[3,12,10],platform='win32',pointerBytes=8,executable=EXPECTED_PYTHON),'FIXED_REVIEWED_INTERPRETER_POLICY')
need(source['programs']==PROGRAMS and source['selections']==SELECTIONS and source['loadedClasses']==CLASSES and source['plannedTests']==SELECTED,'EXACT_PORTABLE_PROGRAM_SELECTION')
need(len(source['moduleRows'])==25 and len(source['businessBundle']['moduleRows'])==29 and len(source['businessBundle']['bridgeRows'])==21,'EXACT_PORTABLE_MODULE_COUNTS')
required=set(PROGRAMS+SELECTIONS+['common_source','reader_source','loader','maintained_inner','maintained_outer','prefocus_body','business_bundle','source_plan','declaration','runner','invoker'])
required.update(row['name'] for row in source['moduleRows']+source['businessBundle']['moduleRows'])
need(set(source['inputs'])==set(source['hostMap'])==required,'CLOSED_EXECUTABLE_HOST_MAP')
held={};host_pins=[]
for name,row in source['inputs'].items():
    mapping=source['hostMap'][name]
    need(type(mapping) is dict and set(mapping)=={'relativePath','bytes','sha256'} and mapping['bytes']==row['bytes'] and mapping['sha256']==row['sha256'],'EXACT_HOST_LOGICAL_JOIN')
    path=host_file(mapping['relativePath']);body=path.read_bytes()
    need(record(row['path'],body)==row,'PORTABLE_INPUT_DRIFT:'+name)
    held[name]=body;host_pins.append(dict(name=name,relativePath=mapping['relativePath'],logicalPin=dict(row),physicalPin=record(path,body)))
need(held['runner']==rb,'EXACT_RUNNING_RUNNER')
business=json.loads(held['business_bundle']);plan=json.loads(held['source_plan'])
need(business==source['businessBundle'],'EXACT_BUSINESS_BUNDLE')
need(peer['sourcePlan']==source['inputs']['source_plan'] and peer['declaration']==source['logicalDeclarationPin'] and source['logicalDeclarationPin']==record(r'C:\Claude\SIREN_WORK\terminal-operational-four-stage-candidate-v1-20261022\capture-external-declaration-v1.json',held['declaration']),'REVIEWED_PARTIAL_PLAN_DECLARATION')
codes={name:compile(held[name],source['inputs'][name]['path'],'exec',dont_inherit=True) for name in PROGRAMS+SELECTIONS+['loader']}
def selected_code(name,roster):
    nodes=[node for node in ast.parse(held[name]).body if isinstance(node,ast.FunctionDef) and node.name in roster]
    need(sorted(node.name for node in nodes)==sorted(roster),'EXACT_AST_CLOSURE')
    return compile(ast.Module(body=nodes,type_ignores=[]),source['inputs'][name]['path'],'exec',dont_inherit=True)
common_code=selected_code('common_source',source['commonFunctions']);reader_code=selected_code('reader_source',source['readerFunctions'])
# Tracebacks can show supplied source without opening its virtual C:\Claude label.
for name,body in held.items():
    label=source['inputs'][name]['path']
    if label.endswith('.py'):linecache.cache[label]=(len(body),None,body.decode('utf8').splitlines(True),label)
fixed=[record(sp,sb),record(pp,pb),record(BASE/'runner.py',rb)]
with (BASE/'CONSUMED').open('x',encoding='ascii') as stream:json.dump(fixed,stream)
out=BASE/'evidence';out.mkdir();log=io.StringIO();result=None;failure=None;bundle=None;business_bundle=None;ns={};loader={};teardown={}
denials=dict(process=0,dll=0,constructor=0);saved_last_error=(ctypes.set_last_error,ctypes.get_last_error)
disk_guard=dict(hiddenLogicalRootOpenDenials=0,deniedPaths=[],calibrated=False)
def path_key(value):return os.path.normcase(os.path.abspath(os.fsdecode(value)))
logical_key=path_key(LOGICAL_WORK);host_key=path_key(BASE)
runtime_keys=tuple(path_key(p) for p in {sys.base_prefix,sys.prefix})
def under(path,root):return path==root or path.startswith(root+os.sep)
def audit(event,args):
    if event in ('subprocess.Popen','os.system','os.posix_spawn','os.spawn','os.exec'):denials['process']+=1;raise RuntimeError('SEMANTIC_PROCESS_DENIED')
    if event in ('ctypes.dlopen','ctypes.dlsym','ctypes.dlsym/handle'):denials['dll']+=1;raise RuntimeError('SEMANTIC_DLL_DENIED')
    if event=='open' and args and isinstance(args[0],(str,bytes)):
        key=path_key(args[0])
        if under(key,logical_key) and not under(key,host_key) and not any(under(key,root) for root in runtime_keys):
            disk_guard['hiddenLogicalRootOpenDenials']+=1;disk_guard['deniedPaths'].append(key)
            raise PermissionError('PORTABLE_HIDDEN_LOGICAL_ROOT_OPEN_DENIED')
sys.addaudithook(audit)
try:
    try:
        with open(LOGICAL_WORK/'__portable_hidden_input_denied__','rb'):pass
    except PermissionError as error:
        need(str(error)=='PORTABLE_HIDDEN_LOGICAL_ROOT_OPEN_DENIED' and disk_guard['hiddenLogicalRootOpenDenials']==1,'EXACT_HIDDEN_READ_CALIBRATION')
        disk_guard['calibrated']=True
    need(disk_guard['calibrated'] is True,'HIDDEN_READ_CALIBRATION_REQUIRED')
    exec(codes['loader'],loader)
    bundle=loader['load_checked_plan'](rows=source['moduleRows'],buffers={r['name']:held[r['name']] for r in source['moduleRows']},packages=[],runtime_imports=dict(hashlib=hashlib,json=json,math=math,types=types))
    runtime={module.__name__:module for module in (_strptime,copy,hashlib,json,math,re,ntpath,datetime,types,weakref,dataclasses,time,unittest)}
    bridge={row['name']:bundle.modules[row['name']] for row in business['bridgeRows']}
    for row in business['bridgeRows']:need(row in source['moduleRows'] and sys.modules.get(row['name']) is bridge[row['name']],'EXACT_CURRENT_BRIDGE_OBJECT')
    runtime.update(bridge)
    business_bundle=loader['load_checked_plan'](rows=business['moduleRows'],buffers={r['name']:held[r['name']] for r in business['moduleRows']},packages=business['packages'],runtime_imports=runtime)
    all_modules=dict(bundle.modules);all_modules.update(business_bundle.modules)
    ns={key:all_modules[name] for key,name in source['symbols'].items()}
    need(ns['P']._WORK==str(LOGICAL_WORK),'UNCHANGED_LOGICAL_WORK_ROOT')
    forbidden={ns['T']._StartupStorage.__init__.__code__,ns['NATIVE'].NativeFacade.__init__.__code__,ns['TOPOLOGY'].NativeTopologyFacade.__init__.__code__,ns['ESCAPE'].NativeEscapeFacade.__init__.__code__}
    def profile(frame,event,arg):
        if event=='call' and frame.f_code in forbidden:denials['constructor']+=1;raise RuntimeError('SEMANTIC_NATIVE_CONSTRUCTOR_DENIED')
    sys.setprofile(profile)
    guard={};exec(codes['GUARD_WORLD_CODE'],guard)
    native=dict(c=ctypes,types=types,ESCAPE=ns['ESCAPE']);exec(codes['NATIVE_WORLD_CODE'],native)
    ports=dict(c=ctypes);exec(codes['GUARD_PORTS_CODE'],ports)
    ns.update({name:codes[name] for name in SELECTIONS},COMMON_GROUP_CODE=common_code,READBACK_CODE=reader_code,GUARD_WORLD=guard,NATIVE_WORLD=native,GUARD_PORTS=ports,ctypes=ctypes,sys=sys,LOGICAL_ROOT=Path(ns['P']._ROOT),WORK_PATH=LOGICAL_WORK,PREFOCUS_BODY=held['prefocus_body'],DENIALS=denials,REARM_PROFILE=lambda:sys.setprofile(profile),PROFILE_FUNCTION=profile)
    ns['SUPPLY']=dict(plan_raw=held['source_plan'],declaration_raw=held['declaration'],review_raw=pb,plan_pin=source['inputs']['source_plan'],review_pin=record(canonical['review'],pb),buffers={row['name']:held[row['name']] for row in plan['modules']})
    ns['OUTPUT_PATH']=out
    for name in PROGRAMS:exec(codes[name],ns)
    classes={name:ns[name] for name in CLASSES}
    actual=sorted(c+'.'+name for c,cls in classes.items() for name in cls.__dict__ if name.startswith('test_'))
    need(actual==source['allTests'],'EXACT_PORTABLE_LOADED_TEST_ROSTER')
    result=unittest.TextTestRunner(stream=log,verbosity=2).run(unittest.TestSuite(classes[name.split('.')[0]](name.split('.')[1]) for name in SELECTED))
except BaseException as error:
    failure=dict(type=type(error).__name__,message=str(error));log.write(traceback.format_exc())
finally:
    sys.setprofile(None)
    for name,action in [('restore_worlds',lambda:ns.get('restore_focus_worlds',lambda:None)()),('ctypes_ports',lambda:None if (ctypes.set_last_error,ctypes.get_last_error)==saved_last_error else (_ for _ in ()).throw(RuntimeError('LAST_ERROR_NOT_RESTORED'))),('business_close',lambda:business_bundle.close() if business_bundle is not None else None),('bridge_survives_business_close',lambda:None if bundle is None or all(sys.modules.get(name) is module for name,module in bundle.modules.items()) else (_ for _ in ()).throw(RuntimeError('BRIDGED_MODULE_DRIFT'))),('capture_close',lambda:bundle.close() if bundle is not None else None)]:
        try:action();teardown[name]='OK'
        except BaseException as error:
            teardown[name]=dict(type=type(error).__name__,message=str(error));log.write(traceback.format_exc())
            if failure is None:failure=teardown[name]
    observations=ns.get('SEMANTIC_OBSERVATIONS',[])
    (out/'unittest.txt').write_text(log.getvalue(),encoding='utf8')
    (out/'OBSERVATIONS.json').write_text(json.dumps(observations,indent=2,ensure_ascii=True)+'\n',encoding='ascii')
    stable=all(record(row['path'],host_file(source['hostMap'][name]['relativePath']).read_bytes())==row for name,row in source['inputs'].items()) and fixed==[pin(sp),pin(pp),pin(BASE/'runner.py')]
    value=dict(tests=0 if result is None else result.testsRun,failures=0 if result is None else len(result.failures),errors=0 if result is None else len(result.errors),skipped=0 if result is None else len(result.skipped),expectedFailures=0 if result is None else len(result.expectedFailures),instrumentFailure=failure,stableSources=stable,observations=len(observations),guardDenials=denials,diskGuard=disk_guard,teardown=teardown,moduleExecutions=[] if bundle is None else bundle.executed,businessModuleExecutions=[] if business_bundle is None else business_bundle.executed,actualNativePorts=False,childProcesses=0,childProcessScope='SUPPLIED_COHORT_ACTORS_EXCLUDING_OUTER_PYTHON_RUNNER_INVOCATION',physicalCapture=False,sourceCustody=False,nativeEligibility=False,wholeSourceGatePassed=False,wholeAttempt=False)
    (out/'HOST-INPUTS.json').write_text(json.dumps(dict(actualRoot=str(BASE),canonicalPaths=canonical,physicalInputPins=host_pins,externalInterpreter=record(PY,interpreter),externalRuntimeRoots=list(runtime_keys),reviewActualPin=record(pp,pb),reviewLogicalPin=record(canonical['review'],pb),diskGuardScope='Refuses audited opens beneath virtual logical W outside this host root and the external Python runtime; not filesystem custody or general IO admission.'),indent=2)+'\n',encoding='ascii')
    (out/'RESULT.json').write_text(json.dumps(value,indent=2)+'\n',encoding='ascii')
print(json.dumps(dict(result=pin(out/'RESULT.json'),observationsPin=pin(out/'OBSERVATIONS.json'),hostInputsPin=pin(out/'HOST-INPUTS.json'),**{k:v for k,v in value.items() if k not in ('moduleExecutions','businessModuleExecutions')})))
raise SystemExit(0 if failure is None and result is not None and result.wasSuccessful() and stable and result.testsRun==len(SELECTED) and not result.skipped and not result.expectedFailures and denials==dict(process=1,dll=1,constructor=4) and disk_guard['calibrated'] is True and disk_guard['hiddenLogicalRootOpenDenials']==1 and observations else 1)
