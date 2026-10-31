"""Pure original-adapter foreground call-through; cached context is conditional."""
from types import MethodType
from math import isfinite
from ordinary_window_foreground_cache_window import WindowQueryProvenance
class Refused(RuntimeError):pass
def _copy(value):
 if type(value) is dict:return {k:_copy(v) for k,v in value.items()}
 if type(value) is list:return [_copy(v) for v in value]
 return value
def _time(v):return type(v) in (int,float) and isfinite(v)
class GuardForegroundProvenance:
 def __init__(self,foreground,context,window_cache):
  if type(foreground) is not MethodType or not callable(context):raise Refused('CAPTURED_BOUND_FOREGROUND_AND_CONTEXT_REQUIRED')
  if type(window_cache) is not WindowQueryProvenance or window_cache._window.__self__ is not foreground.__self__:raise Refused('EXACT_SAME_RECEIVER_WINDOW_CACHE_REQUIRED')
  self._cache=window_cache
  self._query=foreground;self._context=context;self._guards=[];self._guard=None;self._calling=False;self._issued=False;self._active=None;self._snapshotting=False;self._snapshot_first=None
  self._errors=[];self._error_count=0;self._fallback=None;self._guard_error_start=0
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
  if self._calling or self._guard is not None or self._snapshotting:raise Refused('FOREGROUND_GUARD_REENTRY')
  if len(self._guards)>=24:raise Refused('FOREGROUND_GUARD_CAP24')
  if type(ordinal) is not int or ordinal!=len(self._guards)+1 or type(stage) is not str or not 0<len(stage)<=64 or not _time(before):raise Refused('FOREGROUND_GUARD_DATA')
  self._guard_error_start=self._error_count;self._issued=False
  self._guard=dict(guardOrdinal=ordinal,stage=stage,sampleBefore=before,sampleAfter=None,canonicalReturned=None,foregroundCalls=0,foreground=None,status='NOT_REACHED',diagnosticsComplete=False,diagnosticErrorCount=0)
 def begin_guard(self,ordinal,stage,cached_before):
  # The new operational guard's one-call reservation precedes diagnostic
  # bookkeeping. A failed begin cannot suppress its original foreground call.
  if not self._calling and self._guard is None and not self._snapshotting:self._issued=False
  self._diag(self._begin,ordinal,stage,cached_before)
 def _reserve(self):
  g=self._guard
  if g is None:raise Refused('FOREGROUND_OUTSIDE_GUARD')
  g['foregroundCalls']=1;g['status']='PARTIAL'
  row=dict(ordinal=1,reserved=True,contextStarted=False,contextReturned=False,expectedStatus='UNAVAILABLE',expectedHwnd=None,pointerBits=None,queryStarted=False,queryReturned=False,queryRaised=False,returnStatus='UNAVAILABLE',foregroundHwnd=None,returnBasis='ORIGINAL_ADAPTER_FOREGROUND_RETURN',expectedBasis='CANONICAL_CAPTURED_HWND_BEFORE_FOREGROUND',directLocalOperandCaptured=False,comparisonEvaluated='UNKNOWN',actor='UNKNOWN',foregroundOwnership='UNKNOWN',priorWindowJoin=None)
  g['foreground']=row;self._active=row
 def _flag(self,row,key,value):
  if row is not None:row[key]=value
 def _context_record(self,value):
  if type(value) is not dict or any(type(k) is not str for k in value) or set(value)!={'pointerBits','expectedHwnd'}:raise Refused('FOREGROUND_CONTEXT_DTO')
  bits=value['pointerBits'];hwnd=value['expectedHwnd']
  if type(bits) is not int or bits not in (32,64) or type(hwnd) is not int or not 0<hwnd<2**bits:raise Refused('FOREGROUND_CONTEXT_SCALARS')
  row=self._active
  if row is None:raise Refused('FOREGROUND_RECORD_UNAVAILABLE')
  row['pointerBits']=bits;row['expectedHwnd']=hwnd;row['expectedStatus']='CACHED'
 def _returned(self,value):
  row=self._active
  if row is None:raise Refused('FOREGROUND_RECORD_UNAVAILABLE')
  row['queryReturned']=True
  bits=row['pointerBits']
  if type(value) is int and 0<=value<2**(64 if bits is None else bits):row['foregroundHwnd']=value;row['returnStatus']='HWND'
  else:row['returnStatus']='UNSUPPORTED';raise Refused('FOREGROUND_RETURN_SCALAR_UNKNOWN')
 def foreground(self):
  if self._calling or self._issued:
   error=Refused('FOREGROUND_ONE_CALL_NO_REENTRY');self._note(error);raise error
  self._issued=True;self._calling=True;self._active=None
  self._cache._foreground_calling=True # exact same owned helper; not a callout
  try:
   self._diag(self._seal_cache)
   self._diag(self._reserve);self._diag(self._flag,self._active,'contextStarted',True)
   def context():
    value=self._context();self._diag(self._flag,self._active,'contextReturned',True);self._context_record(value)
   self._diag(context)
   self._diag(self._flag,self._active,'queryStarted',True)
   try:value=self._query()
   except BaseException:
    self._diag(self._cache.foreground_threw)
    self._diag(self._flag,self._active,'queryRaised',True);raise
   self._diag(self._join_cache,value)
   self._diag(self._returned,value);return value
  finally:
   self._cache._foreground_calling=False
   self._active=None;self._calling=False
 def _seal_cache(self):
  g=self._guard
  self._cache.seal_foreground(None if g is None else g['guardOrdinal'],None if g is None else g['stage'])
 def _join_cache(self,value):
  joined=self._cache.freeze_foreground(value)
  if self._active is not None:self._active['priorWindowJoin']=joined
 def _finish(self,returned,after):
  if self._calling or self._active is not None or self._snapshotting:raise Refused('FOREGROUND_FINISH_DURING_CALLBACK')
  g=self._guard
  if g is None:raise Refused('NO_FOREGROUND_GUARD')
  if type(returned) is not bool or after is not None and not _time(after):raise Refused('FOREGROUND_FINISH_DATA')
  g['sampleAfter']=after;g['canonicalReturned']=returned;g['diagnosticErrorCount']=self._error_count-self._guard_error_start
  row=g['foreground'];g['status']='NOT_REACHED' if row is None else 'THREW' if row['queryRaised'] else 'RETURNED' if row['queryReturned'] else 'PARTIAL'
  g['diagnosticsComplete']=self._error_count==0 and self._fallback is None and after is not None
  self._guards.append(g);self._guard=None
 def finish_guard(self,canonical_returned,cached_after):self._diag(self._finish,canonical_returned,cached_after)
 def _detach(self,value):return _copy(value)
 def snapshot(self):
  if self._snapshotting:
   error=Refused('FOREGROUND_SNAPSHOT_REENTRY');self._note(error);raise error
  before=self._error_count;fallback=self._fallback
  self._snapshotting=True;self._snapshot_first=None
  try:
   result=self._detach(dict(version=2,coverage='ONE_ORIGINAL_ADAPTER_FOREGROUND_RETURN_PER_GUARD',guards=self._guards,activeGuard=self._guard,diagnosticErrorCount=self._error_count,pendingDiagnosticCount=len(self.pending_errors),diagnosticErrorsDropped=max(0,self._error_count-len(self._errors)),expectedBasisInvariant='ONLY_CANONICAL_OBSERVE_WRITES_CAPTURED',directLocalOperandCaptured=False,comparisonEvaluated='UNKNOWN',actor='UNKNOWN',foregroundOwnership='UNKNOWN'))
   # Never publish counters captured before a newly latched detachment error.
   # Old diagnostic errors alone still permit a partial adverse snapshot.
   if self._snapshot_first is not None:raise self._snapshot_first
   if self._error_count!=before or self._fallback is not fallback:raise Refused('FOREGROUND_SNAPSHOT_DIAGNOSTIC_CHANGED')
   return result
  finally:self._snapshotting=False;self._snapshot_first=None
