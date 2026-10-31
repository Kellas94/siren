"""Fixed borrowed focus ports. No ctypes/DLL/native construction on import."""
from escape_cancel.native import NativeEscapeFacade

_KEYS=(27,16,17,18,160,161,162,163,164,165,91,92,76,13)
_MASK=0x56830180
class Refused(RuntimeError):pass
def _int(value,low,high):return type(value) is int and low<=value<=high
def _hwnd(value):return _int(value,1,(1<<64)-7) and value!=0xffff
def _copy(value):
 if type(value) is dict:return {k:_copy(v) for k,v in value.items()}
 if type(value) is list:return [_copy(v) for v in value]
 return value
def _supported(raw,unicode,error):
 if not _int(raw,-(1<<31),(1<<32)-1) or unicode is not True or error!=0:return False
 style=raw if raw>=0 else raw+(1<<32)
 return style&0x50000000==0x50000000 and style&~_MASK==0
def _status():return dict(attempted=False,failed=False,transportReturn=None,messageResult=None,lastError=None)

class _FocusPort:
 def __init__(self,original):
  if type(original) is not NativeEscapeFacade:raise Refused('EXACT_ORIGINAL_NATIVE_ESCAPE_REQUIRED')
  c=original._c;dlls=original._dlls;I=original._INPUT
  if type(dlls) is not tuple or len(dlls)!=2 or type(original.pointer_bits) is not int or original.pointer_bits!=64 or type(original.guithreadinfo_size) is not int or original.guithreadinfo_size!=72:raise Refused('EXACT_X64_CONTEXT_REQUIRED')
  if tuple(c.sizeof(t) for t in (c.c_void_p,c.c_uint32,c.c_int16,c.c_int32,c.c_wchar,c.c_size_t,c.c_ssize_t))!=(8,4,2,4,2,8,8):raise Refused('FIXED_SCALAR_WIDTHS_REQUIRED')
  union=dict(I._fields_)['u'];keyboard=dict(union._fields_)['ki'];mouse=dict(union._fields_)['mi'];hardware=dict(union._fields_)['hi']
  if (c.sizeof(I),c.alignment(I),I.u.offset,c.sizeof(I*4),c.sizeof(union),c.sizeof(keyboard),keyboard.dwExtraInfo.offset,c.sizeof(mouse),mouse.dwExtraInfo.offset,c.sizeof(hardware))!=(40,8,8,160,32,24,16,32,24,8):raise Refused('FULL_BORROWED_INPUT_LAYOUT_REQUIRED')
  user=dlls[1]
  if type(original._fn) is not dict or original._fn.get('SendInput') is not user.SendInput or original._fn.get('GetAsyncKeyState') is not user.GetAsyncKeyState or original._key_state is not user.GetAsyncKeyState:raise Refused('ORIGINAL_SHARED_INPUT_FUNCTIONS_REQUIRED')
  self._original=original;self._c=c;self._INPUT=I;self._clear=c.set_last_error;self._error=c.get_last_error
  self._send=user.SendInput;self._key=user.GetAsyncKeyState;self._unicode=user.IsWindowUnicode;self._style=user.GetWindowLongPtrW;self._message=user.SendMessageTimeoutW
  self._send.argtypes=[c.c_uint32,c.POINTER(I),c.c_int32];self._send.restype=c.c_uint32
  self._key.argtypes=[c.c_int32];self._key.restype=c.c_int16
  self._unicode.argtypes=[c.c_void_p];self._unicode.restype=c.c_int32
  self._style.argtypes=[c.c_void_p,c.c_int32];self._style.restype=c.c_ssize_t
  self._message.argtypes=[c.c_void_p,c.c_uint32,c.c_size_t,c.c_ssize_t,c.c_uint32,c.c_uint32,c.POINTER(c.c_size_t)];self._message.restype=c.c_ssize_t
  self._phase='new';self._busy=False;self._first=None;self._blocked=False;self._events=None;self._focus=None
  self._shortcut=dict(attempted=False,failed=False,rawCount=None,rawError=None);self._shortcut_saved=None
  self._text=_status();self._selection=_status();self._text_buffer=None;self._text_output=None;self._selection_output=None
  self._text_saved=self._selection_saved=None;self._keys=[];self._eligibility=[]
 @property
 def first_error(self):return self._first
 def _remember(self,error):
  if self._first is None:self._first=error
 def _check(self):
  if self._first is not None:raise self._first
 def _enter(self,expected,next_phase):
  self._check()
  if self._busy or self._blocked or self._phase not in expected:
   self._remember(Refused('ONE_FIXED_FOCUS_ROSTER_NO_REENTRY_OR_REPLAY'));raise self._first
  self._busy=True;self._phase=next_phase
 def _target(self,hwnd):
  if not _hwnd(hwnd):raise Refused('EXACT_FOCUSED_HWND_REQUIRED')
  if self._focus is None:self._focus=hwnd
  elif hwnd!=self._focus:raise Refused('SAME_FOCUSED_HWND_REQUIRED')
 def prepare_ctrl_l(self):
  self._enter(('new',),'prepared')
  try:
   self._events=(self._INPUT*4)()
   for index,(key,flags) in enumerate(((17,0),(76,0),(76,2),(17,2))):
    self._events[index].type=1;self._events[index].u.ki.wVk=key;self._events[index].u.ki.dwFlags=flags
   self._check();return self._dispatch
  except BaseException as error:self._remember(error);raise self._first
  finally:self._busy=False
 def key_states(self):
  before=self._phase=='prepared';self._enter(('prepared','dispatched'),'prekeys' if before else 'postkeys');row=[];self._keys.append(row)
  try:
   for key in _KEYS:
    self._check();raw=self._key(key)
    if not _int(raw,-32768,32767):raise Refused('EXACT_SHORT_KEY_STATE_REQUIRED')
    row.append(dict(key=key,raw=raw));self._check()
   if any(item['raw']&0x8000 for item in row):self._blocked=True
   return tuple(item['raw'] for item in row)
  except BaseException as error:self._remember(error);raise self._first
  finally:self._busy=False
 def _dispatch(self):
  self._enter(('prekeys',),'dispatched');self._shortcut['attempted']=True
  try:
   self._clear(0);self._check();count=self._send(4,self._events,self._c.sizeof(self._INPUT))
   if _int(count,0,(1<<32)-1):self._shortcut['rawCount']=count
   saved=self._error()
   if not _int(saved,0,(1<<32)-1):raise Refused('SAVED_ERROR_UINT32_REQUIRED')
   self._shortcut_saved=saved;self._shortcut['rawError']=0 if count==4 and type(count) is int else saved
   self._check()
   if not _int(count,0,4):raise Refused('INSERTED_COUNT_0_TO_4_REQUIRED')
   if count!=4:self._blocked=True
   return count,self._shortcut['rawError']
  except BaseException as error:self._shortcut['failed']=True;self._remember(error);raise self._first
  finally:self._busy=False
 def shortcut_status(self):return dict(self._shortcut,failed=self._shortcut['failed'] or self._first is not None)
 def eligibility(self,hwnd):
  final=self._phase=='selection';self._enter(('postkeys','selection'),'complete' if final else 'eligible')
  row=dict(hwnd=None,unicodeRaw=None,styleRaw=None,rawSavedError=None,result=None);self._eligibility.append(row)
  try:
   self._target(hwnd);row['hwnd']=hwnd;u=self._unicode(hwnd)
   if not _int(u,-(1<<31),(1<<31)-1):raise Refused('NATIVE_UNICODE_BOOL_REQUIRED')
   row['unicodeRaw']=u;self._check();self._clear(0);self._check();style=self._style(hwnd,-16)
   if not _int(style,-(1<<63),(1<<63)-1):raise Refused('NATIVE_STYLE_LONG_PTR_REQUIRED')
   row['styleRaw']=style;saved=self._error()
   if not _int(saved,0,(1<<32)-1):raise Refused('STYLE_SAVED_ERROR_REQUIRED')
   row['rawSavedError']=saved;self._check();result=dict(unicode=u!=0,styleRaw=style,lastError=saved if style==0 else 0)
   if not _supported(style,result['unicode'],result['lastError']):self._blocked=True
   row['result']=result;return dict(result)
  except BaseException as error:self._remember(error);raise self._first
  finally:self._busy=False
 def _read(self,kind,hwnd,timeout):
  text=kind=='text';self._enter(('eligible',) if text else ('text',),'text' if text else 'selection')
  status=self._text if text else self._selection;status['attempted']=True;c=self._c
  try:
   self._target(hwnd)
   if not _int(timeout,1,250):raise Refused('BOUNDED_INTEGER_TIMEOUT_REQUIRED')
   if text:
    self._text_buffer=c.create_unicode_buffer(512);self._text_output=c.c_size_t(0);output=self._text_output
    message,wparam,lparam=13,512,c.cast(self._text_buffer,c.c_void_p).value
   else:
    self._selection_output=c.c_size_t(0);output=self._selection_output;message,wparam,lparam=0xb0,0,0
   pointer=c.byref(output);self._check();self._clear(0);self._check()
   raw=self._message(hwnd,message,wparam,lparam,0x23,timeout,pointer)
   if _int(raw,-(1<<63),(1<<63)-1):status['transportReturn']=raw
   value=output.value
   if _int(value,0,(1<<64)-1):status['messageResult']=value
   saved=self._error()
   if not _int(saved,0,(1<<32)-1):raise Refused('MESSAGE_SAVED_ERROR_UINT32_REQUIRED')
   if text:self._text_saved=saved
   else:self._selection_saved=saved
   status['lastError']=saved if raw==0 else 0;self._check()
   if status['transportReturn'] is None or status['messageResult'] is None:raise Refused('EXACT_MESSAGE_SCALARS_REQUIRED')
   result={k:status[k] for k in ('transportReturn','messageResult','lastError')}
   if raw==0:
    self._blocked=True
    if text:result.update(units=None,terminated=None)
    return result
   if text:
    if not _int(value,0,511):raise Refused('FIXED_BUFFER_TEXT_COUNT_REQUIRED')
    pointer=c.cast(self._text_buffer,c.POINTER(c.c_uint16));units=tuple(pointer[i] for i in range(value));terminated=pointer[value]==0
    self._check();result.update(units=units,terminated=terminated)
    if value==511 or not terminated:self._blocked=True
   return result
  except BaseException as error:status['failed']=True;self._remember(error);raise self._first
  finally:self._busy=False
 def read_text(self,hwnd,timeout):return self._read('text',hwnd,timeout)
 def read_selection(self,hwnd,timeout):return self._read('selection',hwnd,timeout)
 def readback_status(self):return dict(text=dict(self._text,bufferRetained=self._text_buffer is not None),selection=dict(self._selection))
 def snapshot(self):return _copy(dict(phase=self._phase,busy=self._busy,failed=self._first is not None,blocked=self._blocked,shortcut=self.shortcut_status(),rawShortcutSavedError=self._shortcut_saved,keyObservations=self._keys,eligibility=self._eligibility,readback=self.readback_status(),rawTextSavedError=self._text_saved,rawSelectionSavedError=self._selection_saved,textContentRetainedInSnapshot=False,buffersReleased=False,borrowedResourcesClosed=False,globalModifierReleaseProved=False,addressRole='UNKNOWN'))

def borrow_focus_port(original):return _FocusPort(original)
