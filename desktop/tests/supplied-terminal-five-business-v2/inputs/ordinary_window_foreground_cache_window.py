"""Pure last-window-call audit. Pending diagnostics NEVER poison caller policy."""
from types import MethodType
from math import isfinite
class Refused(RuntimeError):pass
def _copy(v):
 if type(v) is dict:return {k:_copy(x) for k,x in v.items()}
 if type(v) is list:return [_copy(x) for x in v]
 return v
def _hwnd(v):return type(v) is int and 0<v<(1<<64)
def _time(v):return type(v) in (int,float) and isfinite(v)
class WindowQueryProvenance:
 def __init__(self,window,window_type):
  if type(window) is not MethodType or type(window_type) is not type:raise Refused('CAPTURED_BOUND_WINDOW_AND_TYPE_REQUIRED')
  self._window=window;self._Window=window_type;self._guards=[];self._guard=None;self._active_call=None;self._calling=False
  self._errors=[];self._error_count=0;self._fallback=None;self._guard_error_start=0
  self._cache=None;self._cache_current=None;self._foreground_calling=False;self._snapshotting=False;self._snapshot_first=None
 @property
 def pending_errors(self):return tuple(self._errors)+(() if self._fallback is None else (self._fallback,))
 def _note(self,error):
  try:
   if self._snapshotting and self._snapshot_first is None:self._snapshot_first=error
   self._error_count+=1
   if len(self._errors)<8:self._errors.append(error)
  except BaseException:
   if self._fallback is None:self._fallback=error
 def _diag(self,fn,*args):
  try:return fn(*args)
  except BaseException as error:
   try:self._note(error)
   except BaseException:
    try:
     if self._fallback is None:self._fallback=error
    except BaseException:pass
   return None
 def _begin(self,ordinal,stage,before):
  if self._guard is not None or self._calling or self._foreground_calling or self._snapshotting:raise Refused('DIAGNOSTIC_GUARD_REENTRY')
  if len(self._guards)>=24:raise Refused('DIAGNOSTIC_GUARD_CAP24')
  if type(ordinal) is not int or ordinal!=len(self._guards)+1 or type(stage) is not str or not 0<len(stage)<=64 or not _time(before):raise Refused('DIAGNOSTIC_GUARD_DATA')
  self._guard_error_start=self._error_count
  self._guard=dict(guardOrdinal=ordinal,stage=stage,sampleBefore=before,sampleAfter=None,canonicalReturned=None,windowCalls=0,omittedWindowCalls=0,lastCall=None,diagnosticsComplete=False,diagnosticErrorCount=0,truncated=False,callerBranch='UNKNOWN',coverage='LAST_WINDOW_CALL_ONLY')
  self._cache=dict(phase='OPEN',guardOrdinal=ordinal,stage=stage,calls=0,rows={},omitted=0,queryActiveObservations=0)
 def begin_guard(self,ordinal,stage,cached_before):self._diag(self._begin,ordinal,stage,cached_before)
 def _reserve_window(self,hwnd):
  g=self._guard
  if g is None:raise Refused('WINDOW_OUTSIDE_DIAGNOSTIC_GUARD')
  g['windowCalls']+=1;g['omittedWindowCalls']=g['windowCalls']-1;g['lastCall']=None
  row=dict(callOrdinal=g['windowCalls'],requestedHwnd=None,reserved=True,callStarted=False,returned=False,raised=False,resultKind='UNKNOWN',window=None,factsComplete=False,isWindowCalls=0,isWindow=[],scalarTruncated=False,callerBranch='UNKNOWN')
  g['lastCall']=row;self._active_call=row
  if not _hwnd(hwnd):raise Refused('AUDIT_HWND_UNKNOWN')
  row['requestedHwnd']=hwnd
 def _facts(self,value,row):
  row['window']={key:None for key in ('hwnd','pid','tid','class_name','owner','visible','enabled')}
  for key in row['window']:
   v=object.__getattribute__(value,key)
   if key in ('hwnd','pid','tid'):
    if not _hwnd(v):raise Refused('AUDIT_POSITIVE_SCALAR')
   elif key=='owner':
    if type(v) is not int or not 0<=v<(1<<64):raise Refused('AUDIT_OWNER')
   elif key=='class_name':
    if type(v) is not str or not 0<len(v)<=512:raise Refused('AUDIT_CLASS')
   elif type(v) is not bool:raise Refused('AUDIT_BOOL')
   row['window'][key]=v
  row['factsComplete']=True
 def _returned(self,value):
  row=self._active_call
  if row is None:raise Refused('WINDOW_RECORD_UNAVAILABLE')
  row['returned']=True
  if value is None:row['resultKind']='NONE'
  elif type(value) is self._Window:row['resultKind']='WINDOW';self._facts(value,row)
  else:row['resultKind']='OTHER'
 def _raised(self):
  if self._active_call is not None:self._active_call['raised']=True
 def _flag(self,row,key,value):
  if row is not None:row[key]=value
 def window(self,hwnd):
  if self._calling:
   error=Refused('WINDOW_WRAPPER_REENTRY');self._note(error);raise error
  self._calling=True;self._active_call=None
  try:
   self._diag(self._cache_attempt,hwnd)
   self._diag(self._reserve_window,hwnd)
   self._diag(self._flag,self._active_call,'callStarted',True)
   try:value=self._window(hwnd)
   except BaseException:
    self._diag(self._raised);raise # identical original exception; no formatting/check/callback
   self._diag(self._returned,value);return value
  finally:
   self._diag(self._cache_capture,self._active_call)
   self._cache_current=None;self._active_call=None;self._calling=False
 def _record_scalar(self,args):
  call=self._active_call;call['isWindowCalls']+=1
  if len(call['isWindow'])>=4:call['scalarTruncated']=True;raise Refused('ISWINDOW_AUDIT_CAP4')
  row=dict(ordinal=call['isWindowCalls'],hwnd=None,callStarted=False,returned=False,raised=False,value=None);call['isWindow'].append(row)
  if type(args) is not tuple or len(args)!=1 or not _hwnd(args[0]):raise Refused('ISWINDOW_AUDIT_ARGUMENT_UNKNOWN')
  row['hwnd']=args[0];return row
 def _scalar_result(self,row,value):
  if row is None:return
  row['returned']=True
  if type(value) is not bool:raise Refused('ISWINDOW_AUDIT_BOOL_UNKNOWN')
  row['value']=value
 def is_window(self,fn,args):
  if self._active_call is None:return fn(*args)
  row=self._diag(self._record_scalar,args)
  self._diag(self._flag,row,'callStarted',True)
  try:value=fn(*args)
  except BaseException:
   self._diag(self._flag,row,'raised',True)
   raise
  self._diag(self._scalar_result,row,value);return value
 def _finish(self,returned,after):
  g=self._guard
  if g is None:raise Refused('NO_DIAGNOSTIC_GUARD_TO_FINISH')
  if self._calling or self._active_call is not None or self._snapshotting or self._foreground_calling:raise Refused('DIAGNOSTIC_FINISH_DURING_CALLBACK')
  # No shared mutable receipt survives a guard; exports copy only owned primitives.
  if type(returned) is not bool or after is not None and not _time(after):raise Refused('DIAGNOSTIC_GUARD_FINISH_DATA')
  g['sampleAfter']=after;g['canonicalReturned']=returned;g['diagnosticErrorCount']=self._error_count-self._guard_error_start
  g['diagnosticsComplete']=self._error_count==0 and self._fallback is None and after is not None
  g['truncated']=bool(g['lastCall'] is not None and g['lastCall']['scalarTruncated'])
  self._guards.append(g);self._guard=None

 def finish_guard(self,canonical_returned,cached_after):
  # A premature callback cannot clear the intake. A real finish, even failed
  # bookkeeping, always drops the private table; active last-call DTO survives.
  active=self._calling or self._active_call is not None or self._snapshotting or self._foreground_calling
  try:self._diag(self._finish,canonical_returned,cached_after)
  finally:
   if not active:self._cache=None;self._cache_current=None
 def _cache_attempt(self,hwnd):
  self._cache_current=None;c=self._cache
  if c is None:raise Refused('CACHE_GUARD_UNAVAILABLE')
  if c['phase']=='FROZEN':return
  if c['phase']=='SEALED':
   c['queryActiveObservations']+=1
   raise Refused('WINDOW_OBSERVATION_DURING_FOREGROUND_QUERY')
  if c['phase']!='OPEN':raise Refused('CACHE_PHASE_UNKNOWN')
  c['calls']+=1;n=c['calls']
  if n>4129:
   c['omitted']+=1
   raise Refused('PRE_FOREGROUND_WINDOW_CAP4129')
  if not _hwnd(hwnd):raise Refused('CACHE_HWND_UNKNOWN')
  entry=c['rows'].get(hwnd)
  if entry is None:
   entry=dict(firstOrdinal=n,lastOrdinal=n,observationCount=0,priorWindow=None,conflict=False,incomplete=False)
   c['rows'][hwnd]=entry
  entry['lastOrdinal']=n;entry['observationCount']+=1
  self._cache_current=(hwnd,entry)
 def _cache_capture(self,row):
  token=self._cache_current
  if token is None:return
  hwnd,entry=token
  if row is None or row['requestedHwnd']!=hwnd or not row['factsComplete'] or row['raised'] or not row['returned'] or row['window']['hwnd']!=hwnd:
   entry['incomplete']=True;return
  facts=_copy(row['window'])
  if entry['priorWindow'] is None:entry['priorWindow']=facts
  elif entry['priorWindow']!=facts:entry['conflict']=True
 def _seal(self,ordinal,stage):
  c=self._cache;g=self._guard
  if self._calling or self._active_call is not None or self._snapshotting:raise Refused('CACHE_SEAL_DURING_CALLBACK')
  if c is None or g is None or c['phase']!='OPEN' or type(ordinal) is not int or type(stage) is not str or ordinal!=g['guardOrdinal'] or ordinal!=c['guardOrdinal'] or stage!=g['stage'] or stage!=c['stage']:raise Refused('CACHE_FOREGROUND_GUARD_MISMATCH')
  c['phase']='SEALED'
 def seal_foreground(self,ordinal,stage):self._diag(self._seal,ordinal,stage)
 def _join(self,value):
  c=self._cache
  if c is None or c['phase']!='SEALED':raise Refused('CACHE_QUERY_NOT_SEALED')
  # Only exact owned primitive values enter this detached fixed-size DTO.
  valid=type(value) is int and 0<=value<(1<<64)
  entry=c['rows'].get(value) if valid and value!=0 else None
  complete=self._error_count==0 and self._fallback is None and c['omitted']==0 and c['queryActiveObservations']==0
  status='UNSUPPORTED_RETURN' if not valid else 'NULL_HANDLE' if value==0 else 'MISS' if entry is None else 'CONFLICT' if entry['conflict'] else 'INCOMPLETE_OBSERVATION' if entry['incomplete'] else 'MATCH'
  row=dict(version=1,coverage='PRE_FOREGROUND_ONLY',status=status,guardOrdinal=c['guardOrdinal'],intakeSealed=True,windowCallsAtForeground=c['calls'],distinctKeys=len(c['rows']),omittedCalls=c['omitted'],queryActiveObservationCount=c['queryActiveObservations'],matchedHwnd=value if valid and value!=0 else None,firstOrdinal=None if entry is None else entry['firstOrdinal'],lastOrdinal=None if entry is None else entry['lastOrdinal'],observationCount=0 if entry is None else entry['observationCount'],duplicateCount=0 if entry is None else entry['observationCount']-1,conflict=False if entry is None else entry['conflict'],incomplete=False if entry is None else entry['incomplete'],priorWindow=_copy(entry['priorWindow']) if status=='MATCH' and complete else None,captureComplete=complete,windowLifetimeProved=False,currentOwnership='UNKNOWN',actor='UNKNOWN',directComparisonProved=False)
  # Detaching the selected primitive row is diagnostic work too. Recheck after
  # it so caught nested bookkeeping cannot publish pre-error clean evidence.
  row['queryActiveObservationCount']=c['queryActiveObservations']
  row['captureComplete']=self._error_count==0 and self._fallback is None and c['omitted']==0 and c['queryActiveObservations']==0
  if not row['captureComplete']:row['priorWindow']=None
  c['phase']='FROZEN';c['rows']={}
  return row
 def freeze_foreground(self,value):
  try:return self._diag(self._join,value)
  finally:
   # On a failed join, release the table and make all later calls post-query.
   if self._cache is not None:self._cache['phase']='FROZEN';self._cache['rows']={}
 def foreground_threw(self):
  if self._cache is not None:self._cache['phase']='FROZEN';self._cache['rows']={}
 def _detach(self,value):return _copy(value)
 def snapshot(self):
  if self._snapshotting:
   error=Refused('WINDOW_SNAPSHOT_REENTRY');self._note(error);raise error
  before=self._error_count;fallback=self._fallback
  self._snapshotting=True;self._snapshot_first=None
  try:
   result=self._detach(dict(version=2,coverage='LAST_WINDOW_CALL_PER_GUARD_ONLY',guards=self._guards,activeGuard=self._guard,diagnosticErrorCount=self._error_count,pendingDiagnosticCount=len(self.pending_errors),diagnosticErrorsDropped=max(0,self._error_count-len(self._errors)),fullQueryTraceProved=False,windowLifetimeProved=False))
   if self._snapshot_first is not None:raise self._snapshot_first
   if self._error_count!=before or self._fallback is not fallback:raise Refused('WINDOW_SNAPSHOT_DIAGNOSTIC_CHANGED')
   return result
  finally:self._snapshotting=False;self._snapshot_first=None
