"""Finite original-HANDLE owner for one explicitly observation-only attempt."""
from pathlib import Path
import importlib.util,json,os,sys,time
ROOT=Path(__file__).resolve().parent
def _no_cache(path):
 path=Path(path)
 if os.path.lexists(path.parent/'__pycache__') or os.path.lexists(path.with_suffix('.pyc')):raise RuntimeError('LOCAL_BYTECODE_CACHE_REFUSED:'+str(path))

# Trusted stdlib bootstrap; entry/runtime/review authenticity is an external gate.
import hashlib
_EARLY_COMPONENT_PATH=Path('C:/Claude/SIREN_WORK/terminal-operational-native-stack-buffer-cohort-v1-20261022/core.py')
_EARLY_COMPONENT_SHA='501ad69e30e64e40378486ff1883092f9e58da1dbbd24c07fe5c0af5f6871df2'
_EARLY_RUNTIME_NAMES=('pathlib','hashlib','importlib','importlib.util','json','os','stat','sys','time','types','re','ntpath','datetime','math','threading')

def _load_early_sources(common_alias,include_inner):
 if (common_alias,include_inner) not in (('image_outer_common',False),('image_inner_common',True),('admit_owned_image_common',False)):raise RuntimeError('EARLY_FIXED_ENTRY_PLAN')
 workspace=ROOT.parent
 plan=[(common_alias,ROOT/'controller_common.py'),('ordinary_picker_contracts',ROOT/'controller_contracts.py'),('ordinary_cancel_evidence',ROOT/'cancel_evidence.py'),('ordinary_focus_evidence',ROOT/'focus_evidence.py'),('ordinary_route_evidence',ROOT/'route_evidence.py'),('ordinary_closed_picker_consumer',workspace/'terminal-receipt-target-binding-v2-20261023/candidate/subject.py')]
 if include_inner:plan += [('image_route_support',ROOT/'route_support.py'),('image_inner_loader',ROOT/'loader_context.py'),('image_endpoint_retention',ROOT/'endpoint_retention.py'),('image_route_retention',workspace/'terminal-route-retention-policy-v3-20261019/retention.py'),('image_active_picker_journal_prefix',workspace/'terminal-active-picker-journal-prefix-reader-v1-20261019/prefix_reader.py')]
 plan += [('ordinary_direct_capture_core',ROOT/'capture_core.py'),('ordinary_direct_fixed_plan',ROOT/'fixed_launch_plan.py'),('ordinary_direct_finish_reader',ROOT/'read_finish.py'),('ordinary_direct_owner_reader',ROOT/'read_owner.py'),('ordinary_direct_context',ROOT/'direct_context.py')]
 plan += [('ordinary_described_error',ROOT/'described_error.py'),('ordinary_direct_results',ROOT/'direct_results.py')]
 plan += [('ordinary_direct_route',ROOT/'direct_route.py')]
 manifest=json.loads((ROOT/'INPUT-MANIFEST.json').read_bytes())
 if type(manifest) is not dict or type(manifest.get('inputs')) is not list or not all(type(r) is dict and type(r.get('path')) is str for r in manifest['inputs']):raise RuntimeError('EARLY_INPUT_MANIFEST')
 rows=[];buffers={}
 for alias,path in plan:
  matches=[r for r in manifest['inputs'] if Path(r['path'])==path]
  if len(matches)!=1:raise RuntimeError('EXACT_BOOTSTRAP_SOURCE' if alias==common_alias and common_alias=='admit_owned_image_common' else 'EARLY_SELECTED_INPUT_ROW')
  row=matches[0]
  if os.path.lexists(path.parent/'__pycache__') or os.path.lexists(path.with_suffix('.pyc')):raise RuntimeError('LOCAL_BYTECODE_CACHE_REFUSED:'+str(path))
  body=path.read_bytes()
  if type(row.get('bytes')) is not int or type(row.get('sha256')) is not str or len(body)!=row['bytes'] or hashlib.sha256(body).hexdigest()!=row['sha256']:raise RuntimeError('EXACT_BOOTSTRAP_SOURCE' if alias==common_alias and common_alias=='admit_owned_image_common' else 'EARLY_SOURCE_PIN')
  rows.append(dict(name=alias,path=str(path),bytes=row['bytes'],sha256=row['sha256'],package=False));buffers[alias]=body
 component=_EARLY_COMPONENT_PATH.read_bytes()
 if len(component)!=8040 or hashlib.sha256(component).hexdigest()!=_EARLY_COMPONENT_SHA:raise RuntimeError('EARLY_COMPONENT_PIN')
 component_api=__import__('types',globals(),None,('__name__',),0).ModuleType('_owned_early_checked_component')
 component_api.__file__=str(_EARLY_COMPONENT_PATH);component_api.__dict__['__builtins__']=__builtins__
 exec(compile(component,'<trusted-early-component:'+_EARLY_COMPONENT_SHA+'>','exec',dont_inherit=True),component_api.__dict__)
 runtime={name:__import__(name,globals(),None,('__name__',),0) for name in _EARLY_RUNTIME_NAMES}
 runtime[component_api.__name__]=component_api
 return component_api.load_checked_plan(rows=rows,buffers=buffers,packages=[],runtime_imports=runtime)

_early_bundle=None
_early_closed=False
_early_cleanup_diagnostics=[]

def close_early_sources():
 global _early_closed
 if _early_closed:return
 _early_closed=True
 if _early_bundle is not None:_early_bundle.modules['image_outer_common'].close_source_bundles(_early_bundle)

_early_bundle=_load_early_sources('image_outer_common',False)
c=_early_bundle.modules['image_outer_common']
def _main_route():
 c.need(os.name=='nt' and sys.argv[1:]==['--run'] and sys.flags.isolated and sys.flags.no_site and sys.dont_write_bytecode and not sys.flags.optimize,'FIXED_ISOLATED_WINDOWS_OUTER')
 inputs,runtime=c.source_gate();source=c.pin(ROOT/'INPUT-MANIFEST.json')['sha256']
 c.bind_expected_direct_context(source)
 for p in [c.OUT,c.DATA,ROOT/'temp',ROOT/'owned-profile',c.JOURNAL,c.A4/'terminal-launch-observation.jsonl',c.A4/'terminal-startup-timing.jsonl',c.ENDPOINT_JOURNAL]:c.need(not os.path.lexists(p),'FRESH_ATTEMPT_ONLY_NO_REPLAY')
 c.OUT.mkdir();deadline=time.monotonic()+240;edge=None;identity=None;primary=None;secondary=[];forced=[];settlement=None;inner=None;exit_settlement=None
 try:
  c.write(c.OUT/'attempt.json',c.envelope('attempt',sourceSha256=source,inputs=inputs,runtime=runtime,totalOuterSeconds=240,totalInnerSeconds=210,uiWorkerSeconds=180,publicReadinessSeconds=5,sharedDialogSeconds=10,scope='one genuine initial-null Cancel and normal Quit; five seconds readiness only'))
  c.create_folders();stack=c.native_stack();c.bind_direct_parent(stack,'outer',deadline);facade=stack.native.NativeEscapeFacade()
  command=[str(c.PYTHON),'-B','-I','-S','-X','utf8',str(ROOT/'run-owned-inner.py'),'--owned-inner']
  c.write(c.OUT/'inner-command.json',dict(argv=command,cwd=str(ROOT),environment=c.owned_environment()))
  edge=c.new_direct_edge(stack,'inner',source,deadline,command)
  edge.acquire_and_start(c.direct_security(stack),c.direct_startup_storage,c.direct_pump,time.sleep)
  api,identity=c.held_direct_identity(edge,facade,stack,c.PYTHON)
  edge_binding=dict(edge.q.capture._binding)
  c.write(c.OUT/'inner-held.json',c.envelope('inner-held-direct',sourceSha256=source,identity=identity,edgeBinding=edge_binding))
  c.live_direct(edge,api,identity,stack)
  c.publish(c.OUT/'inner-go.json',c.envelope('inner-go-direct',sourceSha256=source,identity=identity,edgeBinding=edge_binding))
  exit_settlement=edge.wait_original_exit();c.write(c.OUT/'inner-exit-settlement.json',exit_settlement)
 except BaseException as error:primary=error
 finally:
  if edge is not None:
   try:edge.finalize(primary,c.direct_pump,time.sleep)
   except BaseException as error:secondary.append(dict(stage='direct-edge-finalization',edge='inner',error=c.describe(error)))
  settlement=c.direct_edge_value(edge,secondary)
  # Reconstruct from whole final bodies only after the original inner's Job is empty.
  if exit_settlement is not None and c.direct_edge_clean(settlement) and not forced and not secondary:
   try:
    inner=c.read(c.OUT/'inner-result.json',4*1024*1024)
    c.need(c.inner_direct_completion(inner,source,identity,None),'ACTUAL_FOCUS_CANCEL_INNER_COMPLETION')
   except BaseException as error:
    if primary is None:primary=error
    else:secondary.append(dict(stage='inner-completion-readback',error=c.describe(error)))
  elif inner is None and os.path.lexists(c.OUT/'inner-result.json'):
   try:inner=c.read(c.OUT/'inner-result.json',4*1024*1024)
   except BaseException as error:secondary.append(dict(stage='inner-adverse-readback',error=c.describe(error)))
  c.final_pins(inputs,secondary);c.final_runtime(secondary,'outer')
  result=c.envelope('ordinary-cancel-direct-complete' if primary is None and not secondary and not forced and c.direct_edge_clean(settlement) else 'ordinary-cancel-direct-adverse',schema=1,kind='MAINTAINED_DIRECT_OUTER_V1',sourceSha256=source,primaryPresent=primary is not None,primary=None if primary is None else c.describe(primary),secondary=secondary,forced=forced,identity=identity,directNormalExit=exit_settlement,innerEdge=settlement,inner=inner,scope='one fixed shortcut focus observation then genuine Cancel/normal Quit; forced owned retirement remains adverse')
  if result['stage']=='ordinary-cancel-direct-complete':
   try:c.need(c.outer_direct_completion(result,source,edge),'FULL_OUTER_FOCUS_CANCEL_COMPLETION')
   except BaseException as error:
    primary=error;result.update(stage='ordinary-cancel-direct-adverse',primaryPresent=True,primary=c.describe(primary))
  try:c.write(c.OUT/'result.json',result)
  except BaseException as error:
   secondary.append(dict(stage='outer-result-retention',error=c.describe(error)))
   try:print(json.dumps(c.envelope('outer-retention-adverse',primary=result['primary'],secondary=secondary)),file=sys.stderr,flush=True)
   except BaseException:pass
  try:print(json.dumps(c.envelope(result['stage'],primary=result['primary'],secondary=secondary,forced=forced)),flush=True)
  except BaseException as error:secondary.append(dict(stage='outer-diagnostic-emission',error=c.describe(error)))
 return 0 if result['stage']=='ordinary-cancel-direct-complete' and primary is None and not secondary and not forced else 1
def main():
 if _early_closed:raise RuntimeError('EARLY_SOURCES_CLOSED')
 return _main_route()

def _run_direct():
 primary=None;result=None
 try:result=main()
 except BaseException as error:primary=error;raise
 finally:
  try:close_early_sources()
  except BaseException as cleanup:
   diagnostic=c.cleanup_diagnostic('early-bundle-cleanup',cleanup);_early_cleanup_diagnostics.append(diagnostic)
   if primary is not None:c.annotate_cleanup(primary,'EARLY_BUNDLE_CLEANUP:',cleanup)
   diagnostic.update(c.cleanup_fallback_context())
   if result is not None and result!=0 or 'cleanupFallback' in diagnostic:
    try:print(json.dumps(diagnostic),file=sys.stderr,flush=True)
    except BaseException as emission:_early_cleanup_diagnostics.append(c.cleanup_diagnostic('early-bundle-diagnostic',emission))
   if primary is None and not (result is not None and result!=0):raise
 return result

if __name__=='__main__':raise SystemExit(_run_direct())


# Explicit supplied successor root; legacy CLI remains unadopted.
def _five_outer_result_producer_v2():
    global primary, result
    result = c.envelope('ordinary-cancel-five-role-complete' if primary is None and (not secondary) and (not forced) and c.direct_edge_clean_five_v2(settlement) else 'ordinary-cancel-five-role-adverse', schema=1, kind='SIREN_FIVE_ROLE_OUTER_RESULT_V2', sourceSha256=source, primaryPresent=primary is not None, primary=None if primary is None else c.describe(primary), secondary=secondary, forced=forced, identity=identity, directNormalExit=exit_settlement, innerEdge=settlement, inner=inner, scope='one fixed shortcut focus observation then genuine Cancel/normal Quit; forced owned retirement remains adverse')
    if result['stage'] == 'ordinary-cancel-five-role-complete':
        try:
            c.need(c.outer_direct_completion_five_v2(result, source, edge), 'FULL_FIVE_OUTER_COMPLETION')
        except BaseException as error:
            if primary is None:
                primary = error
            result.update(stage='ordinary-cancel-five-role-adverse', primaryPresent=True, primary=c.describe(primary))
    c.write_five_v2(c.OUT / 'result.json', result)

def _run_five_business_outer_v2():
    global primary, result, settlement, exit_settlement, inner, _five_outer_attempt, _five_inner_raw
    import ordinary_external_profile_v1 as PROFILE
    import ordinary_direct_fixed_plan as PLAN
    import math
    import hashlib
    c.need(not globals().get('_five_outer_attempt', False), 'FIVE_OUTER_TRANSACTION_ONCE')
    _five_outer_attempt = True
    primary = None
    settlement = None
    exit_settlement = None
    inner = None
    _five_inner_raw = None
    try:
        c.remaining_five_v2(deadline)
        exit_settlement = edge.wait_original_exit()
        c.need(c.direct_normal_exit_five_v2(exit_settlement, identity), 'FIVE_ORIGINAL_INNER_NORMAL_EXIT')
    except BaseException as error:
        primary = error
    finally:
        try:
            edge.finalize(primary, c.direct_pump_five_v2, time.sleep)
        except BaseException as error:
            if primary is None:
                primary = error
            else:
                secondary.append(dict(stage='five-original-inner-finalization', error=c.describe(error)))
        settlement = c.direct_edge_value_five_v2(edge, secondary)
    if primary is None and (not secondary) and c.direct_edge_clean_five_v2(settlement):
        try:
            path = c.OUT / 'inner-result.json'
            expected_path = PLAN._ROOT + '\\execution\\inner-result.json'
            c.need(str(path) == expected_path, 'FIXED_FIVE_INNER_RESULT_PATH')

            def typed_pin(value):
                PROFILE._keys(value, ('path', 'bytes', 'sha256'), 'FIVE_INNER_LITERAL_PIN')
                c.need(type(value['path']) is str and value['path'] == expected_path and (type(value['bytes']) is int) and (0 < value['bytes'] <= 4194304) and PROFILE._hex(value['sha256'], 64), 'TYPED_BOUNDED_FIVE_INNER_PIN')
            before = c.pin_five_v2(path)
            typed_pin(before)
            before = PROFILE._detach(before)
            _five_inner_raw = c.read_bytes_five_v2(path, 4194304)
            c.need(type(_five_inner_raw) is bytes and 0 < len(_five_inner_raw) <= 4194304, 'FIVE_ORIGINAL_INNER_RAW_PROFILE')
            after = c.pin_five_v2(path)
            typed_pin(after)
            after = PROFILE._detach(after)
            c.need(PROFILE._same(before, after) and before['bytes'] == len(_five_inner_raw) and (before['sha256'] == hashlib.sha256(_five_inner_raw).hexdigest()), 'FIVE_ORIGINAL_INNER_LITERAL_READBACK')

            def finite(text):
                value = float(text)
                c.need(math.isfinite(value), 'FIVE_FINITE_INNER_JSON')
                return value
            inner = json.loads(_five_inner_raw.decode('utf8', 'strict'), object_pairs_hook=PROFILE._pairs, parse_constant=PROFILE._constant, parse_float=finite)
        except BaseException as error:
            primary = error
    try:
        _five_outer_result_producer_v2()
    except BaseException as error:
        if primary is None:
            primary = error
        else:
            secondary.append(dict(stage='five-outer-result-retention', error=c.describe(error)))
        if type(globals().get('result')) is dict:
            result.update(stage='ordinary-cancel-five-role-adverse', primaryPresent=True, primary=c.describe(primary))
    return result
