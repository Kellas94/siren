"""Lazy typed readonly Win32 facade SOURCE. Never constructed in these controls."""
from .adapter import ObservationRefused

class NativeQueryError(ObservationRefused):
    def __init__(self,operation,code):
        self.operation=operation;self.winerror=code;super().__init__('WIN32_QUERY_FAILED:'+operation+':'+str(code))

class NativeFacade:
    def __init__(self):
        import os
        if os.name!='nt':raise ObservationRefused('WINDOWS_ONLY_EXPLICIT_CONSTRUCTION')
        import ctypes as c  # No ctypes or WinDLL on package import.
        DWORD=c.c_uint32;BOOL=c.c_int32;HANDLE=HWND=c.c_void_p;LPARAM=c.c_ssize_t;LONG=c.c_int32
        class FILETIME(c.Structure):_fields_=[('low',DWORD),('high',DWORD)]
        class RECT(c.Structure):_fields_=[('left',LONG),('top',LONG),('right',LONG),('bottom',LONG)]
        class GUITHREADINFO(c.Structure):_fields_=[('cbSize',DWORD),('flags',DWORD),('hwndActive',HWND),('hwndFocus',HWND),('hwndCapture',HWND),('hwndMenuOwner',HWND),('hwndMoveSize',HWND),('hwndCaret',HWND),('rcCaret',RECT)]
        self.pointer_bits=c.sizeof(HANDLE)*8;self.guithreadinfo_size=c.sizeof(GUITHREADINFO)
        if self.pointer_bits not in [32,64] or self.guithreadinfo_size!={32:48,64:72}[self.pointer_bits] or c.sizeof(FILETIME)!=8 or c.sizeof(c.c_wchar)!=2:raise ObservationRefused('NATIVE_ABI_REFUSED')
        self._c=c;self._DWORD=DWORD;self._FILETIME=FILETIME;self._GUI=GUITHREADINFO;self._enum_type=c.WINFUNCTYPE(BOOL,HWND,LPARAM)
        # Fixed system DLL names, System32-only search flag; no caller path/env.
        kernel=c.WinDLL('kernel32.dll',use_last_error=True,winmode=0x00000800);user=c.WinDLL('user32.dll',use_last_error=True,winmode=0x00000800);self._dlls=(kernel,user)
        declarations={
          'GetProcessId':(kernel,[HANDLE],DWORD),'GetProcessTimes':(kernel,[HANDLE,c.POINTER(FILETIME),c.POINTER(FILETIME),c.POINTER(FILETIME),c.POINTER(FILETIME)],BOOL),
          'QueryFullProcessImageNameW':(kernel,[HANDLE,DWORD,c.POINTER(c.c_wchar),c.POINTER(DWORD)],BOOL),'GetExitCodeProcess':(kernel,[HANDLE,c.POINTER(DWORD)],BOOL),'WaitForSingleObject':(kernel,[HANDLE,DWORD],DWORD),
          'IsWindow':(user,[HWND],BOOL),'GetWindowThreadProcessId':(user,[HWND,c.POINTER(DWORD)],DWORD),'GetClassNameW':(user,[HWND,c.POINTER(c.c_wchar),c.c_int32],c.c_int32),'GetWindow':(user,[HWND,c.c_uint32],HWND),'IsWindowVisible':(user,[HWND],BOOL),'IsWindowEnabled':(user,[HWND],BOOL),
          'EnumWindows':(user,[self._enum_type,LPARAM],BOOL),'GetForegroundWindow':(user,[],HWND),'GetGUIThreadInfo':(user,[DWORD,c.POINTER(GUITHREADINFO)],BOOL),'IsChild':(user,[HWND,HWND],BOOL)}
        self._fn={}
        for name,(dll,args,result) in declarations.items():
            fn=getattr(dll,name);fn.argtypes=args;fn.restype=result;self._fn[name]=fn
    def _check(self,result,name):
        if not result:raise NativeQueryError(name,self._c.get_last_error())
        return result
    def process_id(self,h):return int(self._check(self._fn['GetProcessId'](h),'GetProcessId'))
    def process_times(self,h):
        c=self._c;created,exit,kernel,user=(self._FILETIME() for _ in range(4));self._check(self._fn['GetProcessTimes'](h,c.byref(created),c.byref(exit),c.byref(kernel),c.byref(user)),'GetProcessTimes');return (int(created.low),int(created.high))
    def process_image(self,h,capacity):
        c=self._c;buf=c.create_unicode_buffer(capacity);length=self._DWORD(capacity);self._check(self._fn['QueryFullProcessImageNameW'](h,0,buf,c.byref(length)),'QueryFullProcessImageNameW');n=int(length.value)
        if not 0<n<capacity:raise ObservationRefused('NATIVE_IMAGE_COUNT_REFUSED')
        return (buf[:n],n,buf[n]=='\0')
    def process_exit_code(self,h):
        result=self._DWORD();self._check(self._fn['GetExitCodeProcess'](h,self._c.byref(result)),'GetExitCodeProcess');return int(result.value)
    def wait_process(self,h):return int(self._fn['WaitForSingleObject'](h,0))
    def is_window(self,h):return bool(self._fn['IsWindow'](h))
    def thread_process(self,h):
        pid=self._DWORD();tid=self._check(self._fn['GetWindowThreadProcessId'](h,self._c.byref(pid)),'GetWindowThreadProcessId');return (int(tid),int(pid.value))
    def class_name(self,h,capacity):
        buf=self._c.create_unicode_buffer(capacity);n=int(self._check(self._fn['GetClassNameW'](h,buf,capacity),'GetClassNameW'))
        if not 0<n<capacity:raise ObservationRefused('NATIVE_CLASS_COUNT_REFUSED')
        return (buf[:n],n,buf[n]=='\0')
    def owner(self,h):
        self._c.set_last_error(0);owner=self._fn['GetWindow'](h,4);error=self._c.get_last_error()
        if not owner and error:raise NativeQueryError('GetWindow(GW_OWNER)',error)
        return int(owner or 0)
    def visible(self,h):return bool(self._fn['IsWindowVisible'](h))
    def enabled(self,h):return bool(self._fn['IsWindowEnabled'](h))
    def enum_windows(self,collect):
        first_present=False;first=None
        def visit(hwnd,lparam):
            nonlocal first_present,first
            if first_present:return 0
            try:return 1 if collect(int(hwnd or 0)) is True else 0
            except BaseException as error:first_present=True;first=error;return 0
        proc=self._enum_type(visit)  # Strong local reference spans synchronous enumeration.
        try:result=self._fn['EnumWindows'](proc,0)
        except BaseException:
            if first_present:raise first
            raise
        if first_present:raise first
        return bool(result)
    def foreground(self):return int(self._fn['GetForegroundWindow']() or 0)
    def gui_thread_info(self,tid):
        value=self._GUI();value.cbSize=self.guithreadinfo_size;self._check(self._fn['GetGUIThreadInfo'](tid,self._c.byref(value)),'GetGUIThreadInfo');return (int(value.cbSize),int(value.hwndActive or 0),int(value.hwndFocus or 0))
    def is_child(self,parent,child):return bool(self._fn['IsChild'](parent,child))
