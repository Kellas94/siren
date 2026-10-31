"""Pure bounded focused-Edit/native/identity/Fuse/retirement joins. No IO."""
import math,re,json

KEYS=(27,16,17,18,160,161,162,163,164,165,91,92,76,13)
STYLE_MASK=0x56830180
def need(value,reason):
 if not value:raise ValueError(reason)
def copy_data(value,depth=0,budget=None):
 if budget is None:budget=[8192]
 budget[0]-=1;need(budget[0]>=0 and depth<=12,'FOCUS_RETAINED_DATA_BOUND');t=type(value)
 if value is None or t in (bool,int):return value
 if t is float:need(math.isfinite(value),'FOCUS_FINITE_DATA');return value
 if t is str:need(len(value)<=1024,'FOCUS_STRING_BOUND');return value
 if t in (tuple,list):need(len(value)<=512,'FOCUS_SEQUENCE_BOUND');return [copy_data(v,depth+1,budget) for v in value]
 need(t is dict and len(value)<=64 and all(type(k) is str and len(k)<=128 for k in value),'FOCUS_DATA_ONLY')
 return {k:copy_data(v,depth+1,budget) for k,v in value.items()}
def closed(value,names):need(type(value) is dict and set(value)==set(names),'FOCUS_CLOSED_DTO')
def integer(value,lo,hi):return type(value) is int and lo<=value<=hi
def number(value):return type(value) in (int,float) and math.isfinite(value)

def prefocus_ready(ready,source,identity,ui,contracts):
 """Closed preparation evidence only; never proves native foreground."""
 closed(ready,('probe','stage','sourceSha256','identity','projectId','windowId','epoch','before','prefocus','scope'))
 need(ready['probe']=='siren-ordinary-picker-cancel-v1' and ready['stage']=='ui-ready' and type(source) is str and re.fullmatch('[a-f0-9]{64}',source) is not None and ready['sourceSha256']==source and contracts.exact(ready['identity'],identity),'PREFOCUS_READY_ORIGINAL_IDENTITY')
 def ident(v):return type(v) is str and re.fullmatch('[A-Za-z0-9_-]{1,128}',v) is not None
 need(type(ui) is dict and set(ui)=={'projectId','windowId','epoch'} and ident(ui['projectId']) and type(ui['windowId']) is str and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',ui['windowId']) is not None and integer(ui['epoch'],1,9007199254740991),'PREFOCUS_READY_UI_LABELS')
 need(all(type(ready[k]) is type(v) and ready[k]==v for k,v in ui.items()),'PREFOCUS_READY_SAME_UI')
 need(ready['scope']=='provider-and-DOM plus existing workspace focus API ACK only; no OS foreground proof','PREFOCUS_READY_SCOPE')
 p=ready['prefocus'];closed(p,('schema','phase','status','reserved','requestStarted','requestReturned','primaryPresent','workspaceBefore','workspaceAfter','targetBefore','targetAfter','terminalBefore','terminalAfter','request','reply','scope','osForegroundProved','nativeDialogForegroundProved','comparisonWithFutureModal'))
 need(type(p['schema']) is int and p['schema']==1 and p['phase']=='workspace-terminal-prefocus' and p['status']=='COMPLETE' and all(p[k] is True for k in ('reserved','requestStarted','requestReturned')) and p['primaryPresent'] is False,'PREFOCUS_ONE_COMPLETE_ATTEMPT')
 need(p['scope']=='EXISTING_WORKSPACE_WINDOW_FOCUS_API_ACK_ONLY' and p['osForegroundProved'] is False and p['nativeDialogForegroundProved'] is False and p['comparisonWithFutureModal']=='UNKNOWN','PREFOCUS_ACK_ONLY_LIMITS')
 closed(p['request'],('windowId',));need(type(p['request']['windowId']) is str and p['request']['windowId']==ui['windowId'],'PREFOCUS_EXACT_REQUEST')
 closed(p['reply'],('ok','focused'));need(p['reply']['ok'] is True and p['reply']['focused'] is True,'PREFOCUS_EXACT_ACK')
 for side in ('Before','After'):
  w=p['workspace'+side];closed(w,('webContentsId','mainFrameUrl','windowId','role','projectId','epoch'))
  need(integer(w['webContentsId'],1,9007199254740991) and w['role']=='workspace' and w['mainFrameUrl']=='siren://app/app.html' and ident(w['windowId']) and w['windowId']!=ui['windowId'] and w['projectId']==ui['projectId'] and type(w['projectId']) is str and type(w['epoch']) is int and w['epoch']==ui['epoch'],'PREFOCUS_CURRENT_WORKSPACE')
  t=p['target'+side];closed(t,('windowId','role','projectId','epoch','entityId','state'))
  need(type(t['windowId']) is str and t['windowId']==ui['windowId'] and t['role']=='terminal' and type(t['projectId']) is str and t['projectId']==ui['projectId'] and type(t['epoch']) is int and t['epoch']==ui['epoch'] and ident(t['entityId']) and t['state'] in ('active','minimized'),'PREFOCUS_SCOPED_TARGET')
  x=p['terminal'+side];closed(x,('url','roots','busy','folder','status','createDisabled','folderDisabled','context','terminalWebContentsId','terminalWebContentsIdStatus','urlBasis'))
  need(x['url']=='siren://app/windows/terminal.html?windowId='+ui['windowId'] and type(x['roots']) is int and x['roots']==1 and x['busy'] is False and x['folder']=='No folder selected.' and type(x['status']) is str and len(x['status'].encode('utf-16-le','surrogatepass'))//2<2048 and x['createDisabled'] is True and x['folderDisabled'] is False,'PREFOCUS_NULL_UI')
  closed(x['context'],('windowId','role','projectId','epoch','mode','access','available'))
  need(contracts.exact(x['context'],dict(ui,role='terminal',mode='normal',access='write',available=True)) and x['terminalWebContentsId'] is None and x['terminalWebContentsIdStatus']=='UNKNOWN_NOT_EXPOSED' and x['urlBasis']=='PREPARED_UNIQUE_CDP_TARGET_URL','PREFOCUS_REPORTED_TERMINAL_CONTEXT')
 need(contracts.exact(p['workspaceBefore'],p['workspaceAfter']) and all(type(p['targetBefore'][k]) is type(p['targetAfter'][k]) and p['targetBefore'][k]==p['targetAfter'][k] for k in ('windowId','role','projectId','epoch','entityId')),'PREFOCUS_SAME_BEFORE_AFTER')
 names=('url','roots','busy','folder','status','createDisabled','folderDisabled');closed(ready['before'],names)
 need(contracts.exact(ready['before'],{k:p['terminalBefore'][k] for k in names}),'PREFOCUS_READY_DOM_JOIN')
 need(len(json.dumps(p,ensure_ascii=True,separators=(',',':')).encode('utf8'))<=16384,'PREFOCUS_RECEIPT_BYTE_BOUND')
 return True

def prefocus_complete(proof,identity,source,contracts):
 phase=proof['phase'];ui={k:phase[k] for k in ('projectId','windowId','epoch')}
 prefocus_ready(proof['uiReady'],source,identity,ui,contracts)
 need(contracts.exact(proof['ui']['prefocus'],proof['uiReady']['prefocus']),'PREFOCUS_READY_FINAL_SAME_CACHED_RECEIPT')
 return True
def window(value):
 closed(value,('hwnd','pid','tid','class_name','owner','visible','enabled'))
 need(integer(value['hwnd'],1,(1<<64)-7) and value['hwnd']!=0xffff and integer(value['pid'],1,(1<<32)-1) and integer(value['tid'],1,(1<<32)-1) and integer(value['owner'],0,(1<<64)-7),'FOCUS_WINDOW_SCALARS')
 need(type(value['class_name']) is str and 0<len(value['class_name'])<256 and value['visible'] is True and value['enabled'] is True,'FOCUS_VISIBLE_ENABLED_WINDOW')
def transport(value):
 closed(value,('transportReturn','messageResult','lastError'))
 need(integer(value['transportReturn'],-(1<<63),(1<<63)-1) and value['transportReturn']!=0 and integer(value['messageResult'],0,(1<<64)-1) and type(value['lastError']) is int and value['lastError']==0,'FOCUS_TRANSPORT_SUCCESS')
def clock(value,before):
 closed(value,('start','deadline','last','failed'))
 need(value['failed'] is False and all(number(value[k]) for k in ('start','deadline','last')) and value['start']==before['start'] and value['deadline']==before['deadline'] and value['deadline']-value['start']==10.0 and value['start']<=value['last']<value['deadline'],'FOCUS_ORIGINAL_SAME_FUSE')

def history_complete(r,before,after,identity,rb,contracts):
 n=r['acquisitionSamples'];history=r['guardHistory'];pre=r['preFocusedChild'];dialog=r['preDialog'];child=r['focusedEdit']
 need(integer(n,2,16) and r['acquisitionComplete'] is True,'FOCUS_ACQUISITION_COMPLETE_COUNT')
 need(type(history) is list and len(history)==n+5 and len(history)<=24,'FOCUS_EXACT_GUARD_HISTORY_COUNT')
 window(pre);need(pre['pid']==dialog['pid'] and pre['tid']==dialog['tid'] and pre['hwnd']!=rb['parentHwnd'],'FOCUS_CANONICAL_PRE_FOCUS')
 closed(r['acquiredLease'],('dialog','focus'))
 need(contracts.exact(r['acquiredLease'],dict(dialog=dialog,focus=child)) and child['hwnd']!=pre['hwnd'],'FOCUS_DISTINCT_ACQUIRED_LEASE')
 last=before['last'];previous=None;paired=False
 stages=['pre-dispatch']+['acquire']*n+['before-eligibility']+['current-edit']*3
 for index,(row,stage) in enumerate(zip(history,stages)):
  closed(row,('ordinal','stage','sampleBefore','sampleAfter','guardReturned','dialog','focus','factsComplete','readiness'))
  need(type(row['ordinal']) is int and row['ordinal']==index+1 and row['stage']==stage and row['guardReturned'] is True and row['factsComplete'] is True,'FOCUS_COMPLETE_GUARD_HISTORY_ROW')
  d=row['dialog'];f=row['focus'];window(d);window(f)
  need(contracts.exact(d,dialog) and f['pid']==d['pid'] and f['tid']==d['tid'] and f['hwnd']!=rb['parentHwnd'],'FOCUS_HISTORY_ORIGINAL_DIALOG_AND_OWNED_FOCUS')
  start=row['sampleBefore'];end=row['sampleAfter']
  need(number(start) and number(end) and last<=start<=end<=after['last'] and before['start']<=start and end<before['deadline'],'FOCUS_HISTORY_CACHED_FUSE_ORDER');last=end
  if index==0:
   need(contracts.exact(f,pre) and row['readiness']=='NOT_EVALUATED' and end==r['sampleBeforeDispatch'],'FOCUS_PRE_DISPATCH_HISTORY_JOIN')
  elif index<=n:
   if f['hwnd']==pre['hwnd']:expected='OLD_FOCUS';previous=None
   elif f['class_name']!='Edit' or f['hwnd']==d['hwnd']:expected='NON_EDIT';previous=None
   else:
    current=dict(dialog=d,focus=f)
    if previous is not None and contracts.exact(current,previous):
     expected='PAIR_COMPLETE';need(index==n and not paired,'FOCUS_NO_EARLY_OR_REPEATED_PAIR');paired=True
     need(contracts.exact(current,r['acquiredLease']),'FOCUS_LAST_PAIR_LEASE_JOIN')
    else:expected='CANDIDATE';previous=current
   need(row['readiness']==expected,'FOCUS_RECOMPUTED_CONSECUTIVE_READINESS')
  else:
   need(row['readiness']=='NOT_EVALUATED' and contracts.exact(f,child),'FOCUS_NO_POST_ACQUISITION_REACQUIRE')
 need(paired,'FOCUS_CONSECUTIVE_PAIR_REQUIRED')
 # Couple cached guard chronology to the existing two bounded message timestamps.
 text,selection=r['readTimeouts']
 need(history[n+2]['sampleAfter']<=text['sample']<=history[n+3]['sampleBefore'] and history[n+3]['sampleAfter']<=selection['sample']<=history[n+4]['sampleBefore'],'FOCUS_GUARD_MESSAGE_ORDER')
 return True

def provenance_complete(r,contracts):
 # Canonical FolderDialogDriver._guard ends with gui_focus_window, whose
 # strict_window observes the GUI-focused child through the captured adapter.
 # Adapter.window checks IsWindow before/after each of its two observations.
 q=r['windowQueryProvenance'];history=r['guardHistory']
 closed(q,('version','coverage','guards','activeGuard','diagnosticErrorCount','pendingDiagnosticCount','diagnosticErrorsDropped','fullQueryTraceProved','windowLifetimeProved'))
 need(type(q['version']) is int and q['version']==2 and q['coverage']=='LAST_WINDOW_CALL_PER_GUARD_ONLY' and q['activeGuard'] is None and q['fullQueryTraceProved'] is False and q['windowLifetimeProved'] is False,'FOCUS_QUERY_HONEST_CLOSED_COMPLETE')
 need(all(type(q[k]) is int and q[k]==0 for k in ('diagnosticErrorCount','pendingDiagnosticCount','diagnosticErrorsDropped')),'FOCUS_QUERY_NO_PENDING_DIAGNOSTICS')
 guards=q['guards'];need(type(history) is list and 1<=len(history)<=24 and type(guards) is list and len(guards)==len(history),'FOCUS_QUERY_EXACT_GUARD_COUNT')
 for index,(g,h) in enumerate(zip(guards,history)):
  closed(h,('ordinal','stage','sampleBefore','sampleAfter','guardReturned','dialog','focus','factsComplete','readiness'))
  need(type(h['ordinal']) is int and h['ordinal']==index+1 and type(h['stage']) is str and 0<len(h['stage'])<=64 and h['guardReturned'] is True and h['factsComplete'] is True and number(h['sampleBefore']) and number(h['sampleAfter']) and h['sampleBefore']<=h['sampleAfter'],'FOCUS_QUERY_COMPLETE_CANONICAL_GUARD_BASIS')
  window(h['dialog']);window(h['focus'])
  closed(g,('guardOrdinal','stage','sampleBefore','sampleAfter','canonicalReturned','windowCalls','omittedWindowCalls','lastCall','diagnosticsComplete','diagnosticErrorCount','truncated','callerBranch','coverage'))
  need(type(g['guardOrdinal']) is int and g['guardOrdinal']==h['ordinal'] and type(g['stage']) is str and g['stage']==h['stage'] and number(g['sampleBefore']) and number(g['sampleAfter']) and contracts.exact(g['sampleBefore'],h['sampleBefore']) and contracts.exact(g['sampleAfter'],h['sampleAfter']),'FOCUS_QUERY_EXACT_CACHED_GUARD_JOIN')
  need(g['canonicalReturned'] is True and g['diagnosticsComplete'] is True and type(g['diagnosticErrorCount']) is int and g['diagnosticErrorCount']==0 and g['truncated'] is False and g['callerBranch']=='UNKNOWN' and g['coverage']=='LAST_WINDOW_CALL_ONLY','FOCUS_QUERY_COMPLETE_LAST_ONLY')
  calls=g['windowCalls'];omitted=g['omittedWindowCalls']
  need(type(calls) is int and calls>0 and type(omitted) is int and omitted==calls-1,'FOCUS_QUERY_EXACT_LAST_CALL_COUNTERS')
  last=g['lastCall'];closed(last,('callOrdinal','requestedHwnd','reserved','callStarted','returned','raised','resultKind','window','factsComplete','isWindowCalls','isWindow','scalarTruncated','callerBranch'))
  need(type(last['callOrdinal']) is int and last['callOrdinal']==calls and type(last['requestedHwnd']) is int and last['requestedHwnd']==h['focus']['hwnd'] and all(last[k] is True for k in ('reserved','callStarted','returned','factsComplete')) and last['raised'] is False and last['scalarTruncated'] is False and last['resultKind']=='WINDOW' and last['callerBranch']=='UNKNOWN','FOCUS_QUERY_LAST_CALL_BOUNDARY_AND_CONTEXT')
  window(last['window']);need(contracts.exact(last['window'],h['focus']),'FOCUS_QUERY_LAST_EXACT_FOCUS_FACTS')
  scalars=last['isWindow'];need(type(last['isWindowCalls']) is int and last['isWindowCalls']==4 and type(scalars) is list and len(scalars)==4,'FOCUS_QUERY_FOUR_EXISTING_ISWINDOW_CALLS')
  for ordinal,row in enumerate(scalars,1):
   closed(row,('ordinal','hwnd','callStarted','returned','raised','value'))
   need(type(row['ordinal']) is int and row['ordinal']==ordinal and type(row['hwnd']) is int and row['hwnd']==last['requestedHwnd'] and row['callStarted'] is True and row['returned'] is True and row['raised'] is False and row['value'] is True,'FOCUS_QUERY_EXACT_ISWINDOW_SCALAR')
 return True

def prior_window_data(value,foreground,ordinal):
 """Closed diagnostic DATA, including adverse outcomes; never action authority."""
 closed(value,('version','coverage','status','guardOrdinal','intakeSealed','windowCallsAtForeground','distinctKeys','omittedCalls','queryActiveObservationCount','matchedHwnd','firstOrdinal','lastOrdinal','observationCount','duplicateCount','conflict','incomplete','priorWindow','captureComplete','windowLifetimeProved','currentOwnership','actor','directComparisonProved'))
 need(type(value['version']) is int and value['version']==1 and value['coverage']=='PRE_FOREGROUND_ONLY','PRIOR_WINDOW_PROTOCOL')
 need(type(value['guardOrdinal']) is int and value['guardOrdinal']==ordinal and integer(ordinal,1,24) and value['intakeSealed'] is True,'PRIOR_WINDOW_GUARD_AND_SEAL')
 need(value['windowLifetimeProved'] is False and value['directComparisonProved'] is False and value['currentOwnership']=='UNKNOWN' and value['actor']=='UNKNOWN','PRIOR_WINDOW_NO_AUTHORITY')
 for key in ('windowCallsAtForeground','distinctKeys','omittedCalls','queryActiveObservationCount','observationCount','duplicateCount'):
  need(type(value[key]) is int and value[key]>=0,'PRIOR_WINDOW_EXACT_COUNTERS')
 for key in ('conflict','incomplete','captureComplete'):need(type(value[key]) is bool,'PRIOR_WINDOW_EXACT_BOOL')
 calls=value['windowCallsAtForeground'];keys=value['distinctKeys'];omitted=value['omittedCalls'];count=value['observationCount'];dups=value['duplicateCount']
 need(omitted==max(0,calls-4129) and keys<=min(4129,calls-omitted),'PRIOR_WINDOW_BOUNDED_INTAKE')
 if value['captureComplete']:need(omitted==0 and value['queryActiveObservationCount']==0 and (calls==0 or keys>0),'PRIOR_WINDOW_COMPLETE_CAPTURE')
 status=value['status'];need(type(status) is str and status in ('MATCH','MISS','NULL_HANDLE','CONFLICT','INCOMPLETE_OBSERVATION','UNSUPPORTED_RETURN'),'PRIOR_WINDOW_STATUS')
 present=status in ('MATCH','CONFLICT','INCOMPLETE_OBSERVATION')
 if status=='NULL_HANDLE':need(type(foreground) is int and foreground==0 and value['matchedHwnd'] is None,'PRIOR_WINDOW_NULL_RETURN')
 elif status=='UNSUPPORTED_RETURN':need(foreground is None and value['matchedHwnd'] is None,'PRIOR_WINDOW_UNSUPPORTED_RETURN')
 else:need(integer(foreground,1,(1<<64)-1) and type(value['matchedHwnd']) is int and value['matchedHwnd']==foreground,'PRIOR_WINDOW_ORIGINAL_RETURN_JOIN')
 if present:
  first=value['firstOrdinal'];last=value['lastOrdinal']
  need(integer(first,1,min(calls,4129)) and integer(last,first,min(calls,4129)) and 1<=count<=last-first+1 and count<=calls-omitted-keys+1 and dups==count-1 and keys>=1,'PRIOR_WINDOW_ENTRY_COUNTS')
  need((count==1 and first==last) or (count>1 and first<last),'PRIOR_WINDOW_ENTRY_ORDER')
 else:
  need(value['firstOrdinal'] is None and value['lastOrdinal'] is None and count==dups==0 and value['priorWindow'] is None and value['conflict'] is False and value['incomplete'] is False,'PRIOR_WINDOW_MISSING_ENTRY_FORM')
 if status=='CONFLICT':need(value['conflict'] is True and count>=2 and value['priorWindow'] is None,'PRIOR_WINDOW_CONFLICT')
 elif status=='INCOMPLETE_OBSERVATION':need(value['conflict'] is False and value['incomplete'] is True and value['priorWindow'] is None,'PRIOR_WINDOW_INCOMPLETE_OBSERVATION')
 elif status=='MATCH':
  need(value['conflict'] is False and value['incomplete'] is False,'PRIOR_WINDOW_MATCH_FLAGS')
  if value['captureComplete']:
   w=value['priorWindow'];closed(w,('hwnd','pid','tid','class_name','owner','visible','enabled'))
   need(all(integer(w[k],1,(1<<64)-1) for k in ('hwnd','pid','tid')) and integer(w['owner'],0,(1<<64)-1) and w['hwnd']==foreground,'PRIOR_WINDOW_PRODUCER_UINT64_FACTS')
   need(type(w['class_name']) is str and 0<len(w['class_name'])<=512 and type(w['visible']) is bool and type(w['enabled']) is bool,'PRIOR_WINDOW_PRODUCER_CLASS_AND_FLAGS')
  else:need(value['priorWindow'] is None,'PRIOR_WINDOW_FAILED_CAPTURE_REDACTION')
 return True

def foreground_complete(r,contracts):
 # Canonical _guard calls _observe, then compares its original adapter
 # foreground return with that modal dialog HWND, before querying child focus.
 # Expected context remains cached/source-qualified, never a local operand.
 q=r['foregroundQueryProvenance'];history=r['guardHistory']
 closed(q,('version','coverage','guards','activeGuard','diagnosticErrorCount','pendingDiagnosticCount','diagnosticErrorsDropped','expectedBasisInvariant','directLocalOperandCaptured','comparisonEvaluated','actor','foregroundOwnership'))
 need(type(q['version']) is int and q['version']==2 and q['coverage']=='ONE_ORIGINAL_ADAPTER_FOREGROUND_RETURN_PER_GUARD' and q['activeGuard'] is None,'FOCUS_FG_CLOSED_COMPLETE_SCHEMA')
 need(all(type(q[k]) is int and q[k]==0 for k in ('diagnosticErrorCount','pendingDiagnosticCount','diagnosticErrorsDropped')),'FOCUS_FG_NO_PENDING_DIAGNOSTICS')
 need(q['expectedBasisInvariant']=='ONLY_CANONICAL_OBSERVE_WRITES_CAPTURED' and q['directLocalOperandCaptured'] is False and all(q[k]=='UNKNOWN' for k in ('comparisonEvaluated','actor','foregroundOwnership')),'FOCUS_FG_HONEST_CACHED_BASIS')
 guards=q['guards'];need(type(history) is list and 1<=len(history)<=24 and type(guards) is list and len(guards)==len(history),'FOCUS_FG_EXACT_GUARD_COUNT')
 for index,(g,h) in enumerate(zip(guards,history)):
  closed(g,('guardOrdinal','stage','sampleBefore','sampleAfter','canonicalReturned','foregroundCalls','foreground','status','diagnosticsComplete','diagnosticErrorCount'))
  need(type(g['guardOrdinal']) is int and g['guardOrdinal']==index+1==h['ordinal'] and type(g['stage']) is str and g['stage']==h['stage'] and number(g['sampleBefore']) and number(g['sampleAfter']) and contracts.exact(g['sampleBefore'],h['sampleBefore']) and contracts.exact(g['sampleAfter'],h['sampleAfter']),'FOCUS_FG_CACHED_GUARD_HISTORY_JOIN')
  need(g['canonicalReturned'] is True and g['diagnosticsComplete'] is True and type(g['diagnosticErrorCount']) is int and g['diagnosticErrorCount']==0 and type(g['foregroundCalls']) is int and g['foregroundCalls']==1 and g['status']=='RETURNED','FOCUS_FG_ONE_COMPLETE_ADAPTER_RETURN')
  row=g['foreground'];closed(row,('ordinal','reserved','contextStarted','contextReturned','expectedStatus','expectedHwnd','pointerBits','queryStarted','queryReturned','queryRaised','returnStatus','foregroundHwnd','returnBasis','expectedBasis','directLocalOperandCaptured','comparisonEvaluated','actor','foregroundOwnership','priorWindowJoin'))
  need(type(row['ordinal']) is int and row['ordinal']==1 and all(row[k] is True for k in ('reserved','contextStarted','contextReturned','queryStarted','queryReturned')) and row['queryRaised'] is False and row['expectedStatus']=='CACHED' and row['returnStatus']=='HWND','FOCUS_FG_EXACT_COMPLETED_FLAGS')
  bits=row['pointerBits'];expected=row['expectedHwnd'];actual=row['foregroundHwnd'];dialog=h['dialog'];window(dialog)
  need(type(bits) is int and bits in (32,64) and integer(expected,1,(1<<bits)-1) and type(actual) is int and actual==expected==dialog['hwnd'],'FOCUS_FG_ORIGINAL_MODAL_NOT_CHILD')
  need(row['returnBasis']=='ORIGINAL_ADAPTER_FOREGROUND_RETURN' and row['expectedBasis']=='CANONICAL_CAPTURED_HWND_BEFORE_FOREGROUND' and row['directLocalOperandCaptured'] is False and all(row[k]=='UNKNOWN' for k in ('comparisonEvaluated','actor','foregroundOwnership')),'FOCUS_FG_NO_CAUSAL_OR_OPERAND_AUTHORITY')
  joined=row['priorWindowJoin'];prior_window_data(joined,actual,index+1)
  # Source consistency only: _foreground_context requires candidate==chain[0],
  # and canonical foreground equality identifies that modal. The one subsequent
  # Window call is the focused child, including when child==dialog.
  need(joined['status']=='MATCH' and joined['captureComplete'] is True and contracts.exact(joined['priorWindow'],dialog),'FOCUS_PRIOR_WINDOW_POSITIVE_MODAL_MATCH')
  need(joined['observationCount']>=2 and joined['windowCallsAtForeground']>=3,'FOCUS_PRIOR_WINDOW_ENUM_AND_CHAIN_OBSERVATIONS')
  need(joined['windowCallsAtForeground']==r['windowQueryProvenance']['guards'][index]['windowCalls']-1,'FOCUS_PRIOR_WINDOW_ONE_POST_FOREGROUND_CHILD')
 return True

def pre_c1_complete(record,contracts):
 # Cached DTO validation only. Final completion additionally requires C1,
 # original process retirement and closed journals, unavailable at this boundary.
 r=record['result'];snapshot=record['snapshot']
 need(type(r) is dict and contracts.exact(r,snapshot),'FOCUS_FINAL_CACHE_BEFORE_C1')
 need(type(r.get('version')) is int and r['version']==6 and r.get('classification')=='OWNED_FOCUSED_EDIT_OBSERVED' and r.get('failed') is False and type(r.get('diagnosticErrorCount')) is int and r['diagnosticErrorCount']==0,'FOCUS_COMPLETE_RESULT_BEFORE_C1')
 provenance_complete(r,contracts)
 return foreground_complete(r,contracts)

def _focus_observation_complete(proof,identity,controller_identity,contracts):
 f=proof['focus'];r=f['result'];p=f['port'];b=proof['originalBinding'];rb=proof['receiptBinding']
 closed(f,('controllerIdentity','binding','clockBefore','clockAfter','result','snapshot','port','bindingReused','clockReused','facadeReused','membershipBasis','membershipIndependentlyRetained'))
 need(contracts.exact(f['controllerIdentity'],controller_identity) and all(f[k] is True for k in ('bindingReused','clockReused','facadeReused')) and contracts.exact(f['binding'],b),'FOCUS_ORIGINAL_CONTEXT_REUSED')
 need(f['membershipBasis']=='CANONICAL_GUARD_DESCENDANT_CHECK' and f['membershipIndependentlyRetained'] is False,'FOCUS_HONEST_MEMBERSHIP_BASIS')
 ready=proof['readiness'];closed(ready,('ready','candidateHwnd','samples'))
 need(ready['ready'] is True and integer(ready['candidateHwnd'],1,(1<<64)-7) and integer(ready['samples'],1,128),'FOCUS_CURRENT_READINESS')
 closed(b,('originalHandleDecimal','pid','image','createdFileTime','parentHwndDecimal','parentTid','parentClass'))
 need(integer(b['pid'],1,(1<<32)-1) and integer(b['parentTid'],1,(1<<32)-1) and type(b['parentClass']) is str and 0<len(b['parentClass'])<256 and b['pid']==identity['pid'] and b['image']==identity['image'] and b['createdFileTime']==identity['createdFileTime'] and b['parentHwndDecimal']==str(rb['parentHwnd']),'FOCUS_HELD_BINDING')
 need(type(b['originalHandleDecimal']) is str and re.fullmatch('[1-9][0-9]{0,19}',b['originalHandleDecimal']) is not None and 0<int(b['originalHandleDecimal'])<2**64,'FOCUS_ORIGINAL_HANDLE')
 need(contracts.exact(r,f['snapshot']),'FOCUS_FINAL_CORE_SNAPSHOT')
 closed(r,('version','attempted','failed','classification','reportedControllerPid','preKeys','postKeys','zeroKeyStateUncertainty','modifierStateMayBeAltered','conclusiveGlobalKeyReleaseProved','dispatchStarted','shortcut','shortcutStatus','sampleBeforeDispatch','preDialog','preFocusedChild','guardHistory','acquisitionSamples','acquiredLease','acquisitionComplete','focusedEdit','finalFocusedEdit','eligibilities','textTransport','selectionTransport','selection','text','units','readbackStatus','readTimeouts','diagnosticErrorCount','addressRole','committedShellLocationProved','pathAuthority','confirmationQualified','selectionSamplesAtomic','physicalInputProved','windowQueryProvenance','foregroundQueryProvenance'))
 need(type(r['version']) is int and r['version']==6 and r['attempted'] is True and r['failed'] is False and r['classification']=='OWNED_FOCUSED_EDIT_OBSERVED' and integer(r['reportedControllerPid'],1,(1<<32)-1) and r['reportedControllerPid']==controller_identity['pid']!=identity['pid'],'FOCUS_COMPLETE_ACTUAL_INNER')
 need(r['addressRole']=='UNKNOWN' and r['modifierStateMayBeAltered'] is True and r['dispatchStarted'] is True and type(r['diagnosticErrorCount']) is int and r['diagnosticErrorCount']==0,'FOCUS_HONEST_RESULT')
 for key in ('conclusiveGlobalKeyReleaseProved','committedShellLocationProved','pathAuthority','confirmationQualified','selectionSamplesAtomic','physicalInputProved'):need(r[key] is False,'FOCUS_NO_UNSUPPORTED_AUTHORITY')
 dialog=r['preDialog'];child=r['focusedEdit'];window(dialog);window(child)
 need(dialog['pid']==identity['pid'] and dialog['owner']==rb['parentHwnd'] and dialog['class_name']=='#32770' and dialog['hwnd']==ready['candidateHwnd'],'FOCUS_CURRENT_ORIGINAL_MODAL')
 need(contracts.exact(child,r['finalFocusedEdit']) and child['class_name']=='Edit' and child['pid']==dialog['pid'] and child['tid']==dialog['tid'] and child['hwnd'] not in (dialog['hwnd'],rb['parentHwnd']),'FOCUS_SAME_CURRENT_EDIT')
 closed(r['shortcut'],('rawCount','rawError'));need(type(r['shortcut']['rawCount']) is int and r['shortcut']['rawCount']==4 and type(r['shortcut']['rawError']) is int and r['shortcut']['rawError']==0,'FOCUS_FOUR_INSERTED_ONLY')
 closed(r['shortcutStatus'],('attempted','failed','rawCount','rawError'));need(contracts.exact(r['shortcutStatus'],dict(attempted=True,failed=False,**r['shortcut'])),'FOCUS_SHORTCUT_STATUS')
 zero=False
 for phase in ('preKeys','postKeys'):
  values=r[phase];need(type(values) is list and len(values)==14,'FOCUS_FIXED14_ROWS')
  for key,row in zip(KEYS,values):
   closed(row,('key','short','highBitDown','zeroUncertain'));raw=row['short']
   need(type(row['key']) is int and row['key']==key and integer(raw,-32768,32767) and raw&0x8000==0 and row['highBitDown'] is False and type(row['zeroUncertain']) is bool and row['zeroUncertain']==(raw==0),'FOCUS_FIXED_SHORT_SAMPLE')
   zero|=raw==0
 need(type(r['zeroKeyStateUncertainty']) is bool and r['zeroKeyStateUncertainty']==zero,'FOCUS_ZERO_UNCERTAINTY')
 need(type(r['eligibilities']) is list and len(r['eligibilities'])==2,'FOCUS_TWO_ELIGIBILITIES')
 for row in r['eligibilities']:
  closed(row,('unicode','styleRaw','lastError','style32','qualified'));raw=row['styleRaw']
  need(integer(raw,-(1<<31),(1<<32)-1) and row['unicode'] is True and type(row['lastError']) is int and row['lastError']==0 and type(row['style32']) is int and row['style32']==(raw+(1<<32) if raw<0 else raw) and row['qualified'] is True and row['style32']&0x50000000==0x50000000 and row['style32']&~STYLE_MASK==0,'FOCUS_SUPPORTED_STYLE_ONLY')
 need(r['eligibilities'][0]['style32']==r['eligibilities'][1]['style32'],'FOCUS_UNCHANGED_STYLE')
 transport(r['textTransport']);transport(r['selectionTransport']);count=r['textTransport']['messageResult'];units=r['units']
 need(integer(count,1,510) and type(units) is list and len(units)==count and all(integer(u,1,65535) for u in units),'FOCUS_BOUNDED_COMPLETE_UTF16')
 text=b''.join(u.to_bytes(2,'little') for u in units).decode('utf-16-le')
 need(type(r['text']) is str and r['text']==text and contracts.exact(r['selection'],dict(start=0,end=count,kind='NONEMPTY_FULL_SELECTION')) and r['selectionTransport']['messageResult']==count<<16,'FOCUS_NONEMPTY_FULL_SELECTION')
 before=f['clockBefore'];after=f['clockAfter'];c1=proof['clockAfterC1']
 for state in (before,after,c1):clock(state,before)
 sample=r['sampleBeforeDispatch'];need(number(sample) and before['last']<=sample<=after['last']<=c1['last'] and proof['focusOrder']==['READINESS','FOCUS','C1'],'FOCUS_BEFORE_CANONICAL_C1_SAME_FUSE')
 need(type(r['readTimeouts']) is list and len(r['readTimeouts'])==2,'FOCUS_TWO_BOUNDED_READ_CALLS')
 last=sample
 for kind,row in zip(('text','selection'),r['readTimeouts']):
  closed(row,('kind','sample','timeoutMs','deadline'));now=row['sample'];end=before['deadline']
  need(row['kind']==kind and number(now) and last<=now<=after['last'] and row['deadline']==end,'FOCUS_READ_TIME_ORDER')
  n1,d1=(end,1) if type(end) is int else end.as_integer_ratio();n2,d2=(now,1) if type(now) is int else now.as_integer_ratio();ms=((n1*d2-n2*d1)*1000)//(d1*d2)
  need(ms>=1 and type(row['timeoutMs']) is int and row['timeoutMs']==min(250,ms),'FOCUS_EXACT_REMAINING_TIMEOUT');last=now
 history_complete(r,before,after,identity,rb,contracts)
 provenance_complete(r,contracts)
 foreground_complete(r,contracts)
 closed(p,('phase','busy','failed','blocked','shortcut','rawShortcutSavedError','keyObservations','eligibility','readback','rawTextSavedError','rawSelectionSavedError','textContentRetainedInSnapshot','buffersReleased','borrowedResourcesClosed','globalModifierReleaseProved','addressRole'))
 need(p['phase']=='complete' and p['addressRole']=='UNKNOWN' and all(p[key] is False for key in ('busy','failed','blocked','textContentRetainedInSnapshot','buffersReleased','borrowedResourcesClosed','globalModifierReleaseProved')),'FOCUS_COMPLETE_NATIVE_PORT')
 need(contracts.exact(p['shortcut'],r['shortcutStatus']) and all(integer(p[key],0,(1<<32)-1) for key in ('rawShortcutSavedError','rawTextSavedError','rawSelectionSavedError')),'FOCUS_NATIVE_SAVED_ERROR_KNOWLEDGE')
 need(type(p['keyObservations']) is list and len(p['keyObservations'])==2,'FOCUS_NATIVE_KEY_ROSTERS')
 for phase,rows in zip(('preKeys','postKeys'),p['keyObservations']):
  need(type(rows) is list and len(rows)==14,'FOCUS_NATIVE14_KEY_ROWS')
  for row,key,core in zip(rows,KEYS,r[phase]):closed(row,('key','raw'));need(type(row['key']) is int and row['key']==key and type(row['raw']) is int and row['raw']==core['short'],'FOCUS_NATIVE_SHORT_JOIN')
 need(type(p['eligibility']) is list and len(p['eligibility'])==2,'FOCUS_NATIVE_ELIGIBILITY_ROSTER')
 for row,core in zip(p['eligibility'],r['eligibilities']):
  closed(row,('hwnd','unicodeRaw','styleRaw','rawSavedError','result'))
  need(type(row['hwnd']) is int and row['hwnd']==child['hwnd'] and integer(row['unicodeRaw'],-(1<<31),(1<<31)-1) and row['unicodeRaw']!=0 and type(row['styleRaw']) is int and row['styleRaw']==core['styleRaw'] and integer(row['rawSavedError'],0,(1<<32)-1) and contracts.exact(row['result'],{k:core[k] for k in ('unicode','styleRaw','lastError')}),'FOCUS_NATIVE_ELIGIBILITY_JOIN')
 need(contracts.exact(r['readbackStatus'],p['readback']),'FOCUS_CORE_NATIVE_CACHED_READBACK')
 closed(p['readback'],('text','selection'))
 for side in ('text','selection'):
  row=p['readback'][side];keys=('attempted','failed','transportReturn','messageResult','lastError')+(('bufferRetained',) if side=='text' else ());closed(row,keys)
  need(row['attempted'] is True and row['failed'] is False and contracts.exact({k:row[k] for k in ('transportReturn','messageResult','lastError')},r[side+'Transport']),'FOCUS_NATIVE_READBACK_SCALARS')
  if side=='text':need(row['bufferRetained'] is True,'FOCUS_BUFFER_STRONG_RETAINED')
 return p

def focus_complete(proof,identity,controller_identity,contracts):
 p=_focus_observation_complete(proof,identity,controller_identity,contracts)
 retired=proof['focusPortRetirement'];closed(retired,('stage','samePortRetained','originalElectronIdentity','normalExit','electronJobSettlement','originalElectronNormalExitObserved','retirementConfirmed','cachedSnapshot','cachedReadbackStatus','scope'))
 need(retired['stage']=='AFTER_ORIGINAL_CHILD_RETIREMENT_ATTEMPTS' and retired['samePortRetained'] is True and retired['originalElectronNormalExitObserved'] is True and retired['retirementConfirmed'] is True and contracts.exact(retired['originalElectronIdentity'],identity) and contracts.exact(retired['normalExit'],proof['normalExits']['electron']) and contracts.exact(retired['cachedSnapshot'],p) and contracts.exact(retired['cachedReadbackStatus'],p['readback']),'FOCUS_SAME_PORT_AFTER_ORIGINAL_RETIREMENT')
 return True

def focus_direct_complete(proof,identity,controller_identity,contracts,direct,context,edge,bodies):
 p=_focus_observation_complete(proof,identity,controller_identity,contracts)
 need('focusPortRetirement' not in proof and 'normalExits' not in proof,'NO_LEGACY_FOCUS_RETIREMENT_FALLBACK')
 retired=proof['directFocusPortRetirement']
 closed(retired,('kind','stage','samePortRetained','originalElectronIdentity','originalExit',
     'originalEdgeOutcome','retirementConfirmed','cachedSnapshot','cachedReadbackStatus','scope'))
 value=direct.edge_value(edge,bodies,context)
 need(retired['kind']=='DIRECT_FOCUS_PORT_RETIREMENT_V1' and
      retired['stage']=='AFTER_ORIGINAL_CHILD_RETIREMENT_ATTEMPTS' and
      retired['samePortRetained'] is True and retired['retirementConfirmed'] is True and
      value['binding']['edge']=='electron' and value['classification']=='CLEAN_INERT' and
      contracts.exact(retired['originalElectronIdentity'],identity) and
      contracts.exact(retired['originalEdgeOutcome'],edge) and
      contracts.exact(retired['originalExit'],proof['directNormalExits']['electron']) and
      direct.join_normal_exit(retired['originalExit'],edge,context) is True and
      contracts.exact(retired['cachedSnapshot'],p) and
      contracts.exact(retired['cachedReadbackStatus'],p['readback']) and
      retired['scope']=='same strong cached-only port; direct original exit, Job, capture and resource joins',
      'DIRECT_SAME_CACHED_PORT_AFTER_ORIGINAL_RETIREMENT')
 return True


def focus_five_role_complete_v2(proof,identity,controller_identity,contracts,context,policy,timed,bodies):
 import json
 import ordinary_business_domain_v1 as BD
 import ordinary_direct_results as DX
 import ordinary_direct_timing_results_v1 as TR
 need(type(context) is BD._BusinessDomainContextV1,'EXACT_FIVE_FOCUS_BUSINESS_CONTEXT')
 p=_focus_observation_complete(proof,identity,controller_identity,contracts)
 need('focusPortRetirement' not in proof and 'normalExits' not in proof,'NO_LEGACY_FOCUS_RETIREMENT_FALLBACK')
 retired=proof['directFocusPortRetirement']
 closed(retired,('kind','stage','samePortRetained','originalElectronIdentity','originalExit','originalEdgeOutcome','retirementConfirmed','cachedSnapshot','cachedReadbackStatus','scope'))
 value=TR.read_five_role_v2(json.dumps(timed,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii'),bodies,context._context,policy)
 edge=timed['edge']
 need(retired['kind']=='FIVE_ROLE_FOCUS_PORT_RETIREMENT_V2' and
      retired['stage']=='AFTER_ORIGINAL_CHILD_RETIREMENT_ATTEMPTS' and
      retired['samePortRetained'] is True and retired['retirementConfirmed'] is True and
      edge['binding']['edge']=='electron' and value['classification']=='CLEAN_INERT' and
      contracts.exact(retired['originalElectronIdentity'],identity) and
      contracts.exact(retired['originalEdgeOutcome'],timed) and
      contracts.exact(retired['originalExit'],proof['directNormalExits']['electron']) and
      DX.join_normal_exit(retired['originalExit'],edge,context._context) is True and
      contracts.exact(retired['cachedSnapshot'],p) and
      contracts.exact(retired['cachedReadbackStatus'],p['readback']) and
      retired['scope']=='same strong cached-only port; direct original exit, Job, capture and resource joins',
      'FIVE_SAME_CACHED_PORT_AFTER_ORIGINAL_RETIREMENT')
 return True
