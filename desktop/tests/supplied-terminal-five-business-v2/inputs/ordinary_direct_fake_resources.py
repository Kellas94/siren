"""Exact retained supplied fake closure; no tests or native ports."""
import ordinary_direct_startup_storage as T
class Cell:
    def __init__(self,value=0):self.value=value

class Buffer:
    def __init__(self,value):
        self.data=bytearray(value if type(value) is int else len(value)+1)
        if type(value) is bytes:self.data[:len(value)]=value
    @property
    def raw(self):return bytes(self.data)

class Plain:
    pass

class Limit:
    def __init__(self):self.BasicLimitInformation=Plain();self.BasicLimitInformation.LimitFlags=0

class Account:
    def __init__(self):self.ActiveProcesses=0

class Lock:
    def __init__(self):self.depth=0
    def __enter__(self):self.depth+=1;return self
    def __exit__(self,*unused):self.depth-=1

class Memory:
    def __init__(self):self.error=0;self.error_failure=None
    def get_last_error(self):
        if self.error_failure:raise self.error_failure
        return self.error
    @staticmethod
    def byref(value):return value
    @staticmethod
    def cast(value,kind):return value
    @staticmethod
    def POINTER(kind):return lambda value:value
    @staticmethod
    def create_string_buffer(value):return Buffer(value)
    @staticmethod
    def sizeof(value):return 144 if type(value) is Limit else 48 if type(value) is Account else len(value)*8 if type(value) is tuple else len(value.data) if type(value) is Buffer else 8

class Exports:
    def __init__(self,memory,lock):
        self.c,self.lock=memory,lock;self.next=100;self.events=[];self.override={}
        self.files={};self.reads={};self.read_channels={}
        names=('CreateJobObjectW','SetInformationJobObject','CreateFileW','CreatePipe','SetHandleInformation',
               'InitializeProcThreadAttributeList','UpdateProcThreadAttribute','DeleteProcThreadAttributeList',
               'CreateProcessW','IsProcessInJob','ResumeThread','WaitForSingleObject','GetExitCodeProcess',
               'QueryInformationJobObject','TerminateJobObject','CancelSynchronousIo','ReadFile','WriteFile','CloseHandle')
        self.kernel={name:self.wrap(name) for name in names}
        self.crt={'_beginthreadex':self.wrap('_beginthreadex')}
    def handle(self):self.next+=1;return self.next
    def wrap(self,name):
        def call(*args):
            if self.lock.depth:raise RuntimeError('NATIVE_EFFECT_INSIDE_TRANSITION_LOCK')
            self.events.append(name)
            if self.override.get(name):
                value=self.override[name].pop(0)
                if isinstance(value,BaseException):raise value
                return value(*args) if callable(value) else value
            if name=='CreateJobObjectW':return self.handle()
            if name=='CreateFileW':
                h=self.handle();self.files[h]=bytearray();return h
            if name=='CreatePipe':
                args[0].value=self.handle();args[1].value=self.handle();return 1
            if name=='InitializeProcThreadAttributeList':
                args[3].value=128
                if args[0] is None:self.c.error=122;return 0
                return 1
            if name=='CreateProcessW':
                pi=args[-1];pi.hProcess=self.handle();pi.hThread=self.handle();pi.dwProcessId=1001;pi.dwThreadId=2001;return 1
            if name=='IsProcessInJob':args[2].value=1;return 1
            if name=='_beginthreadex':args[-1].value=3001;return self.handle()
            if name=='ResumeThread':return 1
            if name=='WaitForSingleObject':return 0
            if name=='GetExitCodeProcess':args[1].value=0;return 1
            if name=='QueryInformationJobObject':args[2].ActiveProcesses=0;args[-1].value=48;return 1
            if name=='ReadFile':
                h,buffer,maximum,count,unused=args
                payload=self.reads.get(h.value,[b'']).pop(0)
                buffer.data[:len(payload)]=payload;count.value=len(payload);return 1
            if name=='WriteFile':
                h,buffer,n,count,unused=args;self.files[h.value].extend(buffer.raw[:n]);count.value=n;return 1
            if name=='DeleteProcThreadAttributeList':return None
            return 1
        return call

def storage_for(q):
    # Constructor bypass is explicit: exercise the reviewed real state methods
    # with inert buffers, not a second ctypes representation measurement.
    s=object.__new__(T._StartupStorage);s._c=q.backend.c;s._layouts=q.backend.t
    s.command_buffer=Buffer(b'fixed');s.environment_buffer=Buffer(b'env')
    s.inherited_handles=tuple(q.backend._h(n).value for n in ('stdin.child','stdout.write','stderr.write'))
    s.job_handles=(q.backend._h('job').value,)
    s.startup=Plain();s.startup.lpAttributeList=None;s.process_information=Plain()
    for name in ('hProcess','hThread','dwProcessId','dwThreadId'):setattr(s.process_information,name,0)
    s.attribute_buffer=None;s.attribute_state='NOT_ALLOCATED'
    s.attribute_updates=dict(HANDLE_LIST='NOT_ATTEMPTED',JOB_LIST='NOT_ATTEMPTED')
    s.creation_state='NOT_ATTEMPTED';s.storage_released=False
    return s
