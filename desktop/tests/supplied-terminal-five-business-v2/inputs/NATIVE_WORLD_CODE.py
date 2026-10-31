class Falsey(Exception):

    def __bool__(self):
        raise AssertionError('NO_ERROR_TRUTHINESS')

    def __str__(self):
        raise AssertionError('NO_ERROR_FORMATTING')

class Fn:

    def __init__(self, w, name):
        self.w = w
        self.name = name
        self.argtypes = None
        self.restype = None

    def __call__(self, *args):
        w = self.w
        n = self.name
        w.calls.append((n, args))
        if n == 'GetAsyncKeyState':
            answer = w.key
        elif n == 'SendInput':
            assert args[0] == 4 and args[2] == 40
            events = c.cast(args[1], c.POINTER(w.original._INPUT))
            w.events.append([(events[i].type, events[i].u.ki.wVk, events[i].u.ki.wScan, events[i].u.ki.dwFlags, events[i].u.ki.time, events[i].u.ki.dwExtraInfo) for i in range(4)])
            answer = w.count
        elif n == 'IsWindowUnicode':
            answer = w.unicode
        elif n == 'GetWindowLongPtrW':
            assert args[1] == -16
            answer = w.style
        else:
            assert n == 'SendMessageTimeoutW'
            assert args[4] == 35
            result = c.cast(args[6], c.POINTER(c.c_size_t))
            w.initial_results.append(result[0])
            message = args[1]
            if message == 13:
                assert args[2] == 512
                buffer = c.cast(c.c_void_p(args[3]), c.POINTER(c.c_uint16))
                w.initial_buffers.append(tuple((buffer[i] for i in range(512))))
                for i, unit in enumerate(w.units):
                    buffer[i] = unit
                if type(w.text_count) is int and 0 <= w.text_count < 512:
                    buffer[w.text_count] = 0 if w.terminated else 65
                result[0] = w.text_count
                w.buffer_address = args[3]
            else:
                assert message == 176 and args[2:4] == (0, 0)
                result[0] = w.selection
            answer = w.transport
        if w.callback is not None:
            w.callback(n)
        if w.throw_name == n:
            raise w.native_error
        w.saved = w.error
        return answer

class World:

    def __init__(self):
        self.calls = []
        self.events = []
        self.initial_results = []
        self.initial_buffers = []
        self.key = 0
        self.count = 4
        self.unicode = 1
        self.style = 1342242944
        self.transport = 1
        self.units = tuple(map(ord, 'C:\\QA'))
        self.text_count = len(self.units)
        self.terminated = True
        self.selection = self.text_count << 16
        self.error = 0
        self.saved = 0
        self.callback = None
        self.throw_name = None
        self.native_error = Falsey()
        self.get_error = None
        self.clear_error = None
        self.error_reads = 0
        self.buffer_address = None
        self.dll = types.SimpleNamespace(**{n: Fn(self, n) for n in ('SendInput', 'GetAsyncKeyState', 'IsWindowUnicode', 'GetWindowLongPtrW', 'SendMessageTimeoutW')})
        self.original = object.__new__(ESCAPE.NativeEscapeFacade)
        self.original._c = c
        self.original._dlls = (object(), self.dll)
        self.original._INPUT = ESCAPE._input_types(c)
        self.original.pointer_bits = 64
        self.original.guithreadinfo_size = 72
        self.original._fn = {'SendInput': self.dll.SendInput, 'GetAsyncKeyState': self.dll.GetAsyncKeyState}
        self.original._key_state = self.dll.GetAsyncKeyState
        self.old_set = c.set_last_error
        self.old_get = c.get_last_error
        c.set_last_error = self.clear
        c.get_last_error = self.get

    def clear(self, value):
        if self.clear_error is not None:
            raise self.clear_error
        self.saved = value

    def get(self):
        self.error_reads += 1
        if self.get_error is not None:
            raise self.get_error
        return self.saved

    def restore(self):
        c.set_last_error = self.old_set
        c.get_last_error = self.old_get
