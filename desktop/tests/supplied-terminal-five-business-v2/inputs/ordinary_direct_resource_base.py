"""Unexecuted fixed-export effects layer for a future owned edge coordinator.

No imports, DLL loading or module-level native calls. Its inputs must come from
a separately qualified fixed runtime, declaration and path closure. Neither
this class nor a serialized receipt grants operational/native admission.
Known delivered results remain rooted before optional model acknowledgement;
an exception before delivery remains UNKNOWN and is never retried here.
"""
_HANDLE_ROLES=('job','stdin.child','stdout.read','stdout.write','stderr.read','stderr.write',
               'stdout.sink','stderr.sink','child.process','child.primaryThread',
               'stdout.readerThread','stderr.readerThread')
_INVALID_HANDLE=(1<<64)-1

def _need(ok,code):
    if ok is not True:raise ValueError('DIRECT_RESOURCE_BACKEND:'+code)

class _Call:
    def __init__(self,label):
        self.label=label;self.state='NOT_STARTED';self.raw=None
        self.error=None;self.exception=None;self.arguments=None
        self.diagnostic_exception=None

class _Handle:
    def __init__(self,c,t):
        self.cell=t['HANDLE']();self.state='NOT_ACQUIRED';self.original_call=None

class _Backend:
    def __init__(self,c,t,kernel,crt):
        self.c,self.t,self.k,self.crt=c,t,kernel,crt
        self.handles={name:_Handle(c,t) for name in _HANDLE_ROLES}
        self.calls=[];self.first_exception=None
        self.storage=None;self.created=False;self.reader_roots={}
        self._dispatch_guard=None
        self._job_limit=t['JOBOBJECT_EXTENDED_LIMIT_INFORMATION']()
        self._job_limit.BasicLimitInformation.LimitFlags=0x2000
        self._account=t['JOBOBJECT_BASIC_ACCOUNTING_INFORMATION']()
        self._account_size=t['DWORD']()

    def _call(self,label,function,*arguments,last_error=True):
        # Append/allocate BEFORE the effect. A later diagnostic allocation
        # failure cannot erase a returned value already stored in this record.
        _need(len(self.calls)<4096,'LOCAL_CALL_RECORD_LIMIT')
        # Refusal here is known pre-dispatch and is not an UNKNOWN FFI call.
        if self._dispatch_guard is not None:self._dispatch_guard(label,len(self.calls))
        call=_Call(label);self.calls.append(call)
        call.arguments=arguments;call.state='PENDING'
        try:
            call.raw=function(*arguments)
        except BaseException as error:
            # The ordinary post-delivery retention guarantee does not cover
            # FFI conversion/interpreter failure before Python receives raw.
            call.exception=error;call.state='UNKNOWN'
            if self.first_exception is None:self.first_exception=error
        else:
            call.state='RETURNED'
            if last_error:
                try:call.error=self.c.get_last_error()
                except BaseException as error:
                    # Failure of optional error bookkeeping cannot rewrite an
                    # already delivered HANDLE/BOOL as an unknown native call.
                    call.diagnostic_exception=error
                    if self.first_exception is None:self.first_exception=error
        if call.state=='RETURNED':call.arguments=None
        return call

    def _h(self,name):
        slot=self.handles[name]
        _need(slot.state=='OPEN' and slot.cell.value not in (None,0,_INVALID_HANDLE),'ORIGINAL_OPEN_HANDLE:'+name)
        return slot.cell

    def _retained(self,name,call,value,*,output_success=True):
        slot=self.handles[name]
        _need(slot.state=='ACQUIRING','ONE_HANDLE_ACQUISITION:'+name)
        slot.original_call=call
        if call.state=='UNKNOWN':slot.state='UNKNOWN';return slot
        # Pipe/PI output cells are already rooted before their API call.
        slot.cell.value=value
        slot.state='INDETERMINATE' if not output_success else 'FAILED' if value in (None,0,_INVALID_HANDLE) else 'OPEN'
        return slot

    def _returned_handle(self,name,symbol,*args):
        slot=self.handles[name];_need(slot.state=='NOT_ACQUIRED','SINGLE_ACQUIRE:'+name)
        slot.state='ACQUIRING'
        call=self._call('ACQUIRE:'+name,self.k[symbol],*args)
        return self._retained(name,call,call.raw)

    def acquire_job(self):
        slot=self._returned_handle('job','CreateJobObjectW',None,None)
        if slot.state!='OPEN':return slot,None
        call=self._call('CONFIGURE_JOB',self.k['SetInformationJobObject'],slot.cell,9,
                        self.c.byref(self._job_limit),self.c.sizeof(self._job_limit))
        return slot,call

    def acquire_nul(self,security):
        return self._returned_handle('stdin.child','CreateFileW','NUL',0x80000000,3,
                                     self.c.byref(security),3,0x80,None)

    def acquire_sink(self,channel,fixed_path):
        _need(channel in ('stdout','stderr'),'SINK_CHANNEL')
        # Caller must bind this exact canonical path through the fixed closure;
        # CREATE_NEW/share0/no-inherit avoids replacing an existing leaf.
        return self._returned_handle(channel+'.sink','CreateFileW',fixed_path,
                                     0xc0000000,0,None,1,0x80|0x00200000,None)

    def acquire_pipe(self,channel,security):
        _need(channel in ('stdout','stderr'),'PIPE_CHANNEL')
        read,write=(self.handles[channel+suffix] for suffix in ('.read','.write'))
        _need(read.state==write.state=='NOT_ACQUIRED','ONE_PIPE_ACQUISITION')
        read.state=write.state='ACQUIRING'
        call=self._call('CREATE_PIPE:'+channel,self.k['CreatePipe'],
                        self.c.byref(read.cell),self.c.byref(write.cell),self.c.byref(security),0)
        # Keep failed-call output cells as indeterminate data. Only known
        # successful creation can establish acquired pipe capabilities; FALSE
        # numbers must never authorize inheritance, IO or CloseHandle.
        self._retained(channel+'.read',call,read.cell.value,output_success=bool(call.raw))
        self._retained(channel+'.write',call,write.cell.value,output_success=bool(call.raw))
        inheritance=None
        if call.state=='RETURNED' and call.raw and read.state==write.state=='OPEN':
            inheritance=self._call('NONINHERIT_READ:'+channel,self.k['SetHandleInformation'],read.cell,1,0)
        return read,write,call,inheritance

    def initialize_startup(self,storage):
        _need(self.storage is None,'ONE_STARTUP_STORAGE');self.storage=storage
        size=self.t['SIZE_T']()
        probe=self._call('ATTRIBUTE_SIZE',self.k['InitializeProcThreadAttributeList'],None,2,0,self.c.byref(size))
        if not(probe.state=='RETURNED' and not probe.raw and probe.error==122 and 1<=size.value<=65536):return probe,None
        storage.allocate_attribute_storage(size.value);storage.begin_attribute_initialization()
        init=self._call('ATTRIBUTE_INIT',self.k['InitializeProcThreadAttributeList'],
                        storage.startup.lpAttributeList,2,0,self.c.byref(size))
        storage.observe_attribute_initialization('UNRESOLVED' if init.state=='UNKNOWN' else 'INITIALIZED' if init.raw else 'FAILED')
        if init.state!='RETURNED' or not init.raw:return probe,init
        for role,attribute,values in (('HANDLE_LIST',0x20002,storage.inherited_handles),
                                      ('JOB_LIST',0x2000d,storage.job_handles)):
            storage.begin_attribute_update(role)
            update=self._call('ATTRIBUTE_UPDATE:'+role,self.k['UpdateProcThreadAttribute'],
                              storage.startup.lpAttributeList,0,attribute,
                              self.c.cast(values,self.t['LPVOID']),self.c.sizeof(values),None,None)
            storage.observe_attribute_update(role,'UNRESOLVED' if update.state=='UNKNOWN' else 'UPDATED' if update.raw else 'FAILED')
            if update.state!='RETURNED' or not update.raw:break
        return probe,init

    def create_child_once(self,plan):
        _need(not self.created and self.storage is not None,'ONE_CHILD_CALL')
        self.storage.mark_creation_attempt();self.created=True
        for name in ('child.process','child.primaryThread'):
            _need(self.handles[name].state=='NOT_ACQUIRED','EMPTY_CHILD_SLOT')
            self.handles[name].state='ACQUIRING'
        s=self.storage
        call=self._call('CREATE_CHILD',self.k['CreateProcessW'],plan.application,s.command_buffer,
                        None,None,True,plan.creation_flags,s.environment_buffer,plan.cwd,
                        self.c.cast(self.c.byref(s.startup),self.c.POINTER(self.t['STARTUPINFOW'])),
                        self.c.byref(s.process_information))
        pi=s.process_information
        self._retained('child.process',call,pi.hProcess,output_success=bool(call.raw))
        self._retained('child.primaryThread',call,pi.hThread,output_success=bool(call.raw))
        s.observe_creation_return('UNRESOLVED' if call.state=='UNKNOWN' else 'RETURNED_TRUE' if call.raw else 'RETURNED_FALSE')
        return call

    def membership(self):
        value=self.t['BOOL']()
        call=self._call('MEMBERSHIP',self.k['IsProcessInJob'],self._h('child.process'),self._h('job'),self.c.byref(value))
        return call,value

    def create_reader_suspended(self,channel,callback,state):
        _need(channel in ('stdout','stderr') and channel not in self.reader_roots,'ONE_READER')
        name=channel+'.readerThread';slot=self.handles[name]
        _need(slot.state=='NOT_ACQUIRED','EMPTY_READER_SLOT')
        tid=self.t['CRT_UINT']()
        # callback/state/tid exist before the foreign thread can start. Normal
        # callback return performs CRT cleanup; no _endthreadex call here.
        self.reader_roots[channel]=(callback,state,tid)
        slot.state='ACQUIRING'
        call=self._call('CREATE_READER:'+channel,self.crt['_beginthreadex'],None,0,callback,None,4,self.c.byref(tid),last_error=False)
        self._retained(name,call,call.raw)
        return slot,call,tid

    def resume(self,name):
        _need(name=='child.primaryThread' or name in ('stdout.readerThread','stderr.readerThread'),'RESUME_ROLE')
        _need(not any(r.label=='RESUME:'+name for r in self.calls),'ONE_RESUME')
        return self._call('RESUME:'+name,self.k['ResumeThread'],self._h(name))

    def wait(self,name,remaining_ms):
        _need(type(remaining_ms) is int and 0<=remaining_ms<0xffffffff,'FINITE_WAIT')
        return self._call('WAIT:'+name,self.k['WaitForSingleObject'],self._h(name),remaining_ms)

    def exit_code(self):
        code=self.t['DWORD']()
        call=self._call('EXIT_CODE',self.k['GetExitCodeProcess'],self._h('child.process'),self.c.byref(code))
        return call,code

    def account_job(self):
        call=self._call('JOB_ACCOUNTING',self.k['QueryInformationJobObject'],self._h('job'),1,
                        self.c.byref(self._account),self.c.sizeof(self._account),self.c.byref(self._account_size))
        return call,self._account

    def retire_job(self):
        _need(not any(r.label=='RETIRE_JOB' for r in self.calls),'ONE_RETIREMENT')
        return self._call('RETIRE_JOB',self.k['TerminateJobObject'],self._h('job'),1)

    def cancel_reader(self,channel):
        _need(channel in ('stdout','stderr') and not any(r.label=='CANCEL:'+channel for r in self.calls),'ONE_CANCEL')
        return self._call('CANCEL:'+channel,self.k['CancelSynchronousIo'],self._h(channel+'.readerThread'))

    def read(self,channel,buffer,count,maximum):
        _need(channel in ('stdout','stderr') and type(maximum) is int and 1<=maximum<=65536,'READ_LIMIT')
        count.value=0
        return self._call('READ:'+channel,self.k['ReadFile'],self._h(channel+'.read'),buffer,maximum,self.c.byref(count),None)

    def write(self,channel,payload):
        _need(channel in ('stdout','stderr') and type(payload) is bytes and len(payload)<=65536,'APPEND_LIMIT')
        buffer=self.c.create_string_buffer(payload);count=self.t['DWORD']()
        call=self._call('APPEND:'+channel,self.k['WriteFile'],self._h(channel+'.sink'),buffer,len(payload),self.c.byref(count),None)
        return call,count

    def close_handle(self,name):
        slot=self.handles[name];handle=self._h(name)
        _need(not any(r.label=='CLOSE:'+name for r in self.calls),'ONE_CLOSE')
        call=self._call('CLOSE:'+name,self.k['CloseHandle'],handle)
        slot.state='UNKNOWN' if call.state=='UNKNOWN' else 'CLOSED' if call.raw else 'CLOSE_FAILED'
        # Native callback roots remain even after callback return; only a
        # separately observed original-handle signaled wait permits release.
        return call

    def destroy_attributes(self):
        s=self.storage;_need(s is not None,'STARTUP_EXISTS')
        s.begin_attribute_destruction()
        call=self._call('DELETE_ATTRIBUTES',self.k['DeleteProcThreadAttributeList'],s.startup.lpAttributeList,last_error=False)
        s.observe_attribute_destruction('DESTROY_UNRESOLVED' if call.state=='UNKNOWN' else 'DESTROYED')
        return call

    def release_storage(self):
        # This is a Python reference-lifetime operation, not CloseHandle.
        self.storage.release_backing_storage()
