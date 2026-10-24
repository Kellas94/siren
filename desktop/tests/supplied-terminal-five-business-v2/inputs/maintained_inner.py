"""Owned observation-only route. Import never launches/acquires native objects."""
from pathlib import Path
import importlib.util,json,os,sys,time,types,secrets
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
 if _early_bundle is not None:_early_bundle.modules['image_inner_common'].close_source_bundles(_early_bundle)

def local(name,path):
 if _early_closed:raise RuntimeError('EARLY_SOURCES_CLOSED')
 module=_early_bundle.modules.get(name)
 if module is None or Path(module.__file__)!=Path(path):raise RuntimeError('EARLY_ALIAS_PATH')
 owned=module.__dict__['__builtins__']['__import__'](name,globals(),None,('__name__',),0)
 if owned is not module:raise RuntimeError('EARLY_MODULE_IDENTITY')
 return module

_early_bundle=_load_early_sources('image_inner_common',True)
c=local('image_inner_common',ROOT/'controller_common.py')
route_support=local('image_route_support',ROOT/'route_support.py')
loader=local('image_inner_loader',ROOT/'loader_context.py')
endpoint_retention=local('image_endpoint_retention',ROOT/'endpoint_retention.py')
retention=c.local('image_route_retention',c.W/'terminal-route-retention-policy-v3-20261019/retention.py')
prefix_reader=c.local('image_active_picker_journal_prefix',c.W/'terminal-active-picker-journal-prefix-reader-v1-20261019/prefix_reader.py')

def observe_focus(stack,facade,port,binding,clock,controller_identity,proof,secondary):
 """Exact corrected focus operation; preserve first reason before cached getters."""
 operation=None;primary=None
 record=proof['focus']=dict(controllerIdentity=dict(controller_identity),binding=dict(proof['originalBinding']),clockBefore=clock.snapshot(),clockAfter=None,result=None,snapshot=None,port=None,bindingReused=False,clockReused=False,facadeReused=False,membershipBasis='CANONICAL_GUARD_DESCENDANT_CHECK',membershipIndependentlyRetained=False)
 try:
  operation=stack.focus_policy.AddressFocusDiscriminator(facade,port,binding,clock,controller_identity['pid'])
  c.need(operation._binding is binding and operation._clock is clock and operation._facade is facade,'EXACT_ORIGINAL_FOCUS_BINDING_FACADE_FUSE')
  record['bindingReused']=record['clockReused']=record['facadeReused']=True
  record['result']=c.focus_evidence.copy_data(operation.observe())
  c.need(operation._driver._binding is binding and operation._driver._api['monotonic'] is clock and operation._driver._deadline==clock.snapshot()['deadline'],'FOCUS_SAME_READINESS_DEADLINE')
 except BaseException as error:primary=error
 finally:
  getters=[('port',lambda:c.focus_evidence.copy_data(port.snapshot())),('clockAfter',clock.snapshot)]
  if operation is not None:getters.insert(0,('snapshot',lambda:c.focus_evidence.copy_data(operation.snapshot())))
  for name,getter in getters:
   try:record[name]=getter()
   except BaseException as error:
    if primary is None:primary=error
    else:secondary.append(dict(stage='focus-'+name+'-retention',errorType=type(error).__name__))
  if operation is not None:
   try:
    for error in operation.diagnostic_errors:secondary.append(dict(stage='focus-diagnostic',errorType=type(error).__name__))
   except BaseException as error:
    if primary is None:primary=error
    else:secondary.append(dict(stage='focus-diagnostic-retention',errorType=type(error).__name__))
 if primary is not None:raise primary
 result=record['result']
 c.need(type(result) is dict and result.get('classification')=='OWNED_FOCUSED_EDIT_OBSERVED' and result.get('failed') is False and result.get('diagnosticErrorCount')==0 and not secondary,'COMPLETE_FOCUS_REQUIRED_BEFORE_C1')
 c.focus_evidence.pre_c1_complete(record,c.k)
 proof['focusOrder'].append('FOCUS');return operation

def retain_focus_port(port,proof,identities,settlements,forced,secondary):
 """Versioned cached-only retirement; no legacy Popen settlement is inferred."""
 if port is None:return
 normal=proof.get('directNormalExits',{}).get('electron')
 row=proof['directFocusPortRetirement']=dict(kind='DIRECT_FOCUS_PORT_RETIREMENT_V1',
  stage='AFTER_ORIGINAL_CHILD_RETIREMENT_ATTEMPTS',samePortRetained=True,
  originalElectronIdentity=identities.get('electron'),originalExit=normal,
  originalEdgeOutcome=settlements.get('electron'),retirementConfirmed=False,
  cachedSnapshot=None,cachedReadbackStatus=None,
  scope='same strong cached-only port; direct original exit, Job, capture and resource joins')
 row['retirementConfirmed']=(c.direct_normal_exit(normal,identities.get('electron')) and
  c.direct_edge_clean(row['originalEdgeOutcome']) and not forced)
 for name,getter in [('cachedSnapshot',port.snapshot),('cachedReadbackStatus',port.readback_status)]:
  try:row[name]=c.focus_evidence.copy_data(getter())
  except BaseException as error:secondary.append(dict(stage='focus-port-after-retirement-'+name,errorType=type(error).__name__))

def retain_prefocus_ready(ready,source,identity,ui,proof):
 """Validate the actual ready envelope before the unchanged public Pick timer."""
 c.focus_evidence.prefocus_ready(ready,source,identity,ui,c.k)
 proof['uiReady']=c.focus_evidence.copy_data(ready)

def cancel_tail(stack,facade,binding,clock,phase,proof,edges,settlements,forced,deadline,active_reader,live,secondary):
 """One canonical C1; positive provider/MAIN/UI and original-exit joins."""
 ui={key:phase[key] for key in ['projectId','windowId','epoch']};identity=phase['identity'];source=phase['sourceSha256']
 escape=None;original=None
 try:
  live('electron');live('ui')
  proof['focusOrder'].append('C1')
  escape=stack.foreground.create_observed_escape_cancel(facade,binding,clock)
  proof['native']=dict(cancelAnswer=escape.cancel())
  proof['clockAfterC1']=clock.snapshot()
 except BaseException as error:original=error;raise
 finally:
  if escape is not None:
   try:
    native=proof.setdefault('native',{});native['transport']=escape.snapshot();native['foreground']=escape.discovery_snapshot()
    for error in (*escape.secondary_errors,*escape.discovery_secondary_errors):secondary.append(dict(stage='c1-diagnostic',error=c.describe(error)))
    if native['foreground'].get('diagnosticErrorCount')!=0:secondary.append(dict(stage='c1-diagnostic-incomplete',error=dict(type='DiagnosticIncomplete')))
   except BaseException as error:
    if original is None:raise
    secondary.append(dict(stage='c1-diagnostic-retention',error=c.describe(error)))
 native=proof['native'];answer=native['cancelAnswer'];dispatch=native['transport']
 c.need(type(answer) is dict and answer.get('inputSent') is True and answer.get('physicalSuccess') is False and dispatch.get('attempted') is True and type(dispatch.get('rawCount')) is int and dispatch['rawCount']==2 and dispatch.get('physicalSuccess') is False,'CANONICAL_ONE_ESCAPE_DISPATCH')
 c.need(not secondary,'C1_DIAGNOSTICS_ADVERSE')
 c.write(c.OUT/'native-cancel.json',native)
 live('electron');live('ui');c.publish(c.OUT/'cancel-issued.json',c.envelope('cancel-issued',**phase))
 cancelled=c.wait_file(c.OUT/'ui-cancelled.json',deadline)
 c.cancel.ui_cancelled(cancelled,c.PROBE,source,identity,ui);proof['uiCancelled']=cancelled
 active=active_reader.read();proof['providerActiveHex']=active.hex()
 proof['provider']=c.route_evidence.active_cancel(active,proof['receiptBinding'],c.k,c.consumer)
 body=c.read_bytes(c.ENDPOINT_JOURNAL,65536);proof['endpointBodyHex']=body.hex();proof['endpoint']=c.cancel.endpoint_cancel(body,ui['epoch'])
 c.write(c.OUT/'provider-cancel-projection.json',proof['provider']);c.write(c.OUT/'endpoint-cancel-pair.json',proof['endpoint'])
 live('electron');live('ui');c.publish(c.OUT/'go-quit.json',c.envelope('go-quit',**phase))
 proof['directNormalExits']={}
 for name in ['ui','electron']:
  proof['directNormalExits'][name]=edges[name].wait_original_exit();c.write(c.OUT/(name+'-exit-settlement.json'),proof['directNormalExits'][name])
  if name=='ui':
   proof['ui']=c.read(c.OUT/'ui-result.json');c.cancel.ui_final(proof['ui'],c.PROBE,source,identity,ui)
 # Normal original exits do not alone establish descendant writer quiescence.
 for name in ['ui','electron']:
  edges[name].finalize(None,c.direct_pump,time.sleep)
 for name in ['ui','electron']:
  settlements[name]=c.direct_edge_value(edges[name],secondary)
 c.need(not secondary and not forced and all(c.direct_edge_clean(value) for value in settlements.values()),'DIRECT_NORMAL_CHILDREN_CAPTURE_AND_EMPTY_JOBS')
 proof['childrenQuiescent']=True
 proof['receiptFiles']=c.direct_receipt_files(edges['electron'])
 artifacts=c.direct_retained_streams(proof,edges['electron'])
 proof['closedReceipt']=c.consumer.consume(artifacts['journal'],artifacts['stdout'],artifacts['stderr'],proof['receiptBinding'])
 c.route_evidence.receipt_complete(proof,identity,c.k,c.consumer,artifacts)
 proof['session']=c.k.clean_close(c.read(c.DATA/'Recovery/sessions.json',4*1024*1024),identity)
 final_endpoint=c.read_bytes(c.ENDPOINT_JOURNAL,65536);proof['endpointBodyHex']=final_endpoint.hex();proof['endpoint']=c.cancel.endpoint_cancel(final_endpoint,ui['epoch'])
 proof['cancelStatus']='ADDRESS_FOCUS_CANCEL_DATA_COMPLETE'
 c.write(c.OUT/'normal-close-witnesses.json',dict(closedReceipt=proof['closedReceipt'],receiptFiles=proof['receiptFiles'],session=proof['session'],provider=proof['provider'],endpoint=proof['endpoint']))

def _main_route():
 c.need(os.name=='nt' and sys.argv[1:]==['--owned-inner'] and sys.flags.isolated and sys.flags.no_site and sys.dont_write_bytecode and not sys.flags.optimize,'FIXED_ISOLATED_WINDOWS_INNER')
 deadline=time.monotonic()+210;inputs=[];edges={};identities={};apis={};primary=None;secondary=[];forced=[];settlements={};proof=dict(fullTopology=dict(status='NOT_REQUESTED_BY_CANCEL_ROUTE',scope='Full descendant observation is outside this Cancel-only route'));source=None
 focus_port=None;focus_operation=None # Strong references survive normal/adverse retirement and final retention.
 pointer_started=False
 pointer_acknowledged_at=None
 active_journal_reader=None
 active_journal_retained=False
 def retain_active_journal():
  nonlocal active_journal_retained
  if active_journal_reader is None or active_journal_retained:return
  active_journal_retained=True
  def diagnostic(stage,error):
   try:description=c.describe(error)
   except BaseException:description=dict(type='JournalDiagnosticError',message='DESCRIPTION_UNAVAILABLE')
   secondary.append(dict(stage=stage,error=description))
  try:proof['activeJournalRead']=active_journal_reader.snapshot()
  except BaseException as error:diagnostic('active-journal-snapshot',error)
  try:
   errors=active_journal_reader.secondary_errors
   for error in errors:diagnostic('active-journal-secondary',error)
  except BaseException as error:diagnostic('active-journal-secondary-access',error)
 route_state=dict(readinessStage='NOT_STARTED',topologyStage='NOT_REQUESTED_BY_CANCEL_ROUTE',readiness=None,attempt=None,capture=None)
 try:
  inputs,_=c.source_gate();source=c.pin(ROOT/'INPUT-MANIFEST.json')['sha256']
  c.bind_expected_direct_context(source)
  held=c.wait_file(c.OUT/'inner-held.json',deadline);go=c.wait_file(c.OUT/'inner-go.json',deadline)
  c.need(held.get('stage')=='inner-held-direct' and held.get('probe')==c.PROBE and held.get('sourceSha256')==source and held['identity']['pid']==os.getpid() and held['identity']['image'].casefold()==str(c.PYTHON).casefold() and go==c.envelope('inner-go-direct',sourceSha256=source,identity=held['identity'],edgeBinding=held['edgeBinding']) and c.direct_binding_matches('inner',held['edgeBinding']),'ORIGINAL_INNER_GO')
  c.need(not os.path.lexists(c.JOURNAL) and not os.path.lexists(c.A4/'terminal-launch-observation.jsonl') and not os.path.lexists(c.A4/'terminal-startup-timing.jsonl') and not os.path.lexists(c.ENDPOINT_JOURNAL) and not any(c.DATA.iterdir()),'FRESH_OBSERVATION_JOURNAL_AND_DATA')
  identities['inner']=dict(held['identity'])
  stack=c.native_stack();c.bind_direct_parent(stack,'inner',deadline);facade=stack.native.NativeEscapeFacade()
  focus_port=stack.focus_native.borrow_focus_port(facade) # Before launch/picker; retained until original target retirement.
  def launch(name,command,executable):
   c.remaining(deadline)
   edge=c.new_direct_edge(stack,name,source,deadline,command)
   edges[name]=edge  # Retained before command publication or first acquisition.
   c.write(c.OUT/(name+'-command.json'),dict(argv=command,cwd=str(ROOT),environment=c.owned_environment()))
   edge.acquire_and_start(c.direct_security(stack),c.direct_startup_storage,c.direct_pump,time.sleep)
   api,identity=c.held_direct_identity(edge,facade,stack,executable)
   apis[name]=api;identities[name]=identity
   c.write(c.OUT/(name+'-held.json'),dict(kind='DIRECT_CHILD_HELD_V1',
    binding=dict(edge.q.capture._binding),identity=identity,capabilityTransfer=False))
   return edge
  electron=launch('electron',[str(c.ELECTRON),str(c.RUNTIME/'desktop'),'--disable-backgrounding-occluded-windows','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+str(c.DATA),'--siren-test-root='+str(c.DATA),'--enable-logging=file','--log-file='+str(c.OUT/'electron-startup.log')],c.ELECTRON)
  def live(name):c.remaining(deadline);c.live_direct(edges[name],apis[name],identities[name],stack)
  portfile=c.DATA/'DevToolsActivePort';endpoint=None;page=None
  while page is None:
   live('electron')
   if os.path.lexists(portfile):
    raw=edges['electron'].committed_prefix(lambda body:body)
    if b'DevTools listening on ' in raw:
     endpoint=c.k.endpoint_lineage(raw,c.read_bytes(portfile,256));live('electron')
     import http.client
     connection=http.client.HTTPConnection('127.0.0.1',endpoint['port'],timeout=min(1,c.remaining(deadline)))
     try:
      connection.request('GET','/json/list');response=connection.getresponse();body=response.read(262145);c.need(response.status==200 and len(body)<=262144,'OWNED_TARGET_HTTP_REPLY');targets=json.loads(body)
     finally:connection.close()
     c.need(type(targets) is list,'OWNED_TARGET_LIST')
     if any(type(t) is dict and t.get('url')=='siren://app/home.html' for t in targets):page=c.k.home_endpoint(targets,endpoint);live('electron')
   if page is None:time.sleep(min(.05,c.remaining(deadline)))
  edges['electron'].finish_endpoint_discovery()
  proof['endpoint']=dict(endpoint=endpoint,pageWebSocketDebuggerUrl=page,scope='original held process + fresh profile + aligned stderr/GUID; not exclusive socket ownership')
  c.write(c.OUT/'endpoint-lineage.json',proof['endpoint'])
  launch('ui',[str(c.NODE),'--import','file:///C:/Claude/SIREN_WORK/preload-owned-ui-main-v1-20261022.mjs',str(ROOT/'ui-worker-v2/owned-ui-worker.mjs'),'--owned-ui'],c.NODE)
  identity=identities['electron'];base=dict(sourceSha256=source,identity=identity)
  live('electron');live('ui');c.publish(c.OUT/'ui-go.json',c.envelope('ui-go',**base,endpoint=endpoint,pageWebSocketDebuggerUrl=page,profile=str(c.DATA),data=str(c.DATA)))
  ready=c.wait_file(c.OUT/'ui-ready.json',deadline)
  c.need(ready.get('probe')==c.PROBE and ready.get('stage')=='ui-ready' and ready.get('sourceSha256')==source and c.k.exact(ready.get('identity'),identity),'UI_READY_IDENTITY')
  ui={key:ready[key] for key in ['projectId','windowId','epoch']}
  c.need(all(type(ui[k]) is str and 0<len(ui[k])<=128 for k in ['projectId','windowId']) and type(ui['epoch']) is int and ui['epoch']>0,'UI_READY_CONTEXT')
  phase={**base,**ui};proof['phase']=phase
  retain_prefocus_ready(ready,source,identity,ui,proof)
  proof['mode']=dict(mode='GENUINE_ONE_FOCUS_CANCEL_THEN_QUIT',publicReadinessSeconds=5,sharedDialogSeconds=10,uiWorkerAbsoluteSeconds=180,innerAbsoluteSeconds=210)
  def guard():
   c.remaining(deadline)
   live('electron');live('ui')
   c.need(not os.path.lexists(c.OUT/'ui-adverse.json'),'UI_WORKER_ADVERSE')
  proof['loaderBefore']=loader.preflight(c)
  def cache_absence(label,getter):
   captured=route_support.capture_absence(getter)
   if captured['errorPresent']:
    secondary.append(dict(stage=label+'-getter',errorType=type(captured['error']).__name__));return
   data=captured['data']
   if not(type(data) is dict and type(data.get('diagnosticErrorCount')) is int and data['diagnosticErrorCount']>=0):
    secondary.append(dict(stage=label+'-schema',errorType='InvalidAbsenceDiagnosticDTO'));return
   proof[label]=data
   if data['diagnosticErrorCount']>0:secondary.append(dict(stage=label+'-audit-incomplete',diagnosticErrorCount=data['diagnosticErrorCount']))
  def select_target():
   nonlocal primary,pointer_started,pointer_acknowledged_at,active_journal_reader
   guard();pick_started=time.monotonic();c.publish(c.OUT/'go-pick.json',c.envelope('go-pick',**phase))
   pointer=c.wait_file(c.OUT/'pointer-started.json',deadline)
   c.need(pointer.get('probe')==c.PROBE and pointer.get('stage')=='pointer-started' and pointer.get('sourceSha256')==source and c.k.exact(pointer.get('identity'),identity) and all(pointer.get(k)==v for k,v in ui.items()),'ONE_POINTER_INTENT_ONLY')
   pointer_started=True
   pointer_acknowledged_at=time.monotonic()
   active_journal_reader=prefix_reader.PrefixReader(c.JOURNAL,maximum=32768)
   rows=[]
   while len(rows)<2:
    guard();c.need(time.monotonic()-pick_started<5,'PUBLIC_PICKER_BUDGET_PRE_BOUNDARY')
    if os.path.lexists(c.JOURNAL):rows=c.k.journal_prefix(active_journal_reader.read())
    if len(rows)<2:time.sleep(.005)
   hwnd=c.k.picker_boundary(rows,identity['pid'],ui,facade.pointer_bits);live('electron');parent=apis['electron'].window(hwnd)
   c.need(type(parent) is stack.model.Window and parent.pid==identity['pid'] and parent.hwnd==hwnd and parent.visible is True,'ACTUAL_HELD_MAIN_PARENT')
   binding=stack.model.Binding(edges['electron'].original_process_handle(),identity['pid'],identity['image'],identity['createdFileTime'],hwnd,parent.tid,parent.class_name)
   clock=stack.clock.create_dialog_clock()
   def public_remaining():
    guard();left=5-(time.monotonic()-pick_started);c.need(left>0,'PUBLIC_PICKER_BUDGET_READINESS');return left
   readiness=stack.readiness.OwnedDialogReadiness(apis['electron'],binding,clock,public_remaining,time.sleep)
   route_state['readiness']=readiness
   attempt=retention.ReadinessAttempt(readiness);route_state['attempt']=attempt;route_state['readinessStage']='CALL'
   def remember_original(error):
    nonlocal primary
    if primary is None:primary=error
   captured=route_support.capture_readiness(attempt,remember_original)
   route_state['capture']=captured;route_state['readinessStage']='RAISED' if captured['primaryPresent'] else 'RETURNED'
   cache_absence('readinessAbsences',lambda:readiness.enumeration_absence_snapshot())
   for row in captured['secondary']:secondary.append(dict(stage=row['stage'],errorType=type(row['reason']).__name__))
   if captured['primaryPresent']:raise captured['primaryReason']
   c.need(captured['resultPresent'],'READINESS_OUTCOME_REQUIRED')
   proof['readiness']=captured['result']
   proof['fullTopology']=dict(status='NOT_REQUESTED_BY_CANCEL_ROUTE',scope='No two-pass descendant qualification; canonical C1 independently discovers and guards its current owned dialog')
   return binding,clock
  binding,clock=select_target()
  proof['receiptBinding']=dict(mainPid=identity['pid'],projectId=ui['projectId'],windowId=ui['windowId'],epoch=ui['epoch'],pointerBits=facade.pointer_bits,parentHwnd=binding.parent_hwnd)
  proof['originalBinding']=dict(originalHandleDecimal=str(binding.original_handle),pid=binding.pid,image=binding.image,createdFileTime=binding.created_filetime,parentHwndDecimal=str(binding.parent_hwnd),parentTid=binding.parent_tid,parentClass=binding.parent_class)
  proof['focusOrder']=['READINESS']
  focus_operation=observe_focus(stack,facade,focus_port,binding,clock,identities['inner'],proof,secondary)
  cancel_tail(stack,facade,binding,clock,phase,proof,edges,settlements,forced,deadline,active_journal_reader,live,secondary)
  retain_active_journal()
  try:
   captured=route_state['capture'];attempt=route_state['attempt']
   cached=captured['data'] if captured is not None else (None if attempt is None else attempt.data())
   proof['dialogRoute']=dict(readinessStage=route_state['readinessStage'],topologyStage=route_state['topologyStage'],readiness=cached,failureTrace=None if primary is None else retention.trace_error(primary),scope='cached bounded route diagnostics; HWND labels are audit only and grant no authority')
  except BaseException as error:
   if primary is None:primary=error
   else:secondary.append(dict(stage='dialog-route-retention',errorType=type(error).__name__))
  if primary is not None:raise primary
  c.need(not secondary,'CANCEL_DIAGNOSTICS_ADVERSE')
 except BaseException as error:
  if primary is None:primary=error
  elif primary is not error:secondary.append(dict(stage='inner-operation',error=c.describe(error)))
 finally:
  retain_active_journal()
  # No synthetic UI finish on refusal. Original children are retired below.
  for name in ['ui','electron']:
   if name not in edges:continue
   try:edges[name].finalize(primary,c.direct_pump,time.sleep)
   except BaseException as error:secondary.append(dict(stage='direct-edge-finalization',edge=name,error=c.describe(error)))
  # Re-project only after sibling captures/holds settle; this repeats metadata,
  # never native finalization or body readback, and must be charged separately.
  for name in ['ui','electron']:settlements[name]=c.direct_edge_value(edges.get(name),secondary)
  retain_focus_port(focus_port,proof,identities,settlements,forced,secondary)
  try:
   retained_endpoint=endpoint_retention.capture(c);proof['endpointDiagnostic']=retained_endpoint['data']
   for diagnostic in retained_endpoint['secondary']:
    try:description=c.describe(diagnostic['reason'])
    except BaseException:description=dict(type='EndpointDiagnosticError',message='DESCRIPTION_UNAVAILABLE')
    secondary.append(dict(stage=diagnostic['stage'],error=description))
  except BaseException:secondary.append(dict(stage='endpoint-diagnostic-unexpected',error=dict(type='EndpointDiagnosticError',message='RETENTION_UNAVAILABLE')))
  try:
   if 'loaderBefore' in proof:proof['loaderFinal']=loader.preflight(c,'final')
  except BaseException as error:secondary.append(dict(stage='loader-final',error=c.describe(error)))
  c.final_pins(inputs,secondary);c.final_runtime(secondary,'inner')
  result=c.envelope('cancel-inner-direct-complete' if primary is None and not secondary and not forced and all(c.direct_edge_clean(value) for value in settlements.values()) else 'cancel-inner-direct-adverse',schema=1,kind='MAINTAINED_DIRECT_INNER_V1',sourceSha256=source,primaryPresent=primary is not None,primary=None if primary is None else c.describe(primary),secondary=secondary,forced=forced,identities=identities,edgeOutcomes=settlements,proof=proof,scope='one initial-null genuine Cancel then normal Quit; positive MAIN projection is not raw renderer receipt; any forced retirement adverse')
  if result['stage']=='cancel-inner-direct-complete':
   try:c.need(c.inner_direct_completion(result,source,identities['inner'],edges),'FULL_DIRECT_INNER_COMPLETION')
   except BaseException as error:
    primary=error;result.update(stage='cancel-inner-direct-adverse',primaryPresent=True,primary=c.describe(error))
  try:c.write(c.OUT/'inner-result.json',result)
  except BaseException as error:secondary.append(dict(stage='inner-result-retention',error=c.describe(error)));print(json.dumps(c.envelope('inner-retention-adverse',primary=result['primary'],secondary=secondary)),file=sys.stderr,flush=True)
 return 0 if result['stage']=='cancel-inner-direct-complete' and primary is None and not secondary and not forced else 1
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


# Explicit supplied successor closures; legacy CLI remains unadopted.
def observe_focus_five_v2(stack, facade, port, binding, clock, controller_identity, proof, secondary):
    """Exact corrected focus operation; preserve first reason before cached getters."""
    operation = None
    primary = None
    record = proof['focus'] = dict(controllerIdentity=dict(controller_identity), binding=dict(proof['originalBinding']), clockBefore=clock.snapshot(), clockAfter=None, result=None, snapshot=None, port=None, bindingReused=False, clockReused=False, facadeReused=False, membershipBasis='CANONICAL_GUARD_DESCENDANT_CHECK', membershipIndependentlyRetained=False)
    try:
        operation = stack.focus_policy.AddressFocusDiscriminator(facade, port, binding, clock, controller_identity['pid'])
        c.need(operation._binding is binding and operation._clock is clock and (operation._facade is facade), 'EXACT_ORIGINAL_FOCUS_BINDING_FACADE_FUSE')
        record['bindingReused'] = record['clockReused'] = record['facadeReused'] = True
        record['result'] = c.focus_evidence.copy_data(operation.observe())
        c.need(operation._driver._binding is binding and operation._driver._api['monotonic'] is clock and (operation._driver._deadline == clock.snapshot()['deadline']), 'FOCUS_SAME_READINESS_DEADLINE')
    except BaseException as error:
        primary = error
    finally:
        getters = [('port', lambda: c.focus_evidence.copy_data(port.snapshot())), ('clockAfter', clock.snapshot)]
        if operation is not None:
            getters.insert(0, ('snapshot', lambda: c.focus_evidence.copy_data(operation.snapshot())))
        for name, getter in getters:
            try:
                record[name] = getter()
            except BaseException as error:
                if primary is None:
                    primary = error
                else:
                    secondary.append(dict(stage='focus-' + name + '-retention', errorType=type(error).__name__))
        if operation is not None:
            try:
                for error in operation.diagnostic_errors:
                    secondary.append(dict(stage='focus-diagnostic', errorType=type(error).__name__))
            except BaseException as error:
                if primary is None:
                    primary = error
                else:
                    secondary.append(dict(stage='focus-diagnostic-retention', errorType=type(error).__name__))
    if primary is not None:
        raise primary
    result = record['result']
    c.need(type(result) is dict and result.get('classification') == 'OWNED_FOCUSED_EDIT_OBSERVED' and (result.get('failed') is False) and (result.get('diagnosticErrorCount') == 0) and (not secondary), 'COMPLETE_FOCUS_REQUIRED_BEFORE_C1')
    c.focus_evidence.pre_c1_complete(record, c.k)
    proof['focusOrder'].append('FOCUS')
    return operation

def retain_focus_port_five_v2(port, proof, identities, settlements, forced, secondary):
    """Versioned cached-only retirement; no legacy Popen settlement is inferred."""
    if port is None:
        return
    normal = proof.get('directNormalExits', {}).get('electron')
    row = proof['directFocusPortRetirement'] = dict(kind='FIVE_ROLE_FOCUS_PORT_RETIREMENT_V2', stage='AFTER_ORIGINAL_CHILD_RETIREMENT_ATTEMPTS', samePortRetained=True, originalElectronIdentity=identities.get('electron'), originalExit=normal, originalEdgeOutcome=settlements.get('electron'), retirementConfirmed=False, cachedSnapshot=None, cachedReadbackStatus=None, scope='same strong cached-only port; direct original exit, Job, capture and resource joins')
    row['retirementConfirmed'] = c.direct_normal_exit_five_v2(normal, identities.get('electron')) and c.direct_edge_clean_five_v2(row['originalEdgeOutcome']) and (not forced)
    for name, getter in [('cachedSnapshot', port.snapshot), ('cachedReadbackStatus', port.readback_status)]:
        try:
            row[name] = c.focus_evidence.copy_data(getter())
        except BaseException as error:
            secondary.append(dict(stage='focus-port-after-retirement-' + name, errorType=type(error).__name__))

def retain_prefocus_ready_five_v2(ready, source, identity, ui, proof):
    """Validate the actual ready envelope before the unchanged public Pick timer."""
    c.focus_evidence.prefocus_ready(ready, source, identity, ui, c.k)
    proof['uiReady'] = c.focus_evidence.copy_data(ready)

def cancel_tail_five_v2(stack, facade, binding, clock, phase, proof, edges, settlements, forced, deadline, active_reader, live, secondary):
    """One canonical C1; positive provider/MAIN/UI and original-exit joins."""
    ui = {key: phase[key] for key in ['projectId', 'windowId', 'epoch']}
    identity = phase['identity']
    source = phase['sourceSha256']
    escape = None
    original = None
    try:
        live('electron')
        live('ui')
        proof['focusOrder'].append('C1')
        escape = stack.foreground.create_observed_escape_cancel(facade, binding, clock)
        proof['native'] = dict(cancelAnswer=escape.cancel())
        proof['clockAfterC1'] = clock.snapshot()
    except BaseException as error:
        original = error
        raise
    finally:
        if escape is not None:
            try:
                native = proof.setdefault('native', {})
                native['transport'] = escape.snapshot()
                native['foreground'] = escape.discovery_snapshot()
                for error in (*escape.secondary_errors, *escape.discovery_secondary_errors):
                    secondary.append(dict(stage='c1-diagnostic', error=c.describe(error)))
                if native['foreground'].get('diagnosticErrorCount') != 0:
                    secondary.append(dict(stage='c1-diagnostic-incomplete', error=dict(type='DiagnosticIncomplete')))
            except BaseException as error:
                if original is None:
                    raise
                secondary.append(dict(stage='c1-diagnostic-retention', error=c.describe(error)))
    native = proof['native']
    answer = native['cancelAnswer']
    dispatch = native['transport']
    c.need(type(answer) is dict and answer.get('inputSent') is True and (answer.get('physicalSuccess') is False) and (dispatch.get('attempted') is True) and (type(dispatch.get('rawCount')) is int) and (dispatch['rawCount'] == 2) and (dispatch.get('physicalSuccess') is False), 'CANONICAL_ONE_ESCAPE_DISPATCH')
    c.need(not secondary, 'C1_DIAGNOSTICS_ADVERSE')
    c.write_five_v2(c.OUT / 'native-cancel.json', native)
    live('electron')
    live('ui')
    c.publish_five_v2(c.OUT / 'cancel-issued.json', c.envelope('cancel-issued', **phase))
    cancelled = c.wait_file_five_v2(c.OUT / 'ui-cancelled.json', deadline)
    c.cancel.ui_cancelled(cancelled, c.PROBE, source, identity, ui)
    proof['uiCancelled'] = cancelled
    active = active_reader.read()
    proof['providerActiveHex'] = active.hex()
    proof['provider'] = c.route_evidence.active_cancel(active, proof['receiptBinding'], c.k, c.consumer)
    body = c.read_bytes_five_v2(c.ENDPOINT_JOURNAL, 65536)
    proof['endpointBodyHex'] = body.hex()
    proof['endpoint'] = c.cancel.endpoint_cancel(body, ui['epoch'])
    c.write_five_v2(c.OUT / 'provider-cancel-projection.json', proof['provider'])
    c.write_five_v2(c.OUT / 'endpoint-cancel-pair.json', proof['endpoint'])
    live('electron')
    live('ui')
    c.publish_five_v2(c.OUT / 'go-quit.json', c.envelope('go-quit', **phase))
    proof['directNormalExits'] = {}
    for name in ['ui', 'electron']:
        proof['directNormalExits'][name] = edges[name].wait_original_exit()
        c.write_five_v2(c.OUT / (name + '-exit-settlement.json'), proof['directNormalExits'][name])
        if name == 'ui':
            proof['ui'] = c.read_five_v2(c.OUT / 'ui-result.json')
            c.cancel.ui_final(proof['ui'], c.PROBE, source, identity, ui)
    for name in ['ui', 'electron']:
        edges[name].finalize(None, c.direct_pump_five_v2, time.sleep)
    for name in ['ui', 'electron']:
        settlements[name] = c.direct_edge_value_five_v2(edges[name], secondary)
    c.need(not secondary and (not forced) and all((c.direct_edge_clean_five_v2(value) for value in settlements.values())), 'DIRECT_NORMAL_CHILDREN_CAPTURE_AND_EMPTY_JOBS')
    proof['childrenQuiescent'] = True
    proof['receiptFiles'] = c.direct_receipt_files_five_v2(edges['electron'])
    artifacts = c.direct_retained_streams_five_v2(proof, edges['electron'])
    proof['closedReceipt'] = c.consumer.consume(artifacts['journal'], artifacts['stdout'], artifacts['stderr'], proof['receiptBinding'])
    c.route_evidence.receipt_complete(proof, identity, c.k, c.consumer, artifacts)
    proof['session'] = c.k.clean_close(c.read_five_v2(c.DATA / 'Recovery/sessions.json', 4 * 1024 * 1024), identity)
    final_endpoint = c.read_bytes_five_v2(c.ENDPOINT_JOURNAL, 65536)
    proof['endpointBodyHex'] = final_endpoint.hex()
    proof['endpoint'] = c.cancel.endpoint_cancel(final_endpoint, ui['epoch'])
    proof['cancelStatus'] = 'ADDRESS_FOCUS_CANCEL_DATA_COMPLETE'
    c.write_five_v2(c.OUT / 'normal-close-witnesses.json', dict(closedReceipt=proof['closedReceipt'], receiptFiles=proof['receiptFiles'], session=proof['session'], provider=proof['provider'], endpoint=proof['endpoint']))

def selected_route_five_v2():
    primary = None
    pointer_started = False
    pointer_acknowledged_at = None
    active_journal_reader = None
    route_state = dict(readinessStage='NOT_STARTED', topologyStage='NOT_REQUESTED_BY_CANCEL_ROUTE', readiness=None, attempt=None, capture=None)

    def guard():
        c.remaining_five_v2(deadline)
        live('electron')
        live('ui')
        c.need(not os.path.lexists(c.OUT / 'ui-adverse.json'), 'UI_WORKER_ADVERSE')

    def cache_absence(label, getter):
        captured = route_support.capture_absence(getter)
        if captured['errorPresent']:
            secondary.append(dict(stage=label + '-getter', errorType=type(captured['error']).__name__))
            return
        data = captured['data']
        if not (type(data) is dict and type(data.get('diagnosticErrorCount')) is int and (data['diagnosticErrorCount'] >= 0)):
            secondary.append(dict(stage=label + '-schema', errorType='InvalidAbsenceDiagnosticDTO'))
            return
        proof[label] = data
        if data['diagnosticErrorCount'] > 0:
            secondary.append(dict(stage=label + '-audit-incomplete', diagnosticErrorCount=data['diagnosticErrorCount']))

    def select_target():
        nonlocal primary, pointer_started, pointer_acknowledged_at, active_journal_reader
        guard()
        pick_started = time.monotonic()
        c.publish_five_v2(c.OUT / 'go-pick.json', c.envelope('go-pick', **phase))
        pointer = c.wait_file_five_v2(c.OUT / 'pointer-started.json', deadline)
        c.need(pointer.get('probe') == c.PROBE and pointer.get('stage') == 'pointer-started' and (pointer.get('sourceSha256') == source) and c.k.exact(pointer.get('identity'), identity) and all((pointer.get(k) == v for k, v in ui.items())), 'ONE_POINTER_INTENT_ONLY')
        pointer_started = True
        pointer_acknowledged_at = time.monotonic()
        active_journal_reader = prefix_reader.PrefixReader(c.JOURNAL, maximum=32768)
        rows = []
        while len(rows) < 2:
            guard()
            c.need(time.monotonic() - pick_started < 5, 'PUBLIC_PICKER_BUDGET_PRE_BOUNDARY')
            if os.path.lexists(c.JOURNAL):
                rows = c.k.journal_prefix(active_journal_reader.read())
            if len(rows) < 2:
                time.sleep(0.005)
        hwnd = c.k.picker_boundary(rows, identity['pid'], ui, facade.pointer_bits)
        live('electron')
        parent = apis['electron'].window(hwnd)
        c.need(type(parent) is stack.model.Window and parent.pid == identity['pid'] and (parent.hwnd == hwnd) and (parent.visible is True), 'ACTUAL_HELD_MAIN_PARENT')
        binding = stack.model.Binding(edges['electron'].original_process_handle(), identity['pid'], identity['image'], identity['createdFileTime'], hwnd, parent.tid, parent.class_name)
        clock = stack.clock.create_dialog_clock()

        def public_remaining():
            guard()
            left = 5 - (time.monotonic() - pick_started)
            c.need(left > 0, 'PUBLIC_PICKER_BUDGET_READINESS')
            return left
        readiness = stack.readiness.OwnedDialogReadiness(apis['electron'], binding, clock, public_remaining, time.sleep)
        route_state['readiness'] = readiness
        attempt = retention.ReadinessAttempt(readiness)
        route_state['attempt'] = attempt
        route_state['readinessStage'] = 'CALL'

        def remember_original(error):
            nonlocal primary
            if primary is None:
                primary = error
        captured = route_support.capture_readiness(attempt, remember_original)
        route_state['capture'] = captured
        route_state['readinessStage'] = 'RAISED' if captured['primaryPresent'] else 'RETURNED'
        cache_absence('readinessAbsences', lambda: readiness.enumeration_absence_snapshot())
        for row in captured['secondary']:
            secondary.append(dict(stage=row['stage'], errorType=type(row['reason']).__name__))
        if captured['primaryPresent']:
            raise captured['primaryReason']
        c.need(captured['resultPresent'], 'READINESS_OUTCOME_REQUIRED')
        proof['readiness'] = captured['result']
        proof['fullTopology'] = dict(status='NOT_REQUESTED_BY_CANCEL_ROUTE', scope='No two-pass descendant qualification; canonical C1 independently discovers and guards its current owned dialog')
        return (binding, clock)
    binding, clock = select_target()
    proof['receiptBinding'] = dict(mainPid=identity['pid'], projectId=ui['projectId'], windowId=ui['windowId'], epoch=ui['epoch'], pointerBits=facade.pointer_bits, parentHwnd=binding.parent_hwnd)
    proof['originalBinding'] = dict(originalHandleDecimal=str(binding.original_handle), pid=binding.pid, image=binding.image, createdFileTime=binding.created_filetime, parentHwndDecimal=str(binding.parent_hwnd), parentTid=binding.parent_tid, parentClass=binding.parent_class)
    proof['focusOrder'] = ['READINESS']
    focus_operation = observe_focus_five_v2(stack, facade, focus_port, binding, clock, identities['inner'], proof, secondary)
    cancel_tail_five_v2(stack, facade, binding, clock, phase, proof, edges, settlements, forced, deadline, active_journal_reader, live, secondary)
    return dict(binding=binding, clock=clock, focus_operation=focus_operation, route_state=route_state, active_journal_reader=active_journal_reader)

def _five_inner_result_producer_v2():
    global primary, result
    for name in ['ui', 'electron']:
        settlements[name] = c.direct_edge_value_five_v2(edges.get(name), secondary)
    retain_focus_port_five_v2(focus_port, proof, identities, settlements, forced, secondary)
    result = c.envelope('cancel-inner-five-role-complete' if primary is None and (not secondary) and (not forced) and all((c.direct_edge_clean_five_v2(value) for value in settlements.values())) else 'cancel-inner-five-role-adverse', schema=1, kind='SIREN_FIVE_ROLE_INNER_RESULT_V2', sourceSha256=source, primaryPresent=primary is not None, primary=None if primary is None else c.describe(primary), secondary=secondary, forced=forced, identities=identities, edgeOutcomes=settlements, proof=proof, scope='one initial-null genuine Cancel then normal Quit; positive MAIN projection is not raw renderer receipt; any forced retirement adverse')
    if result['stage'] == 'cancel-inner-five-role-complete':
        try:
            c.need(c.inner_direct_completion_five_v2(result, source, identities['inner'], edges), 'FULL_DIRECT_INNER_COMPLETION')
        except BaseException as error:
            primary = error
            result.update(stage='cancel-inner-five-role-adverse', primaryPresent=True, primary=c.describe(error))
    try:
        c.write_five_v2(c.OUT / 'inner-result.json', result)
    except BaseException as error:
        if primary is None:
            primary = error
        result.update(stage='cancel-inner-five-role-adverse', primaryPresent=True, primary=c.describe(primary))
        secondary.append(dict(stage='inner-result-retention', error=c.describe(error)))
        print(json.dumps(c.envelope('inner-retention-adverse', primary=result['primary'], secondary=secondary)), file=sys.stderr, flush=True)

def _run_five_business_inner_v2():
    global primary, result, _five_inner_attempt
    c.need(not globals().get('_five_inner_attempt', False), 'FIVE_INNER_TRANSACTION_ONCE')
    _five_inner_attempt = True
    primary = None
    try:
        selected_route_five_v2()
    except BaseException as error:
        primary = error
    finally:
        for name in ('ui', 'electron'):
            try:
                edges[name].finalize(primary, c.direct_pump_five_v2, time.sleep)
            except BaseException as error:
                if primary is None:
                    primary = error
                else:
                    secondary.append(dict(stage='five-original-finalization', error=c.describe(error)))
        _five_inner_result_producer_v2()
    return result
