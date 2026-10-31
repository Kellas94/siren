"""Readonly adapter logic, injected typed facade only. No ctypes/OS import."""
class ObservationRefused(RuntimeError):pass

class ObservationAdapter:
    def __init__(self,facade,original_handle,driver_model):
        bits=facade.pointer_bits;size=facade.guithreadinfo_size
        if type(bits) is not int or bits not in [32,64] or type(size) is not int or size!={32:48,64:72}[bits]:raise ObservationRefused('FACADE_ABI_REFUSED')
        self._max_handle=2**bits-1;self._handle=self._process_handle(original_handle)
        self._gui_size=size;self._ProcessIdentity=driver_model.ProcessIdentity;self._Window=driver_model.Window
        if not isinstance(self._ProcessIdentity,type) or not isinstance(self._Window,type):raise ObservationRefused('TRUSTED_DRIVER_MODEL_REQUIRED')
        names=['process_id','process_times','process_image','process_exit_code','wait_process','is_window','thread_process','class_name','owner','visible','enabled','enum_windows','foreground','gui_thread_info','is_child']
        self._f={n:getattr(facade,n) for n in names}
        if not all(callable(f) for f in self._f.values()):raise ObservationRefused('FACADE_FUNCTION_REFUSED')
        self._enumerating=False
    def _positive_handle(self,h):
        if type(h) is not int or not 0<h<=self._max_handle:raise ObservationRefused('HANDLE_REFUSED')
        return h
    def _process_handle(self,h):
        h=self._positive_handle(h)
        if h in [2**32-1,2**64-1]:raise ObservationRefused('PSEUDO_PROCESS_HANDLE_REFUSED')
        return h
    def _optional_handle(self,h):
        if type(h) is not int or not 0<=h<=self._max_handle:raise ObservationRefused('OPTIONAL_HANDLE_REFUSED')
        return h
    @staticmethod
    def _dword(value,zero=True):
        if type(value) is not int or not (0 if zero else 1)<=value<2**32:raise ObservationRefused('DWORD_REFUSED')
        return value
    @staticmethod
    def _bool(value):
        if type(value) is not bool:raise ObservationRefused('BOOL_REFUSED')
        return value
    @staticmethod
    def _tuple(value,n):
        if type(value) is not tuple or len(value)!=n:raise ObservationRefused('TYPED_RESULT_REFUSED')
        return value
    def _filetime(self,value):
        low,high=self._tuple(value,2);result=(self._dword(high)<<32)|self._dword(low)
        if not result:raise ObservationRefused('CREATION_TIME_REFUSED')
        return str(result)
    def _text(self,value,capacity,class_name=False):
        text,count,terminated=self._tuple(value,3)
        if type(text) is not str or type(count) is not int or type(terminated) is not bool or not terminated or not 0<count<capacity or '\0' in text:raise ObservationRefused('TEXT_QUERY_REFUSED')
        try:units=len(text.encode('utf-16-le'))//2
        except UnicodeError:raise ObservationRefused('TEXT_ENCODING_REFUSED') from None
        if units!=count or class_name and count>=capacity-1:raise ObservationRefused('TEXT_TRUNCATION_OR_COUNT_REFUSED')
        if not class_name and (len(text)<3 or text[1:3]!=':\\' or not text[0].isascii() or not text[0].isalpha()):raise ObservationRefused('IMAGE_PATH_REFUSED')
        return text
    def _wait(self):
        value=self._f['wait_process'](self._handle)
        if type(value) is not int or value not in [0,258]:raise ObservationRefused('PROCESS_WAIT_UNKNOWN')
        return value
    def process_identity(self,original_handle):
        if self._process_handle(original_handle)!=self._handle:raise ObservationRefused('ORIGINAL_HANDLE_ONLY')
        before=self._wait();pid=self._dword(self._f['process_id'](self._handle),False);created=self._filetime(self._f['process_times'](self._handle));image=self._text(self._f['process_image'](self._handle,32768),32768);exit_code=self._dword(self._f['process_exit_code'](self._handle))
        pid_after=self._dword(self._f['process_id'](self._handle),False);created_after=self._filetime(self._f['process_times'](self._handle));after=self._wait()
        if pid_after!=pid or created_after!=created or before==0 and after!=0:raise ObservationRefused('HELD_PROCESS_IDENTITY_CHANGED')
        if after==258 and exit_code!=259:raise ObservationRefused('PROCESS_EXIT_WAIT_INCONSISTENT')
        return self._ProcessIdentity(pid,image,created,after==258)
    def _one_window(self,hwnd):
        if not self._bool(self._f['is_window'](hwnd)):return None
        tid,pid=self._tuple(self._f['thread_process'](hwnd),2);tid=self._dword(tid,False);pid=self._dword(pid,False)
        name=self._text(self._f['class_name'](hwnd,512),512,True);owner=self._optional_handle(self._f['owner'](hwnd));visible=self._bool(self._f['visible'](hwnd));enabled=self._bool(self._f['enabled'](hwnd))
        if not self._bool(self._f['is_window'](hwnd)):return None
        return (hwnd,pid,tid,name,owner,visible,enabled)
    def window(self,hwnd):
        hwnd=self._positive_handle(hwnd);before=self._one_window(hwnd)
        if before is None:return None
        after=self._one_window(hwnd)
        if after is None:return None
        if before!=after:raise ObservationRefused('WINDOW_CHANGED_DURING_OBSERVATION')
        return self._Window(*after)
    def enum_windows(self):
        if self._enumerating:raise ObservationRefused('ENUM_REENTRY_REFUSED')
        self._enumerating=True;values=[];seen=set();present=False;first=None
        def collect(hwnd):
            nonlocal present,first
            if present:return False
            try:
                self._positive_handle(hwnd)
                if len(values)>=4096 or hwnd in seen:raise ObservationRefused('ENUM_LIMIT_OR_DUPLICATE')
                seen.add(hwnd);values.append(hwnd);return True
            except BaseException as error:present=True;first=error;return False
        try:
            try:complete=self._f['enum_windows'](collect)
            except BaseException:
                if present:raise first
                raise
            if present:raise first
            if self._bool(complete) is not True:raise ObservationRefused('ENUM_QUERY_FAILED')
            return tuple(values)
        finally:self._enumerating=False
    def foreground(self):return self._optional_handle(self._f['foreground']())
    def gui_focus(self,tid):
        tid=self._dword(tid,False);size,active,focus=self._tuple(self._f['gui_thread_info'](tid),3)
        if type(size) is not int or size!=self._gui_size:raise ObservationRefused('GUI_STRUCTURE_SIZE_REFUSED')
        return (self._optional_handle(active),self._optional_handle(focus))
    def is_child(self,parent,child):
        parent=self._positive_handle(parent);child=self._positive_handle(child)
        for h in [parent,child]:
            if not self._bool(self._f['is_window'](h)):raise ObservationRefused('CHILD_WINDOW_MISSING')
        answer=self._bool(self._f['is_child'](parent,child))
        for h in [parent,child]:
            if not self._bool(self._f['is_window'](h)):raise ObservationRefused('CHILD_WINDOW_DISAPPEARED')
        return answer
    def send_input(self,*args):raise ObservationRefused('UNIMPLEMENTED_INPUT')
    def click_button(self,*args):raise ObservationRefused('UNIMPLEMENTED_CLICK')
    def path_current(self,*args):raise ObservationRefused('UNIMPLEMENTED_PHYSICAL_PATH')
    def shell_location(self,*args):raise ObservationRefused('UNIMPLEMENTED_SHELL_READBACK')
    def dialog_button(self,*args):raise ObservationRefused('UNIMPLEMENTED_CONTROL_TOPOLOGY')
    def monotonic(self,*args):raise ObservationRefused('UNIMPLEMENTED_CONTROLLER_CLOCK')
    def wait(self,*args):raise ObservationRefused('UNIMPLEMENTED_CONTROLLER_WAIT')
