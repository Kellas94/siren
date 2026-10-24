"""Pure fixed-shortcut focus discriminator. No native construction or input."""
from types import SimpleNamespace
from context.reference import folder_dialog_driver as model
from context.observer.adapter import ObservationAdapter
import ordinary_shared_dialog_clock as clock_policy
import ordinary_window_foreground_cache_window as query_provenance
import ordinary_window_foreground_cache_foreground as foreground_provenance

_DRIVER=model.FolderDialogDriver
_GUARD=_DRIVER._guard
_OPERATE=_DRIVER._operate
_REMEMBER=_DRIVER._remember
_FUSE=clock_policy._Fuse
_CLOCK=_FUSE.__call__
_CLOCK_SNAPSHOT=_FUSE.snapshot
_OBSERVER_WINDOW=ObservationAdapter.window
_OBSERVER_FOREGROUND=ObservationAdapter.foreground
_KEYS=(27,16,17,18,160,161,162,163,164,165,91,92,76,13)
# SDK WinUser.h constants: ordinary child/window bits plus AUTOHSCROLL/NOHIDESEL.
_STYLE_MASK=0x56830180
_STYLE_REQUIRED=0x50000000
_CAPS=('pointer_bits','guithreadinfo_size','process_id','process_times','process_image',
 'process_exit_code','wait_process','is_window','thread_process','class_name',
 'owner','visible','enabled','enum_windows','foreground','gui_thread_info','is_child')

class Refused(RuntimeError):pass

def _copy(value):
 if type(value) is dict:return {k:_copy(v) for k,v in value.items()}
 if type(value) is list:return [_copy(v) for v in value]
 return value

def _record(window):
 return {key:object.__getattribute__(window,key) for key in ('hwnd','pid','tid','class_name','owner','visible','enabled')}

class _GuardFacade:
 def __init__(self,source,owner):self._source=source;self._owner=owner
 def __getattr__(self,name):
  if name not in _CAPS:raise AttributeError(name)
  value=getattr(self._source,name);self._owner._check()
  if name in ('pointer_bits','guithreadinfo_size'):return value
  if not callable(value):raise Refused('READONLY_GUARD_CAPABILITY_REQUIRED')
  def wrapped(*args):
   query=self._owner._query
   answer=query.is_window(value,args) if name=='is_window' and query is not None else value(*args)
   self._owner._check();return answer
  return wrapped

class AddressFocusDiscriminator:
 def __init__(self,facade,port,binding,clock,controller_pid):
  if type(binding) is not model.Binding or type(clock) is not _FUSE:raise Refused('EXACT_BINDING_FUSE_REQUIRED')
  if type(controller_pid) is not int or not 0<controller_pid<(1<<32) or controller_pid==binding.pid:
   raise Refused('EXTERNAL_CONTROLLER_PID_REQUIRED')
  self._facade=facade;self._port=port;self._binding=binding;self._clock=clock;self._controller_pid=controller_pid
  self._query=None;self._query_pending=[]
  self._foreground=None;self._foreground_pending=[];self._observer=None;self._fg_observer=None;self._fg_driver=None;self._fg_binding=binding
  self._driver=None;self._attempted=False;self._busy=False;self._primary=None;self._diagnostics=[]
  self._classification=None;self._pre=[];self._post=[];self._zero_uncertain=False;self._modifier_uncertain=False
  self._shortcut=None;self._shortcut_status=None;self._pre_dialog=None;self._focus=None;self._final_focus=None
  self._eligibilities=[];self._text_transport=None;self._selection_transport=None;self._selection=None
  self._readback_status=None;self._text=None;self._units=None;self._pending_text=None;self._pending_units=None
  self._timeouts=[];self._dispatch=False;self._text_started=False;self._selection_started=False
  self._status_taken=False;self._status_fn=None;self._sample_before=None
  self._pre_focus=None;self._guard_history=[];self._acquisition_samples=0;self._lease=None;self._acquisition_complete=False

 @property
 def first_error(self):return self._primary
 @property
 def diagnostic_errors(self):return tuple(self._diagnostics)

 def _remember(self,error):
  if self._primary is None:
   self._primary=self._driver._first if self._driver is not None and self._driver._first_present else error
  if self._driver is not None and not self._driver._first_present:_REMEMBER(self._driver,self._primary)

 def _check(self):
  if self._primary is not None:raise self._primary
  if self._driver is not None and self._driver._first_present:raise self._driver._first

 def _refuse(self,code):raise Refused(code)
 def _sample(self):
  self._check();answer=_CLOCK(self._clock);self._check();return answer
 def _seeded(self):
  state=_CLOCK_SNAPSHOT(self._clock)
  if state['failed']:
   error=self._clock.first_error
   if error is not None:raise error
   self._refuse('SHARED_FUSE_FAILED')
  if state['start'] is None or state['deadline'] is None or state['last'] is None:self._refuse('READINESS_ALREADY_SEEDED_FUSE_REQUIRED')
  return state
 def _call(self,fn,args,consume):
  self._sample();answer=fn(*args);result=consume(answer);self._check();self._sample();return result
 def _shape(self,value,keys):
  if type(value) is not dict or len(value)!=len(keys) or any(type(k) is not str for k in value) or set(value)!=set(keys):
   self._refuse('CLOSED_PRIMITIVE_DTO_REQUIRED')
 def _uint(self,value,bits):
  if type(value) is not int or not 0<=value<(1<<bits):self._refuse('UNSIGNED_SCALAR_REQUIRED')
  return value

 def _build(self,state):
  observer=ObservationAdapter(_GuardFacade(self._facade,self),self._binding.original_handle,model)
  names=('process_identity','enum_windows','window','foreground','gui_focus','is_child','path_current',
         'shell_location','dialog_button','send_input','click_button','wait')
  bound=observer.window
  if bound.__self__ is not observer or bound.__func__ is not _OBSERVER_WINDOW:self._refuse('ORIGINAL_BOUND_OBSERVER_WINDOW_REQUIRED')
  self._query=query_provenance.WindowQueryProvenance(bound,model.Window)
  foreground=observer.foreground
  if foreground.__self__ is not observer or foreground.__func__ is not _OBSERVER_FOREGROUND:self._refuse('ORIGINAL_BOUND_OBSERVER_FOREGROUND_REQUIRED')
  self._observer=self._fg_observer=observer
  self._foreground=foreground_provenance.GuardForegroundProvenance(foreground,self._foreground_context,self._query)
  api=SimpleNamespace(**{name:getattr(observer,name) for name in names},monotonic=self._clock)
  api.window=self._query.window;api.foreground=self._foreground.foreground
  self._driver=_DRIVER(api,self._binding);self._driver._deadline=state['deadline'];self._fg_driver=self._driver;self._check()

 def _keys(self,value,post=False):
  target=self._post if post else self._pre
  if type(value) is not tuple or len(value)!=14:self._refuse('FIXED14_SHORT_ROSTER_REQUIRED')
  for key,short in zip(_KEYS,value):
   if type(short) is not int or not -32768<=short<=32767:self._refuse('EXACT_SHORT_KEY_STATE_REQUIRED')
   row={'key':key,'short':short,'highBitDown':bool(short&0x8000),'zeroUncertain':short==0};target.append(row)
   if short==0:self._zero_uncertain=True
   if row['highBitDown']:self._refuse('HELD_KEY_REFUSED')

 def _shortcut_raw(self,value):
  self._shortcut={'rawCount':None,'rawError':None}
  if type(value) is not tuple or len(value)!=2:self._refuse('SHORTCUT_RESULT_UNKNOWN')
  self._shortcut['rawCount']=self._uint(value[0],32);self._shortcut['rawError']=self._uint(value[1],32)
  self._check()
  if value[0]!=4 or value[1]!=0:self._refuse('SHORTCUT_INSERTION_NOT_FOUR')

 def _retain_shortcut(self,fn):
  try:
   value=fn();self._shape(value,('attempted','failed','rawCount','rawError'))
   row={'attempted':None,'failed':None,'rawCount':None,'rawError':None};self._shortcut_status=row
   for key in ('rawCount','rawError'):
    if value[key] is not None:row[key]=self._uint(value[key],32)
   for key in ('attempted','failed'):
    if type(value[key]) is not bool:self._refuse('STATUS_BOOL_REQUIRED')
    row[key]=value[key]
   self._check()
   if row['attempted'] is not True or row['failed'] is not False or self._shortcut is None or any(row[k]!=self._shortcut[k] for k in ('rawCount','rawError')):
    self._refuse('SHORTCUT_STATUS_INCOMPLETE_OR_CONTRADICTORY')
  except BaseException as error:self._secondary_or_first(error)

 def _secondary_or_first(self,error):
  if self._primary is None:self._remember(error)
  elif error is not self._primary and len(self._diagnostics)<4:self._diagnostics.append(error)

 def _history_facts(self,window,target):
  if type(window) is not model.Window:self._refuse('EXACT_GUARD_WINDOW_REQUIRED')
  for key in ('hwnd','pid','tid','class_name','owner','visible','enabled'):
   value=object.__getattribute__(window,key)
   if key in ('hwnd','pid','tid'):
    if type(value) is not int or value<=0:self._refuse('GUARD_POSITIVE_SCALAR_REQUIRED')
   elif key=='owner':
    if type(value) is not int or value<0:self._refuse('GUARD_OWNER_REQUIRED')
   elif key=='class_name':
    if type(value) is not str or not value:self._refuse('GUARD_CLASS_REQUIRED')
   elif type(value) is not bool:self._refuse('GUARD_BOOL_REQUIRED')
   target[key]=value

 def _foreground_context(self):
  # Pure cached context only. _OPERATE owns the actual busy=True lifecycle.
  d=self._driver;observer=self._observer
  if type(d) is not _DRIVER or d is not self._fg_driver or type(observer) is not ObservationAdapter or observer is not self._fg_observer:self._refuse('FOREGROUND_EXACT_CACHED_OBJECTS_REQUIRED')
  if object.__getattribute__(d,'_binding') is not self._binding or self._binding is not self._fg_binding:self._refuse('FOREGROUND_ORIGINAL_BINDING_REQUIRED')
  if any(object.__getattribute__(d,k) is not v for k,v in (('_busy',True),('_blocked',False),('_consumed',False),('_first_present',False))):self._refuse('FOREGROUND_CANONICAL_ACTIVE_CONTEXT_REQUIRED')
  maximum=object.__getattribute__(observer,'_max_handle')
  if type(maximum) is not int or maximum not in ((1<<32)-1,(1<<64)-1):self._refuse('FOREGROUND_CACHED_POINTER_WIDTH_REQUIRED')
  bits=32 if maximum==(1<<32)-1 else 64
  captured=object.__getattribute__(d,'_captured')
  if type(captured) is not tuple or len(captured)!=2:self._refuse('FOREGROUND_CAPTURED_CONTEXT_REQUIRED')
  candidate,chain=captured
  if type(chain) is not tuple or not 1<=len(chain)<=32:self._refuse('FOREGROUND_CAPTURED_CHAIN_REQUIRED')
  def facts(value):
   if type(value) is not model.Window:self._refuse('FOREGROUND_EXACT_CACHED_WINDOW_REQUIRED')
   row={};self._history_facts(value,row)
   if not 0<row['hwnd']<=maximum or not 0<=row['owner']<=maximum or not 0<row['pid']<(1<<32) or not 0<row['tid']<(1<<32):self._refuse('FOREGROUND_CACHED_WINDOW_SCALARS')
   return tuple(row[k] for k in ('hwnd','pid','tid','class_name','owner','visible','enabled'))
  first=facts(candidate);rows=[facts(w) for w in chain]
  # _observe and _chain create distinct equal Window objects; compare only
  # their validated primitive facts, never require object identity between them.
  if first!=rows[0] or first[1]!=self._binding.pid or first[3]!='#32770' or first[5] is not True or first[6] is not True:self._refuse('FOREGROUND_CACHED_DIALOG_REQUIRED')
  if len({row[0] for row in rows})!=len(rows) or any(row[1]!=self._binding.pid for row in rows) or any(a[4]!=b[0] for a,b in zip(rows,rows[1:])):self._refuse('FOREGROUND_CACHED_OWNER_CHAIN_REQUIRED')
  parent=rows[-1]
  if parent[0]!=self._binding.parent_hwnd or parent[2]!=self._binding.parent_tid or parent[3]!=self._binding.parent_class or parent[5] is not True:self._refuse('FOREGROUND_CACHED_ORIGINAL_PARENT_REQUIRED')
  # Modal-disabled parent remains allowed, exactly as canonical _parent.
  return dict(pointerBits=bits,expectedHwnd=first[0])

 def _foreground_note(self,error):
  if len(self._foreground_pending)<8:self._foreground_pending.append(error)

 def _foreground_finish(self,returned,after):
  if self._foreground is None:return
  try:self._foreground.finish_guard(returned,after)
  except BaseException as error:self._foreground_note(error)
  try:pending=self._foreground.pending_errors
  except BaseException as error:self._foreground_note(error);pending=()
  for error in (*self._foreground_pending,*pending):self._secondary_or_first(error)
  self._foreground_pending=[]

 def _query_note(self,error):
  if len(self._query_pending)<8:self._query_pending.append(error) # separate pending latch, NEVER owner poisoning here

 def _query_finish(self,returned,after):
  if self._query is None:return
  try:self._query.finish_guard(returned,after)
  except BaseException as error:self._query_note(error)
  try:pending=self._query.pending_errors
  except BaseException as error:self._query_note(error);pending=()
  for error in (*self._query_pending,*pending):self._secondary_or_first(error)
  self._query_pending=[]

 def _guard_observation(self,stage):
  self._check()
  if len(self._guard_history)>=24:self._refuse('FOCUS_GUARD_HISTORY_CAP')
  row={'ordinal':len(self._guard_history)+1,'stage':stage,'sampleBefore':None,'sampleAfter':None,
       'guardReturned':False,'dialog':None,'focus':None,'factsComplete':False,'readiness':'NOT_EVALUATED'}
  self._guard_history.append(row) # Reserve before guard/diagnostic callouts; never overwrite history.
  try:
   row['sampleBefore']=_CLOCK_SNAPSHOT(self._clock)['last'] # cached Fuse only: no clock sampling
   try:self._query.begin_guard(row['ordinal'],stage,row['sampleBefore'])
   except BaseException as error:self._query_note(error)
   try:self._foreground.begin_guard(row['ordinal'],stage,row['sampleBefore'])
   except BaseException as error:self._foreground_note(error)
   dialog,focus=_GUARD(self._driver);row['guardReturned']=True
   self._check();row['dialog']={};self._history_facts(dialog,row['dialog'])
   row['focus']={};self._history_facts(focus,row['focus']);row['factsComplete']=True
   if row['dialog']['owner']!=self._binding.parent_hwnd:self._refuse('DIRECT_ORIGINAL_PARENT_REQUIRED')
  except BaseException as error:
   self._remember(error) # Retain original reason before any diagnostics.
   raise self._primary
  finally:
   try:row['sampleAfter']=_CLOCK_SNAPSHOT(self._clock)['last']
   except BaseException as error:self._secondary_or_first(error)
   self._query_finish(row['guardReturned'],row['sampleAfter'])
   self._foreground_finish(row['guardReturned'],row['sampleAfter'])
  self._check();return row

 def _acquire_focus(self):
  previous=None
  for index in range(16):
   self._acquisition_samples+=1
   row=self._guard_observation('acquire');dialog=row['dialog'];focus=row['focus']
   if focus['hwnd']==self._pre_focus['hwnd']:
    row['readiness']='OLD_FOCUS';previous=None;continue
   if focus['class_name']!='Edit' or focus['hwnd']==dialog['hwnd']:
    row['readiness']='NON_EDIT';previous=None;continue
   current=(dialog,focus)
   if previous is not None and current==previous:
    row['readiness']='PAIR_COMPLETE';self._lease={'dialog':_copy(dialog),'focus':_copy(focus)}
    self._acquisition_complete=True;return _copy(focus)
   row['readiness']='CANDIDATE';previous=current
  self._refuse('FOCUS_ACQUISITION_SAMPLE_CAP')

 def _edit_guard(self,expected=None,stage='current-edit'):
  row=self._guard_observation(stage);focus=row['focus'];dialog=row['dialog']
  if focus['class_name']!='Edit' or focus['hwnd']==dialog['hwnd']:self._refuse('OWNED_FOCUSED_STANDARD_EDIT_REQUIRED')
  if expected is not None and focus!=expected:self._refuse('FOCUSED_EDIT_CHANGED')
  return _copy(focus)

 def _eligible(self,value):
  self._shape(value,('unicode','styleRaw','lastError'))
  row={'unicode':None,'styleRaw':None,'lastError':None,'style32':None,'qualified':False};self._eligibilities.append(row)
  if type(value['unicode']) is not bool:self._refuse('UNICODE_BOOL_REQUIRED')
  row['unicode']=value['unicode'];style=value['styleRaw']
  if type(style) is not int or not -(1<<31)<=style<(1<<32):self._refuse('GWL_STYLE_SIGNED32_OR_UINT32_REQUIRED')
  row['styleRaw']=style;row['lastError']=self._uint(value['lastError'],32)
  normalized=style+(1<<32) if style<0 else style;row['style32']=normalized
  if (not row['unicode'] or row['lastError']!=0 or normalized&_STYLE_REQUIRED!=_STYLE_REQUIRED
      or normalized&~_STYLE_MASK):self._refuse('UNSUPPORTED_EDIT_ELIGIBILITY')
  row['qualified']=True;return row

 def _timeout(self,kind):
  now=self._sample();state=self._seeded();deadline=state['deadline']
  n1,d1=(deadline,1) if type(deadline) is int else deadline.as_integer_ratio()
  n2,d2=(now,1) if type(now) is int else now.as_integer_ratio()
  remaining=((n1*d2-n2*d1)*1000)//(d1*d2)
  if remaining<1:self._refuse('READBACK_SUBMILLISECOND_REMAINING')
  timeout=min(250,remaining);self._timeouts.append({'kind':kind,'sample':now,'timeoutMs':timeout,'deadline':deadline});return timeout

 def _transport(self,value,keys,side):
  self._shape(value,keys);row={'transportReturn':None,'messageResult':None,'lastError':None}
  if side=='text':self._text_transport=row
  else:self._selection_transport=row
  transport=value['transportReturn']
  if type(transport) is not int or not -(1<<63)<=transport<(1<<63):self._refuse('SIGNED64_TRANSPORT_REQUIRED')
  row['transportReturn']=transport;row['messageResult']=self._uint(value['messageResult'],64);row['lastError']=self._uint(value['lastError'],32)
  self._check()
  if transport==0 or row['lastError']!=0:self._refuse('READBACK_TRANSPORT_FAILED')
  return row

 def _text_result(self,value):
  row=self._transport(value,('transportReturn','messageResult','lastError','units','terminated'),'text');count=row['messageResult']
  if not 0<=count<=510:self._refuse('COMPLETE_TEXT_COUNT_REQUIRED')
  units=value['units']
  if (type(units) is not tuple or len(units)!=count or value['terminated'] is not True
      or any(type(unit) is not int or not 1<=unit<65536 for unit in units)):
   self._refuse('COMPLETE_TERMINATED_UTF16_UNITS_REQUIRED')
  try:text=b''.join(unit.to_bytes(2,'little') for unit in units).decode('utf-16-le')
  except UnicodeError:self._refuse('WELLFORMED_UTF16_REQUIRED')
  self._pending_units=units;self._pending_text=text

 def _selection_result(self,value):
  row=self._transport(value,('transportReturn','messageResult','lastError'),'selection');packed=row['messageResult']
  if packed>0xffffffff or packed==0xffffffff:self._refuse('PACKED16_SELECTION_REQUIRED')
  start=packed&65535;end=packed>>16;count=self._text_transport['messageResult']
  if not 0<=start<=end<=count:self._refuse('SELECTION_ENDPOINTS_REFUSED')
  kind='EMPTY_CARET' if count==0 and start==end==0 else 'NONEMPTY_FULL_SELECTION' if count>0 and start==0 and end==count else 'PARTIAL_OR_CARET'
  self._selection={'start':start,'end':end,'kind':kind}
  if kind!='NONEMPTY_FULL_SELECTION':self._refuse('NONEMPTY_FULL_SELECTION_REQUIRED')

 def _status_row(self,value,text=False):
  keys=('attempted','failed','transportReturn','messageResult','lastError')+(('bufferRetained',) if text else ())
  self._shape(value,keys);result={key:None for key in keys}
  self._readback_status['text' if text else 'selection']=result
  for key in ('transportReturn','messageResult','lastError'):
   item=value[key]
   if item is not None:
    if key=='transportReturn':
     if type(item) is not int or not -(1<<63)<=item<(1<<63):self._refuse('STATUS_TRANSPORT_REQUIRED')
    else:self._uint(item,64 if key=='messageResult' else 32)
   result[key]=item
  for key in ('attempted','failed')+(('bufferRetained',) if text else ()):
   if type(value[key]) is not bool:self._refuse('STATUS_BOOL_REQUIRED')
   result[key]=value[key]
  return result

 def _retain_readback(self):
  self._status_taken=True
  try:
   value=self._status_fn();self._shape(value,('text','selection'))
   self._readback_status={};self._readback_status['text']=self._status_row(value['text'],True)
   self._readback_status['selection']=self._status_row(value['selection'])
   self._check()
   for side,started,raw in (('text',self._text_started,self._text_transport),('selection',self._selection_started,self._selection_transport)):
    row=self._readback_status[side]
    if row['attempted'] is not started or row['failed'] is not False:self._refuse('READBACK_STATUS_FAILED')
    if started and (raw is None or any(row[k]!=raw[k] for k in ('transportReturn','messageResult','lastError'))):self._refuse('READBACK_STATUS_CONTRADICTORY')
   if self._text_started and self._readback_status['text']['bufferRetained'] is not True:self._refuse('TEXT_BUFFER_RETENTION_REQUIRED')
  except BaseException as error:self._secondary_or_first(error)

 def _action(self):
  functions=[]
  for name in ('prepare_ctrl_l','key_states','shortcut_status','eligibility','read_text','read_selection','readback_status'):
   self._sample();fn=getattr(self._port,name);self._check();self._sample()
   if not callable(fn):self._refuse('FIXED_FOCUS_PORT_REQUIRED')
   functions.append(fn)
  prepare,keys,status,eligibility,text,selection,self._status_fn=functions
  dispatch=self._call(prepare,(),lambda value:value)
  if not callable(dispatch):self._refuse('PREPARED_ZERO_ARGUMENT_DISPATCH_REQUIRED')
  self._call(keys,(),self._keys)
  pre=self._guard_observation('pre-dispatch');self._pre_dialog=_copy(pre['dialog']);self._pre_focus=_copy(pre['focus'])
  self._sample_before=_CLOCK_SNAPSHOT(self._clock)['last']
  # No external callout after final canonical guard until fixed prepared dispatch.
  self._dispatch=True;self._modifier_uncertain=True
  try:self._shortcut_raw(dispatch())
  except BaseException as error:self._remember(error)
  finally:self._retain_shortcut(status)
  self._check();self._sample();self._call(keys,(),lambda value:self._keys(value,True))
  self._focus=self._acquire_focus();hwnd=self._focus['hwnd']
  self._edit_guard(self._focus,'before-eligibility')
  self._call(eligibility,(hwnd,),self._eligible);self._edit_guard(self._focus)
  timeout=self._timeout('text');self._text_started=True
  self._call(text,(hwnd,timeout),self._text_result);self._edit_guard(self._focus)
  timeout=self._timeout('selection');self._selection_started=True
  self._call(selection,(hwnd,timeout),self._selection_result)
  self._retain_readback();self._check()
  self._call(eligibility,(hwnd,),self._eligible)
  if self._eligibilities[0]['style32']!=self._eligibilities[1]['style32']:self._refuse('EDIT_STYLE_CHANGED')
  self._final_focus=self._edit_guard(self._focus);self._sample()
  self._text=self._pending_text;self._units=list(self._pending_units);self._pending_text=None;self._pending_units=None
  self._driver._consumed=True;self._classification='OWNED_FOCUSED_EDIT_OBSERVED'
  answer=self.snapshot();self._check();return answer

 def _redact(self):self._text=None;self._units=None;self._pending_text=None;self._pending_units=None

 def observe(self):
  if self._busy or self._attempted:
   self._remember(Refused('ONE_DISCRIMINATOR_NO_REENTRY_OR_REPLAY'));self._redact();raise self._primary
  self._attempted=True;self._busy=True
  try:
   self._check();state=self._seeded();self._sample();self._build(state)
   return _OPERATE(self._driver,self._action)
  except BaseException as error:self._remember(error);self._redact();raise self._primary
  finally:
   if self._text_started and not self._status_taken:self._retain_readback()
   self._busy=False

 def snapshot(self):
  query=None
  if self._query is not None:
   try:query=self._query.snapshot()
   except BaseException as error:
    self._secondary_or_first(error);self._redact();raise self._primary
  foreground=None
  if self._foreground is not None:
   try:foreground=self._foreground.snapshot()
   except BaseException as error:
    self._secondary_or_first(error);self._redact();raise self._primary
  return _copy({'version':6,'attempted':self._attempted,'failed':self._primary is not None,'classification':self._classification,
   'reportedControllerPid':self._controller_pid,'preKeys':self._pre,'postKeys':self._post,'zeroKeyStateUncertainty':self._zero_uncertain,
   'modifierStateMayBeAltered':self._modifier_uncertain,'conclusiveGlobalKeyReleaseProved':False,
   'dispatchStarted':self._dispatch,'shortcut':self._shortcut,'shortcutStatus':self._shortcut_status,'sampleBeforeDispatch':self._sample_before,
   'preDialog':self._pre_dialog,'preFocusedChild':self._pre_focus,'guardHistory':self._guard_history,
   'acquisitionSamples':self._acquisition_samples,'acquiredLease':self._lease,'acquisitionComplete':self._acquisition_complete,
   'focusedEdit':self._focus,'finalFocusedEdit':self._final_focus,'eligibilities':self._eligibilities,
   'textTransport':self._text_transport,'selectionTransport':self._selection_transport,'selection':self._selection,
   'text':self._text,'units':self._units,'readbackStatus':self._readback_status,'readTimeouts':self._timeouts,
   'diagnosticErrorCount':len(self._diagnostics),'addressRole':'UNKNOWN','committedShellLocationProved':False,
   'pathAuthority':False,'confirmationQualified':False,'selectionSamplesAtomic':False,'physicalInputProved':False,'windowQueryProvenance':query,'foregroundQueryProvenance':foreground})
