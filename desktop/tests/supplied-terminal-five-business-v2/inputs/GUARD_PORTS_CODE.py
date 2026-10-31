def install_guards(native, world):
    """Inert ABI ports, derived from accepted mapping fixture; dynamic focus."""

    class FT(c.Structure):
        _fields_ = [('low', c.c_uint32), ('high', c.c_uint32)]

    class Rect(c.Structure):
        _fields_ = [('left', c.c_int32), ('top', c.c_int32), ('right', c.c_int32), ('bottom', c.c_int32)]

    class GUI(c.Structure):
        _fields_ = [('cbSize', c.c_uint32), ('flags', c.c_uint32), ('hwndActive', c.c_void_p), ('hwndFocus', c.c_void_p), ('hwndCapture', c.c_void_p), ('hwndMenuOwner', c.c_void_p), ('hwndMoveSize', c.c_void_p), ('hwndCaret', c.c_void_p), ('rcCaret', Rect)]
    o = native.original
    o._FILETIME = FT
    o._DWORD = c.c_uint32
    o._GUI = GUI
    o._enum_type = c.WINFUNCTYPE(c.c_int32, c.c_void_p, c.c_ssize_t)

    def times(handle, created, *unused):
        created._obj.low = 1234
        created._obj.high = 1
        return 1

    def image(handle, flags, buffer, length):
        value = 'C:\\QA\\electron.exe'
        buffer.value = value
        length._obj.value = len(value)
        return 1

    def exit_code(handle, result):
        result._obj.value = 259
        return 1

    def tidpid(hwnd, result):
        tid, pid = world.thread_process(hwnd)
        result._obj.value = pid
        return tid

    def classname(hwnd, buffer, capacity):
        value = world.class_name(hwnd, capacity)[0]
        buffer.value = value
        return len(value)

    def enum(callback, param):
        for hwnd in (100, 200):
            if callback(hwnd, param) != 1:
                return 0
        return 1

    def gui(tid, result):
        value = result._obj
        value.hwndActive = 200
        value.hwndFocus = world.focus if native.events else 202
        return 1
    o._fn.update(GetProcessId=lambda h: world.process_id(h), GetProcessTimes=times, QueryFullProcessImageNameW=image, GetExitCodeProcess=exit_code, WaitForSingleObject=lambda h, t: 258, IsWindow=world.is_window, GetWindowThreadProcessId=tidpid, GetClassNameW=classname, GetWindow=lambda h, mode: world.owner(h), IsWindowVisible=world.visible, IsWindowEnabled=world.enabled, EnumWindows=enum, GetForegroundWindow=world.foreground, GetGUIThreadInfo=gui, IsChild=lambda p, h: p == 200 and h in (201, 202))
