"""Private passive call-through; exact canonical C1 owns every guard and input.

Cached expected context is conditional on the trusted no-private-field-writer
invariant. It is deliberately NOT labeled a directly captured local operand.
"""
import escape_cancel as canonical
from context.reference import folder_dialog_driver as model

_CAPABILITIES=('pointer_bits','guithreadinfo_size','process_id','process_times','process_image','process_exit_code','wait_process','is_window','thread_process','class_name','owner','visible','enabled','enum_windows','foreground','gui_thread_info','is_child','prepare_escape','get_async_key_state')
_BASIS='CANONICAL_CAPTURED_HWND_BEFORE_FOREGROUND'
_INVARIANT='ONLY_CANONICAL_OBSERVE_WRITES_CAPTURED'
class DiagnosticRefused(RuntimeError):pass

class _ForwardingFacade:
    __slots__=('_source','_trace')
    def __init__(self,source,trace):self._source=source;self._trace=trace
    def __getattr__(self,name):
        if name not in _CAPABILITIES:raise AttributeError(name)
        # Preserve canonical construction order, getter results and receivers.
        value=getattr(self._source,name)
        if name=='pointer_bits':self._trace._bits=value
        if name=='foreground' and callable(value):
            self._trace._query=value
            return self._trace.foreground
        return value

class _ForegroundTrace:
    def __init__(self):
        self._driver=None;self._bits=None;self._query=None
        self._rows=[];self._errors=[];self._failed=False;self._error_count=0
        self._calls=0;self._overflow=0
    def bind(self,operation):
        if type(operation) is not canonical._EscapeCancel:raise TypeError('EXACT_CANONICAL_CANCEL_REQUIRED')
        driver=object.__getattribute__(operation,'_driver')
        if type(driver) is not model.FolderDialogDriver:raise TypeError('EXACT_CANONICAL_DRIVER_REQUIRED')
        self._driver=driver
    def _remember(self,error):
        self._failed=True;self._error_count=min(2**32-1,self._error_count+1)
        if len(self._errors)<8:self._errors.append(error)
    def _failure(self,error):
        # Original query/result/exception stays authoritative even if retaining
        # a diagnostic exception itself fails. The sticky bit precedes that IO.
        self._failed=True
        try:self._remember(error)
        except BaseException:pass
    def _context(self):
        d=self._driver
        if type(d) is not model.FolderDialogDriver or object.__getattribute__(d,'_busy') is not True or object.__getattribute__(d,'_blocked') is not False or object.__getattribute__(d,'_consumed') is not False or object.__getattribute__(d,'_first_present') is not False:raise DiagnosticRefused('CANONICAL_ACTIVE_CONTEXT_UNAVAILABLE')
        captured=object.__getattribute__(d,'_captured')
        if type(captured) is not tuple or len(captured)!=2:raise DiagnosticRefused('CANONICAL_CAPTURE_UNAVAILABLE')
        window,chain=captured
        if type(window) is not model.Window or type(chain) is not tuple or not 1<=len(chain)<=32 or any(type(w) is not model.Window for w in chain) or chain[0]!=window:raise DiagnosticRefused('CANONICAL_CAPTURE_SHAPE_UNAVAILABLE')
        hwnd=object.__getattribute__(window,'hwnd')
        if type(hwnd) is not int or self._bits not in [32,64] or not 0<hwnd<2**self._bits:raise DiagnosticRefused('CANONICAL_CAPTURE_HWND_UNAVAILABLE')
        return str(hwnd)
    def _append(self,row):self._rows.append(row)
    def _retain(self,row):
        if row is None:return
        try:self._append(row)
        except BaseException as error:self._failure(error)
    def foreground(self):
        # Reserve before diagnostic inspection and before the sole original
        # query. Overflow affects evidence only, never the original callout.
        self._calls+=1;ordinal=self._calls;row=None
        if ordinal<=2:
            try:
                row=dict(ordinal=ordinal,expectedBasis=_BASIS,expectedStatus='UNAVAILABLE',expectedHwnd=None,queryStatus='PENDING',foregroundStatus='UNAVAILABLE',foregroundHwnd=None)
                row['expectedHwnd']=self._context();row['expectedStatus']='CACHED'
            except BaseException as error:self._failure(error)
        else:
            self._overflow=min(2**32-1,self._overflow+1)
            self._failure(DiagnosticRefused('FOREGROUND_DIAGNOSTIC_RECORD_OVERFLOW'))
        try:value=self._query()
        except BaseException:
            if row is not None:row['queryStatus']='THREW'
            self._retain(row)
            raise
        if row is not None:
            row['queryStatus']='RETURNED'
            try:
                if type(value) is int and self._bits in [32,64] and 0<=value<2**self._bits:
                    row['foregroundHwnd']=str(value);row['foregroundStatus']='HWND'
                else:row['foregroundStatus']='UNSUPPORTED_RAW'
            except BaseException as error:self._failure(error)
        self._retain(row)
        return value
    def snapshot(self):
        return dict(schema=1,phase='c1-foreground',observations=[dict(row) for row in self._rows],totalForegroundCalls=self._calls,overflowCount=self._overflow,truncated=self._overflow>0,diagnosticErrorCount=max(int(self._failed),self._error_count),expectedBasisInvariant=_INVARIANT,directLocalOperandCaptured=False)

class _ObservedEscapeCancel:
    def __init__(self,facade,binding,monotonic,record):
        trace=_ForegroundTrace()
        operation=canonical.create_escape_cancel(_ForwardingFacade(facade,trace),binding,monotonic,record=record)
        trace.bind(operation);self._trace=trace;self._operation=operation
    def cancel(self):return self._operation.cancel()
    def snapshot(self):return self._operation.snapshot()
    @property
    def secondary_errors(self):return self._operation.secondary_errors
    def discovery_snapshot(self):return self._trace.snapshot()
    @property
    def discovery_secondary_errors(self):return tuple(self._trace._errors)

def create_observed_escape_cancel(facade,binding,monotonic,record=None):
    return _ObservedEscapeCancel(facade,binding,monotonic,record)
