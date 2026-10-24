class RawClock:

    def __init__(self):
        self.now = 100.0
        self.calls = 0

    def __call__(self):
        self.calls += 1
        return self.now

class World:
    pointer_bits = 64
    guithreadinfo_size = 72

    def __init__(self, raw):
        self.raw = raw
        self.calls = []
        self.queries = []
        self.gets = 0
        self.query_error = None
        self.answer = {'transportReturn': 1, 'messageResult': 1397424129, 'lastError': 0}
        self.after_query = None
        self.during_query = None
        self.getter_error = None
        self.identity_pid = 10
        self.focus = 201
        self.advance_on_foreground = 0
        self.windows = {100: (10, 11, 'Chrome_WidgetWin_1', 0, True, False), 200: (10, 12, '#32770', 100, True, True), 201: (10, 12, 'Edit', 0, True, True)}

    def call(self, name):
        self.calls.append(name)

    def process_id(self, h):
        self.call('pid')
        return self.identity_pid

    def process_times(self, h):
        self.call('times')
        return (1234, 1)

    def process_image(self, h, cap):
        self.call('image')
        s = 'C:\\QA\\electron.exe'
        return (s, len(s), True)

    def process_exit_code(self, h):
        self.call('exit')
        return 259

    def wait_process(self, h):
        self.call('wait')
        return 258

    def is_window(self, h):
        self.call('iswindow')
        return h in self.windows

    def thread_process(self, h):
        self.call('tidpid')
        p, t, *_ = self.windows[h]
        return (t, p)

    def class_name(self, h, cap):
        self.call('class')
        s = self.windows[h][2]
        return (s, len(s), True)

    def owner(self, h):
        self.call('owner')
        return self.windows[h][3]

    def visible(self, h):
        self.call('visible')
        return self.windows[h][4]

    def enabled(self, h):
        self.call('enabled')
        return self.windows[h][5]

    def enum_windows(self, collect):
        self.call('enum')
        for h in (100, 200):
            if collect(h) is not True:
                return False
        return True

    def foreground(self):
        self.call('foreground')
        self.raw.now += self.advance_on_foreground
        return 200

    def gui_thread_info(self, tid):
        self.call('gui')
        return (72, 200, self.focus)

    def is_child(self, parent, child):
        self.call('child')
        return (parent, child) == (200, 201)

    @property
    def query_default(self):
        self.gets += 1
        if self.getter_error is not None:
            raise self.getter_error
        return self.query

    def query(self, hwnd, timeout):
        self.queries.append((hwnd, timeout))
        if self.during_query is not None:
            self.during_query()
        if self.query_error is not None:
            raise self.query_error
        if self.after_query is not None:
            self.after_query()
        return self.answer
