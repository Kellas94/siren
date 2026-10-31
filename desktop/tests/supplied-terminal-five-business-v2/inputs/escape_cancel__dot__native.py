"""Lazy SOURCE only. Import inert; explicit construction loads inherited System32 DLLs.

No constructor or native call is executed by C1 controls. ABI tests use this AST
with an independent derived-layout model and a stub superclass, never ctypes.
"""
from topology.native import NativeTopologyFacade
from context.observer.adapter import ObservationRefused

def _input_types(c):
    WORD=c.c_uint16;DWORD=c.c_uint32;LONG=c.c_int32;ULONG_PTR=c.c_size_t
    class MOUSEINPUT(c.Structure):
        _fields_=[('dx',LONG),('dy',LONG),('mouseData',DWORD),('dwFlags',DWORD),('time',DWORD),('dwExtraInfo',ULONG_PTR)]
    class KEYBDINPUT(c.Structure):
        _fields_=[('wVk',WORD),('wScan',WORD),('dwFlags',DWORD),('time',DWORD),('dwExtraInfo',ULONG_PTR)]
    class HARDWAREINPUT(c.Structure):
        _fields_=[('uMsg',DWORD),('wParamL',WORD),('wParamH',WORD)]
    class INPUTUNION(c.Union):
        _fields_=[('mi',MOUSEINPUT),('ki',KEYBDINPUT),('hi',HARDWAREINPUT)]
    class INPUT(c.Structure):
        _fields_=[('type',DWORD),('u',INPUTUNION)]
    pointer=c.sizeof(c.c_void_p)
    if pointer not in [4,8] or c.sizeof(ULONG_PTR)!=pointer or c.sizeof(WORD)!=2 or c.sizeof(DWORD)!=4 or c.sizeof(LONG)!=4:raise ObservationRefused('INPUT_SCALARS_REFUSED')
    expected={4:(16,12,24,20,24,4,28,4,56),8:(24,16,32,24,32,8,40,8,80)}[pointer]
    actual=(c.sizeof(KEYBDINPUT),KEYBDINPUT.dwExtraInfo.offset,c.sizeof(MOUSEINPUT),MOUSEINPUT.dwExtraInfo.offset,c.sizeof(INPUTUNION),INPUT.u.offset,c.sizeof(INPUT),c.alignment(INPUT),c.sizeof(INPUT*2))
    if actual!=expected or c.sizeof(HARDWAREINPUT)!=8:raise ObservationRefused('FULL_INPUT_UNION_LAYOUT_REFUSED')
    return INPUT

class NativeEscapeFacade(NativeTopologyFacade):
    def __init__(self):
        super().__init__()
        c=self._c;self._INPUT=_input_types(c);user=self._dlls[1]
        declarations={'SendInput':([c.c_uint32,c.POINTER(self._INPUT),c.c_int32],c.c_uint32),'GetAsyncKeyState':([c.c_int32],c.c_int16)}
        for name,(arguments,result) in declarations.items():
            function=getattr(user,name);function.argtypes=arguments;function.restype=result;self._fn[name]=function
        self._key_state=self._fn['GetAsyncKeyState']
    def get_async_key_state(self,key):return self._key_state(key)
    def prepare_escape(self):
        c=self._c;INPUT=self._INPUT;events=(INPUT*2)()  # ctypes zero initializes.
        for index,flags in [(0,0),(1,2)]:
            events[index].type=1;events[index].u.ki.wVk=27;events[index].u.ki.dwFlags=flags
        send=self._fn['SendInput'];clear=c.set_last_error;error=c.get_last_error;size=c.sizeof(INPUT)
        def dispatch():
            clear(0)
            count=send(2,events,size)
            code=error() if count!=2 else 0
            return count,code
        return dispatch
