"""Lazy readonly query extension; never constructed by these inert controls."""
from context.observer.native import NativeFacade
from context.observer.adapter import ObservationRefused

class NativeTopologyFacade(NativeFacade):
    def __init__(self):
        super().__init__()
        c=self._c;user=self._dlls[1]
        declarations={'EnumChildWindows':([c.c_void_p,self._enum_type,c.c_ssize_t],c.c_int32),'GetDlgCtrlID':([c.c_void_p],c.c_int32)}
        for name,(arguments,result) in declarations.items():
            function=getattr(user,name);function.argtypes=arguments;function.restype=result;self._fn[name]=function
    def enum_child_windows(self,dialog,collect):
        failed=False;first=None
        def visit(hwnd,lparam):
            nonlocal failed,first
            if failed:return 0
            try:
                if collect(int(hwnd or 0)) is not True:raise ObservationRefused('CHILD_CALLBACK_ABORTED')
                return 1
            except BaseException as error:failed=True;first=error;return 0
        callback=self._enum_type(visit)  # Strong callback reference through the call.
        try:self._fn['EnumChildWindows'](dialog,callback,0)  # Return documented unused.
        except BaseException:
            if failed:raise first
            raise
        if failed:raise first
    def control_id(self,child):
        self._c.set_last_error(0);identity=int(self._fn['GetDlgCtrlID'](child))
        return identity,int(self._c.get_last_error()) if identity==0 else 0
