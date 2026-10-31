"""Private fixed-Escape QA capability. Import performs no native construction.

Trusted future controller must bind the one pinned external T1 module namespace
and retain the original Popen/Handle. A numeric HANDLE alone is not authority.
This factory's facade/record seams are inert-test/private-controller seams only.
"""
from types import SimpleNamespace
from weakref import ref,WeakMethod
from context.reference import folder_dialog_driver as model
from context.observer.adapter import ObservationAdapter,ObservationRefused

_PAIR=((27,0,0),(27,0,2))
_KEYS=(27,16,17,18,160,161,162,163,164,165,91,92)
_DRIVER=model.FolderDialogDriver
_GUARD=_DRIVER._guard

def _fixed_pair(events):
    return type(events) is tuple and len(events)==2 and all(type(row) is tuple and len(row)==3 and all(type(value) is int for value in row) for row in events) and events==_PAIR

class _Transport:
    def __init__(self,facade):
        self._prepare=facade.prepare_escape;self._key=facade.get_async_key_state
        if not callable(self._prepare) or not callable(self._key):raise ObservationRefused('FIXED_INPUT_FACADE_REQUIRED')
        self._sealed=False;self._driver=None;self._guard=None;self._used=False
        self._attempted=False;self._raw_count=None;self._raw_error=None
    def seal(self,driver):
        if self._sealed:raise ObservationRefused('GUARD_ALREADY_SEALED')
        self._sealed=True
        if type(driver) is not _DRIVER:raise ObservationRefused('EXACT_DRIVER_REQUIRED')
        guard=driver._guard
        if guard.__self__ is not driver or guard.__func__ is not _GUARD:raise ObservationRefused('ORIGINAL_GUARD_REQUIRED')
        self._driver=ref(driver);self._guard=WeakMethod(guard)
    def _active(self):
        driver=self._driver() if self._driver else None
        guard=self._guard() if self._guard else None
        if driver is None or guard is None:raise ObservationRefused('LIVE_SEALED_DRIVER_REQUIRED')
        if driver._first_present:raise driver.first_error
        if not driver._busy or driver._blocked or driver._consumed or driver._deadline is None:raise ObservationRefused('ACTIVE_CANCEL_REQUIRED')
        return driver,guard
    def send_input(self,events):
        if not _fixed_pair(events):raise ObservationRefused('ONLY_FIXED_ESCAPE_PAIR')
        self._active()
        if self._used:raise ObservationRefused('NO_INPUT_REPLAY')
        self._used=True  # Before preparation, key-query or guard callouts.
        dispatch=self._prepare()
        if not callable(dispatch):raise ObservationRefused('PREPARED_DISPATCH_REQUIRED')
        self._active()
        for key in _KEYS:
            value=self._key(key)
            self._active()
            if type(value) is not int or not -32768<=value<=32767:raise ObservationRefused('SHORT_KEY_STATE_REQUIRED')
            if value & 0x8000:raise ObservationRefused('SAMPLED_MODIFIER_OR_ESCAPE_PRESSED')
        driver,guard=self._active()
        guard()  # Direct original method, never _operate/discover recursion.
        self._active()  # Local fields only; no external callout after guard.
        self._attempted=True
        raw=dispatch()  # Exactly one fixed batch, never recovery or retry.
        if type(raw) is not tuple or len(raw)!=2:raise ObservationRefused('NATIVE_RESULT_UNKNOWN')
        self._raw_count,self._raw_error=raw
        if type(self._raw_count) is not int or self._raw_count not in [0,1,2] or type(self._raw_error) is not int or not 0<=self._raw_error<2**32:raise ObservationRefused('NATIVE_RESULT_MALFORMED')
        return self._raw_count  # D._send owns the exact count comparison.
    def snapshot(self):
        return dict(attempted=self._attempted,rawCount=self._raw_count,rawError=self._raw_error,physicalSuccess=False)

class _EscapeCancel:
    def __init__(self,driver,transport,record):
        self._driver=driver;self._transport=transport;self._cancel=driver.cancel;self._record=record
        self._busy=False;self._first_present=False;self._first=None;self._secondary=[]
    @property
    def secondary_errors(self):return tuple(self._secondary)
    def snapshot(self):return self._transport.snapshot()
    def _remember(self,error):
        if not self._first_present:
            self._first_present=True;self._first=error
            if not self._driver._first_present:self._driver._remember(error)
    def cancel(self):
        if self._first_present:raise self._first
        if self._busy:
            error=model.Refused('ONE_ACTION_NO_REENTRY_OR_RETRY');self._remember(error);raise self._first
        self._busy=True;answer=None
        try:
            try:answer=self._cancel()
            except BaseException as error:self._remember(self._driver.first_error if self._driver._first_present else error)
            if self._record is not None:
                try:self._record(self.snapshot())
                except BaseException as error:
                    if self._first_present:self._secondary.append(error)
                    else:self._remember(error)
            if self._first_present:raise self._first
            return answer
        finally:self._busy=False

def create_escape_cancel(facade,binding,monotonic,record=None):
    if not callable(monotonic) or record is not None and not callable(record):raise ObservationRefused('PRIVATE_CALLBACK_REQUIRED')
    observer=ObservationAdapter(facade,binding.original_handle,model)
    transport=_Transport(facade)
    names=['process_identity','enum_windows','window','foreground','gui_focus','is_child','path_current','shell_location','dialog_button','click_button','wait']
    shim=SimpleNamespace(**{name:getattr(observer,name) for name in names},send_input=transport.send_input,monotonic=monotonic)
    driver=_DRIVER(shim,binding);transport.seal(driver)
    return _EscapeCancel(driver,transport,record)
