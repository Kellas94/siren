"""Source-only coordinator prototype, with explicit fixed inert-test seams.

Transitions use a supplied per-edge lock; native effects occur outside it.
The effects backend must be separately qualified before any physical use.
This source is not installed and does not implement source-custody admission,
external T0/C0 supervision, final physical readback or maintained caller routes.
"""
def _need(ok,code):
    if ok is not True:raise ValueError('DIRECT_EDGE_COORDINATOR:'+code)

def _outcome(call,good='CLOSED'):
    return 'UNRESOLVED' if call.state!='RETURNED' else good if call.raw else 'FAILED'

class _Reader:
    def __init__(self,c,t):
        self.buffer=c.create_string_buffer(65536);self.count=t['DWORD']()
        self.armed=False;self.stop_intent=False;self.read_ticket=None
        self.callback_returned=False;self.native_signaled=False;self.exception=None

class _Coordinator:
    def __init__(self,owner,capture,backend,lock):
        _need(owner._capture is capture,'EXACT_CAPTURE_OWNER')
        self.owner,self.capture,self.backend,self.lock=owner,capture,backend,lock
        self.readers={ch:_Reader(backend.c,backend.t) for ch in ('stdout','stderr')}
        self.callbacks={};self.reader_creation_started=False;self._backend_failure_reported=False
        self._timing_waits=None

    def _absorb_backend_failure(self):
        if self.backend.first_exception is not None and not self._backend_failure_reported:
            self._backend_failure_reported=True
            self.owner.bookkeeping_failed(self.backend.first_exception)

    def _acquired(self,ticket,slot,override=None):
        self._absorb_backend_failure()
        if slot.state=='OPEN':self.owner.acquisition_slot(ticket).store(slot)
        outcome=override or ('ACQUIRED' if slot.state=='OPEN' else 'UNRESOLVED' if slot.state=='UNKNOWN' else 'FAILED')
        self.owner.finish_acquire(ticket,outcome)
        return outcome=='ACQUIRED'

    def acquire_job(self):
        with self.lock:ticket=self.owner.begin_acquire('job')
        slot,configuration=self.backend.acquire_job()
        with self.lock:
            acquired=self._acquired(ticket,slot)
            if not acquired or configuration is None or configuration.state!='RETURNED' or not configuration.raw:
                error=RuntimeError('PRIVATE_JOB_CONFIGURATION_FAILED')
                self.owner.bookkeeping_failed(error);raise error

    def acquire_nul(self,security):
        with self.lock:ticket=self.owner.begin_acquire('stdin.child')
        slot=self.backend.acquire_nul(security)
        with self.lock:_need(self._acquired(ticket,slot),'NUL_ACQUIRE')

    def acquire_sink(self,channel,fixed_path):
        _need(channel in self.readers,'CHANNEL')
        with self.lock:ticket=self.owner.begin_acquire(channel+'.sink')
        slot=self.backend.acquire_sink(channel,fixed_path)
        with self.lock:_need(self._acquired(ticket,slot),'SINK_ACQUIRE')

    def acquire_pipe(self,channel,security):
        _need(channel in self.readers,'CHANNEL')
        with self.lock:
            read_ticket=self.owner.begin_acquire(channel+'.read')
            write_ticket=self.owner.begin_acquire(channel+'.write')
        read,write,call,inheritance=self.backend.acquire_pipe(channel,security)
        with self.lock:
            override='UNRESOLVED' if call.state!='RETURNED' else None if call.raw else 'FAILED'
            a=self._acquired(read_ticket,read,override)
            b=self._acquired(write_ticket,write,override)
            valid=bool(a and b and inheritance is not None and inheritance.state=='RETURNED' and inheritance.raw)
            if not valid:
                error=RuntimeError('PIPE_PAIR_OR_INHERITANCE_FAILED')
                self.owner.bookkeeping_failed(error);raise error

    def attach_startup(self,storage):
        # The fixed plan/storage is constructed only after the original pipe,
        # NUL and Job handles have been retained. Its runtime is separately ABI
        # qualified. Caller cannot substitute serialized HANDLE numbers as proof.
        with self.lock:
            hold=self.owner.begin_acquire('startup.storage')
            self.owner.acquisition_slot(hold).store(storage)
            self.owner.finish_acquire(hold,'ACQUIRED')
            attributes=self.owner.begin_acquire('startup.attributeList')
        self.backend.initialize_startup(storage)
        with self.lock:
            self._absorb_backend_failure()
            if storage.attribute_buffer is not None:self.owner.acquisition_slot(attributes).store(storage)
            good=(storage.attribute_state=='INITIALIZED' and all(v=='UPDATED' for v in storage.attribute_updates.values()))
            unknown=storage.attribute_state in ('INIT_PENDING','UNRESOLVED') or any(v in ('PENDING','UNRESOLVED') for v in storage.attribute_updates.values())
            self.owner.finish_acquire(attributes,'ACQUIRED' if good else 'UNRESOLVED' if unknown else 'FAILED')
            _need(good,'STARTUP_ATTRIBUTES')

    def create_once(self,plan):
        with self.lock:
            ticket=self.owner.begin_create();process,thread=self.owner.creation_slots(ticket)
        call=self.backend.create_child_once(plan)
        with self.lock:
            self._absorb_backend_failure()
            for target,name in ((process,'child.process'),(thread,'child.primaryThread')):
                slot=self.backend.handles[name]
                if slot.state=='OPEN':target.store(slot)
            if call.state!='RETURNED':self.owner.finish_create(ticket,'UNRESOLVED')
            elif not call.raw:self.owner.finish_create(ticket,'FAILED')
            else:
                pi=self.backend.storage.process_information
                pid,tid=pi.dwProcessId,pi.dwThreadId
                self.owner.finish_create(ticket,'CREATED',pid=pid if type(pid) is int and pid>0 else None,
                                         tid=tid if type(tid) is int and tid>0 else None)
        return ticket,call

    def observe_membership(self):
        with self.lock:ticket=self.owner.begin_membership()
        call,member=self.backend.membership()
        with self.lock:
            self._absorb_backend_failure()
            outcome='UNRESOLVED' if call.state!='RETURNED' else 'FAILED' if not call.raw else 'MEMBER' if member.value else 'NOT_MEMBER'
            self.owner.finish_membership(ticket,outcome)
        return outcome

    def _reader_main(self,channel):
        state=self.readers[channel];c=self.capture;b=self.backend
        try:
            with self.lock:
                if state.stop_intent:return 1
                state.read_ticket=c.begin_read(channel,65536)
                state.armed=True
                self.owner.observe_reader_ready(channel)
            while True:
                ticket=state.read_ticket
                call=b.read(channel,state.buffer,state.count,65536)
                data=b''
                if call.state!='RETURNED':outcome='UNKNOWN'
                elif call.raw:
                    _need(type(state.count.value) is int and 0<=state.count.value<=65536,'READ_COUNT')
                    data=bytes(state.buffer.raw[:state.count.value]);outcome='DATA' if data else 'EOF'
                elif call.error==109:outcome='EOF'
                elif call.error==995:outcome='CANCELLED'
                else:outcome='ERROR'
                with self.lock:
                    self._absorb_backend_failure()
                    append=c.finish_read(ticket,outcome,data)
                    state.read_ticket=None
                    payload=None if append is None else append.bytes_for_port
                if append is not None:
                    written,count=b.write(channel,payload)
                    n=count.value if written.state=='RETURNED' else None
                    status='UNRESOLVED' if n is None else 'COMMITTED' if written.raw and n==len(payload) else 'FAILED'
                    with self.lock:
                        self._absorb_backend_failure()
                        c.finish_append(append,status,n)
                if outcome!='DATA':break
                with self.lock:
                    if state.stop_intent or c.view()['state']!='ACTIVE':break
                    state.read_ticket=c.begin_read(channel,65536)
            return 0 if outcome=='EOF' else 1
        except BaseException as error:
            with self.lock:
                state.exception=error
                self.owner.bookkeeping_failed(error)
                c._failure('CALLBACK_FAILED',error)
            return 1
        finally:
            with self.lock:state.callback_returned=True

    def start_readers(self):
        with self.lock:
            _need(not self.reader_creation_started,'ONE_READER_PAIR')
            self.reader_creation_started=True
            # Both callback instances/rooted states precede first CRT creation.
            for ch in self.readers:
                def main(argument,channel=ch):return self._reader_main(channel)
                self.callbacks[ch]=self.backend.t['READER_CALLBACK'](main)
        for ch in self.readers:
            with self.lock:ticket=self.owner.begin_acquire(ch+'.readerThread')
            slot,call,tid=self.backend.create_reader_suspended(ch,self.callbacks[ch],self.readers[ch])
            with self.lock:_need(self._acquired(ticket,slot),'READER_ACQUIRE')
            resumed=self.backend.resume(ch+'.readerThread')
            with self.lock:
                self._absorb_backend_failure()
                if resumed.state!='RETURNED' or resumed.raw!=1:
                    error=RuntimeError('READER_RESUME_FAILED');self.owner.bookkeeping_failed(error);raise error

    def resume_child(self):
        with self.lock:
            _need(all(v.armed for v in self.readers.values()),'BOTH_ACTUAL_READERS_ARMED')
            ticket=self.owner.begin_resume()
        call=self.backend.resume('child.primaryThread')
        with self.lock:
            self._absorb_backend_failure()
            outcome='UNRESOLVED' if call.state!='RETURNED' else 'FAILED' if call.raw==0xffffffff else 'RETURNED'
            self.owner.finish_resume(ticket,outcome,call.raw if outcome=='RETURNED' else None)
        return call

    def wait_process(self,now_ms,*,cutoff_ms=None):
        with self.lock:
            ticket=self.owner.begin_wait(now_ms,cutoff_ms=cutoff_ms)
            receipt=None
            if self._timing_waits is not None:
                _need(len(self._timing_waits)<4096,'BOUNDED_TIMED_WAIT_RECEIPTS')
                receipt=dict(nowMs=now_ms,cutoffMs=self.owner._deadline_ms if cutoff_ms is None else cutoff_ms,
                    timeoutMs=ticket.timeout_ms,capExplicit=cutoff_ms is not None,callIndex=None,
                    outcome='NOT_DISPATCHED',acknowledged=False,_ticket=ticket)
                self._timing_waits.append(receipt)
        call=self.backend.wait('child.process',ticket.timeout_ms)
        if receipt is not None:receipt['callIndex']=self.backend.calls.index(call)
        with self.lock:
            self._absorb_backend_failure()
            outcome='UNRESOLVED' if call.state!='RETURNED' else 'SIGNALED' if call.raw==0 else 'TIMEOUT' if call.raw==258 else 'FAILED'
            if receipt is not None:receipt['outcome']=outcome
            self.owner.finish_wait(ticket,outcome)
            if receipt is not None:receipt['acknowledged']=True
        return outcome

    def query_exit(self):
        with self.lock:ticket=self.owner.begin_exit_query()
        call,code=self.backend.exit_code()
        with self.lock:
            self._absorb_backend_failure()
            self.owner.finish_exit_query(ticket,'UNRESOLVED' if call.state!='RETURNED' else 'OBSERVED' if call.raw else 'FAILED',code.value if call.state=='RETURNED' and call.raw else None)
        return call,code

    def cancel_reader(self,channel):
        _need(channel in self.readers,'CHANNEL')
        with self.lock:
            self.readers[channel].stop_intent=True
            ticket=self.capture.request_cancel(channel)
        call=self.backend.cancel_reader(channel)
        with self.lock:
            self._absorb_backend_failure()
            outcome='UNRESOLVED' if call.state!='RETURNED' else 'ACCEPTED' if call.raw else 'REJECTED' if call.error==1168 else 'FAILED'
            self.capture.finish_cancel(ticket,outcome)
        return call

    def observe_reader_end(self,channel,remaining_ms):
        _need(channel in self.readers,'CHANNEL')
        call=self.backend.wait(channel+'.readerThread',remaining_ms)
        with self.lock:self._absorb_backend_failure()
        if call.state=='RETURNED' and call.raw==0:
            with self.lock:
                state=self.readers[channel];state.native_signaled=True
                row=self.capture.view()['channels'][channel]
                self.capture.observe_reader_termination(channel,None if row['termination']!='NONE' else 'ERROR')
        return call

    def close_sink(self,channel):
        _need(channel in self.readers,'CHANNEL')
        with self.lock:
            _need(self.readers[channel].native_signaled,'ORIGINAL_READER_SIGNALED')
            capture_ticket=self.capture.request_sink_close(channel)
            ticket=self.owner.begin_capture_sink_close(capture_ticket)
        call=self.backend.close_handle(channel+'.sink')
        with self.lock:
            self._absorb_backend_failure()
            self.owner.finish_capture_sink_close(ticket,_outcome(call))
        return call

    def close_resource(self,name):
        _need(name not in ('stdout.sink','stderr.sink'),'USE_COUPLED_SINK_CLOSE')
        with self.lock:ticket=self.owner.begin_close(name)
        if name=='startup.attributeList':
            storage=self.backend.storage
            if storage.attribute_state in ('NOT_ALLOCATED','ALLOCATED','FAILED'):
                outcome='CLOSED'  # No native list initialized: no fake Delete.
            else:
                call=self.backend.destroy_attributes()
                outcome='UNRESOLVED' if call.state!='RETURNED' else 'CLOSED'
        elif name=='startup.storage':
            self.backend.release_storage();outcome='CLOSED'
        else:
            call=self.backend.close_handle(name);outcome=_outcome(call)
        with self.lock:
            self._absorb_backend_failure()
            self.owner.finish_close(ticket,outcome)

    def retire_job(self):
        with self.lock:ticket=self.owner.begin_job_retirement()
        call=self.backend.retire_job()
        with self.lock:
            self._absorb_backend_failure()
            self.owner.finish_job_retirement(ticket,_outcome(call,'TERMINATED'))
        return call
