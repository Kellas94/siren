"""Import-inert private QA policy. All OS capabilities require a trusted adapter.

No ctypes, DLL load, process opening, UI input or product hook occurs on import.
This is not a public/renderer API. The injected adapter is a test seam and trusted
future controller capability, not proof of native ownership or physical success.
"""
from dataclasses import dataclass
import ntpath

FIXED_CWD=r'C:\Claude\SIREN_WORK\terminal-real-folder-dialog-driver-v2-20261018\owned-cwd'
class Refused(RuntimeError):pass
@dataclass(frozen=True)
class ProcessIdentity:
    pid:int
    image:str
    created_filetime:str
    running:bool
@dataclass(frozen=True)
class Binding:
    original_handle:int
    pid:int
    image:str
    created_filetime:str
    parent_hwnd:int
    parent_tid:int
    parent_class:str
@dataclass(frozen=True)
class Window:
    hwnd:int
    pid:int
    tid:int
    class_name:str
    owner:int
    visible:bool
    enabled:bool
def _positive(v):return type(v) is int and v>0
def _decimal(v):return type(v) is str and v.isascii() and v.isdecimal() and v[0]!='0' and len(v)<=20 and int(v)<2**64
def _canonical(v):
    return type(v) is str and 3<len(v)<=260 and len(ntpath.splitdrive(v)[0])==2 and v[1:3]==':\\' and ntpath.normpath(v)==v and not any(ord(c)<32 or c in '/<>"|?*' for c in v) and ':' not in v[2:] and all(s and not s.endswith((' ','.')) for s in v[3:].split('\\'))

class FolderDialogDriver:
    """One fixed dialog, one action, no retry. The caller owns HANDLE lifetime.

    Adapter contracts are specified in API-CONTRACT.md. No adapter is included:
    real dialog topology, actual Shell readback and message transport must first
    be source reviewed and separately observed. Binding must be trusted original
    controller HANDLE + actual MAIN parent observation, never renderer data.
    """
    def __init__(self,api,binding):
        if type(binding) is not Binding or not all(_positive(v) for v in [binding.original_handle,binding.pid,binding.parent_hwnd,binding.parent_tid]) or not _canonical(binding.image) or not _decimal(binding.created_filetime) or type(binding.parent_class) is not str or not binding.parent_class or not _canonical(FIXED_CWD):raise Refused('BINDING_REFUSED')
        self._binding=binding
        # Capture bound methods/receivers, never later replace a method via api.
        names=['process_identity','enum_windows','window','foreground','gui_focus','is_child','path_current','shell_location','dialog_button','send_input','click_button','monotonic','wait']
        self._api={n:getattr(api,n) for n in names}
        if not all(callable(f) for f in self._api.values()):raise Refused('API_REFUSED')
        self._blocked=False;self._first_present=False;self._first=None;self._busy=False;self._consumed=False;self._captured=None;self._deadline=None
    @property
    def blocked(self):return self._blocked
    @property
    def first_error(self):return self._first if self._first_present else None
    def _remember(self,error):
        if not self._first_present:self._first_present=True;self._first=error
        self._blocked=True
    def _fail(self,code):raise Refused(code)
    def _call(self,name,*args):
        value=self._api[name](*args)
        if self._blocked:self._fail('REENTRANT_OR_STICKY_REFUSAL')
        return value
    def _now(self):
        now=self._call('monotonic')
        if type(now) not in [float,int] or not -float('inf')<now<float('inf'):self._fail('CLOCK_REFUSED')
        return now
    def _time(self):
        if self._now()>=self._deadline:self._fail('TOTAL_DIALOG_BUDGET_EXPIRED')
    def _process(self):
        actual=self._call('process_identity',self._binding.original_handle)
        expected=ProcessIdentity(self._binding.pid,self._binding.image,self._binding.created_filetime,True)
        if type(actual) is not ProcessIdentity or actual!=expected:self._fail('ORIGINAL_PROCESS_IDENTITY_REFUSED')
    def _window(self,hwnd):
        w=self._call('window',hwnd)
        if type(w) is not Window or w.hwnd!=hwnd or not all(_positive(v) for v in [w.hwnd,w.pid,w.tid]) or type(w.owner) is not int or w.owner<0 or type(w.class_name) is not str or not w.class_name or type(w.visible) is not bool or type(w.enabled) is not bool:self._fail('WINDOW_DISAPPEARED_OR_MALFORMED')
        return w
    def _parent(self):
        p=self._window(self._binding.parent_hwnd)
        if p.pid!=self._binding.pid or p.tid!=self._binding.parent_tid or p.class_name!=self._binding.parent_class or not p.visible:self._fail('DESIGNATED_PARENT_CHANGED')
        return p
    def _chain(self,dialog,parent):
        chain=[];seen=set();next_hwnd=dialog.hwnd
        for _ in range(32):  # Bounded QA traversal; unsupported chains refuse.
            if next_hwnd in seen:self._fail('OWNER_CYCLE')
            seen.add(next_hwnd);w=self._window(next_hwnd)
            if w.pid!=self._binding.pid:self._fail('FOREIGN_OWNER')
            chain.append(w)
            if next_hwnd==parent.hwnd:return tuple(chain)
            if not w.owner:self._fail('DESIGNATED_OWNER_CHAIN_MISSING')
            next_hwnd=w.owner
        self._fail('OWNER_CHAIN_TOO_DEEP')
    def _observe(self):
        self._time();self._process();parent=self._parent();handles=self._call('enum_windows')
        if type(handles) is not tuple or len(handles)>4096 or len(set(handles))!=len(handles) or any(not _positive(h) for h in handles):self._fail('ENUMERATION_REFUSED')
        candidates=[]
        for hwnd in handles:
            w=self._window(hwnd)
            if w.class_name=='#32770' and w.pid==self._binding.pid and w.visible and w.enabled:candidates.append((w,self._chain(w,parent)))
        if len(candidates)!=1:self._fail('EXACTLY_ONE_OWNED_DIALOG_REQUIRED')
        current=candidates[0]
        if self._captured is None:self._captured=current
        elif current!=self._captured:self._fail('CAPTURED_DIALOG_CHANGED')
        self._process();self._time();return current[0]
    def _guard(self):
        dialog=self._observe()
        if self._call('foreground')!=dialog.hwnd:self._fail('FOREGROUND_REFUSED')
        focus=self._call('gui_focus',dialog.tid)
        if type(focus) is not tuple or len(focus)!=2 or focus[0]!=dialog.hwnd or not _positive(focus[1]):self._fail('ACTIVE_FOCUS_REFUSED')
        child=self._window(focus[1])
        if child.pid!=dialog.pid or child.tid!=dialog.tid or not child.visible or not child.enabled or (child.hwnd!=dialog.hwnd and self._call('is_child',dialog.hwnd,child.hwnd) is not True):self._fail('FOCUS_OUTSIDE_DIALOG')
        # Current process, window/chain and focus are reobserved at every batch.
        self._process();self._time();return dialog,child
    def _path(self):
        if self._call('path_current',FIXED_CWD) is not True:self._fail('FIXED_OWNED_DIRECTORY_CHANGED')
    def _send(self,events,edit=False):
        _,focus=self._guard()
        if edit and focus.class_name!='Edit':self._fail('UNSUPPORTED_ADDRESS_EDIT')
        if self._call('send_input',events)!=len(events):self._fail('PARTIAL_INPUT_INSERTION')
    def _operate(self,fn):
        if self._busy or self._blocked or self._consumed:
            error=Refused('ONE_ACTION_NO_REENTRY_OR_RETRY');self._remember(error);raise error
        self._busy=True
        try:
            if self._deadline is None:self._deadline=self._now()+10.0
            return fn()
        except BaseException as error:self._remember(error);raise
        finally:self._busy=False
    def discover(self):
        return self._operate(lambda:self._observe().hwnd)
    def cancel(self):
        def action():
            self._send(((0x1b,0,0),(0x1b,0,2)));self._consumed=True
            return dict(inputSent=True,physicalSuccess=False,action='cancel')
        return self._operate(action)
    def select(self):
        def action():
            self._path()
            self._send(((0x11,0,0),(0x4c,0,0),(0x4c,0,2),(0x11,0,2)))
            self._path()
            raw=FIXED_CWD.encode('utf-16-le');events=tuple((0,int.from_bytes(raw[i:i+2],'little'),flags) for i in range(0,len(raw),2) for flags in [4,6])
            self._send(events,edit=True);self._path();self._send(((0x0d,0,0),(0x0d,0,2)),edit=True)
            while True:
                dialog,_=self._guard();self._path()
                location=self._call('shell_location',dialog.hwnd)
                if type(location) is str and location==FIXED_CWD:break
                self._time();self._call('wait',0.05)
            button=self._call('dialog_button',dialog.hwnd,1)
            if not _positive(button):self._fail('UNSUPPORTED_CONFIRM_BUTTON')
            target=self._window(button)
            if target.class_name!='Button' or target.pid!=dialog.pid or target.tid!=dialog.tid or not target.visible or not target.enabled or self._call('is_child',dialog.hwnd,button) is not True:self._fail('CONFIRM_BUTTON_REFUSED')
            self._guard();self._path();self._time()
            if self._call('click_button',button) is not True:self._fail('CONFIRM_DISPATCH_UNKNOWN')
            self._consumed=True
            return dict(inputSent=True,physicalSuccess=False,action='select')
        return self._operate(action)
