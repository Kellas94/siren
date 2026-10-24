"""Supplied original-slot/process/capture composition; no OS or external IO.

One serialized caller owns transitions. Tickets cross an inert effect boundary;
no mutex, native capability acquisition or source-custody claim is implemented.
"""
_RESOURCES = ('job','stdin.child','stdout.read','stdout.write','stderr.read','stderr.write',
              'stdout.sink','stderr.sink','startup.attributeList','startup.storage',
              'child.process','child.primaryThread','stdout.readerThread','stderr.readerThread')
_PRECREATE = _RESOURCES[:10]
_CHANNELS = ('stdout','stderr')

def _need(ok, code):
    if ok is not True:raise ValueError('DIRECT_OWNER_V1:'+code)

def _copy(value):
    if type(value) is dict:return {k:_copy(v) for k,v in value.items()}
    if type(value) is list:return [_copy(v) for v in value]
    return value

def _uint(value, maximum=0xffffffff):
    return type(value) is int and 0 <= value <= maximum

def _binding(value):
    _need(type(value) is dict and set(value)=={'attemptId','edge','headerSha256','creationInvocationId'},'BINDING_KEYS')
    for name,n in (('attemptId',32),('headerSha256',64),('creationInvocationId',32)):
        s=value[name];_need(type(s) is str and len(s)==n and all(ch in '0123456789abcdef' for ch in s),'BINDING_HEX')
    _need(type(value['edge']) is str and value['edge'] in ('owner','outer','inner','electron','ui'),'EDGE')
    return _copy(value)

class _Slot:
    def __init__(self):
        self.value=None
        self.state='NOT_ACQUIRED'
    def store(self, value):
        _need(self.value is None and self.state=='ACQUIRING' and value is not None,'SLOT_WRITE_ONCE')
        self.value=value

class _Ticket:
    def __init__(self, owner, kind, names, timeout_ms=None):
        self.owner,self.kind,self.names=owner,kind,names
        self.timeout_ms=timeout_ms
        self.uncertain=False
        self.originals=tuple((name,owner._slots[name].value) for name in names)

class _Lease:
    def __init__(self, owner):
        self._owner=owner;self._original=owner._slots['child.process'].value;self._active=True
    @property
    def value(self):
        _need(self._active and self in self._owner._leases and
              self._owner._slots['child.process'].value is self._original and
              self._owner._slots['child.process'].state=='OPEN','ACTIVE_ORIGINAL_LEASE')
        return self._original

def _ack(method):
    def guarded(self,*args,**kwargs):
        try:return method(self,*args,**kwargs)
        except BaseException as error:
            self._failure('ACK_REFUSED',error)
            raise
    return guarded

class _Owner:
    def __init__(self, binding, capture, *, deadline_ms):
        self._binding=_binding(binding)
        _need(_uint(deadline_ms,0xffffffff-1) and deadline_ms>0,'ABSOLUTE_DEADLINE')
        _need(capture.view()['binding']==self._binding,'CAPTURE_BINDING')
        self._capture=capture;self._deadline_ms=deadline_ms;self._last_wait_now=0
        # Every slot, including both native creation results, precedes any port.
        self._slots={name:_Slot() for name in _RESOURCES}
        self._pending=set();self._leases=set();self._failures=[];self._first_exception=None
        self._creation=dict(state='NOT_ATTEMPTED',pid=None,tid=None,callQuiescent=True)
        self._membership='NOT_OBSERVED'
        self._ready=dict(stdout=False,stderr=False)
        self._resume=dict(state='NOT_ATTEMPTED',priorCount=None)
        self._wait=dict(state='NOT_OBSERVED',timeoutMs=None)
        self._exit=dict(state='NOT_OBSERVED',code=None)
        self._retirement='NOT_ATTEMPTED'
        self._accounting=dict(state='NOT_OBSERVED',active=None,phase=None)

    def _failure(self, code, error=None):
        if len(self._failures)<64:self._failures.append(code)
        if self._first_exception is None and error is not None:self._first_exception=error

    def bookkeeping_failed(self,error):
        _need(isinstance(error,BaseException),'EXCEPTION')
        self._failure('BOOKKEEPING_FAILED',error)

    def _ticket(self,kind,names,timeout_ms=None):
        ticket=_Ticket(self,kind,names,timeout_ms)
        self._pending.add(ticket)
        return ticket

    def _take(self,ticket,kind):
        _need(type(ticket) is _Ticket and ticket.owner is self and ticket in self._pending and
              ticket.kind==kind and not ticket.uncertain,'ORIGINAL_PENDING_TICKET')
        return ticket

    def _done(self,ticket,outcome):
        if outcome=='UNRESOLVED':
            ticket.uncertain=True;self._failure(ticket.kind+':UNRESOLVED')
        else:self._pending.remove(ticket)

    def _open(self,name):
        _need(name in self._slots and self._slots[name].state=='OPEN' and
              self._slots[name].value is not None,'OPEN_RESOURCE')

    def _idle(self,name):
        _need(not any(name in t.names for t in self._pending),'RESOURCE_OPERATION_PENDING')

    def begin_acquire(self,name):
        _need(type(name) is str and name in _RESOURCES and
              name not in ('child.process','child.primaryThread'),'ACQUIRE_ROLE')
        slot=self._slots[name]
        _need(slot.state=='NOT_ACQUIRED' and slot.value is None,'SINGLE_ACQUISITION')
        slot.state='ACQUIRING'
        return self._ticket('ACQUIRE:'+name,(name,))

    def acquisition_slot(self,ticket):
        _need(type(ticket) is _Ticket and ticket.owner is self and ticket in self._pending and
              ticket.kind.startswith('ACQUIRE:') and not ticket.uncertain,'ACQUISITION_TICKET')
        return self._slots[ticket.names[0]]

    @_ack
    def finish_acquire(self,ticket,outcome,**invalid):
        _need(not invalid and type(ticket) is _Ticket,'ACQUISITION_ACK')
        self._take(ticket,'ACQUIRE:'+ticket.names[0])
        _need(type(outcome) is str and outcome in ('ACQUIRED','FAILED','UNRESOLVED'),'ACQUIRE_OUTCOME')
        slot=self._slots[ticket.names[0]]
        _need(outcome!='ACQUIRED' or slot.value is not None,'ACQUIRED_ORIGINAL_SLOT')
        slot.state='UNRESOLVED' if outcome=='UNRESOLVED' else 'OPEN' if slot.value is not None else 'FAILED'
        self._done(ticket,outcome)
        if outcome!='ACQUIRED':self._failure('ACQUISITION:'+outcome)

    def begin_create(self):
        _need(self._creation['state']=='NOT_ATTEMPTED','SINGLE_CREATION')
        for name in _PRECREATE:self._open(name);self._idle(name)
        for name in ('child.process','child.primaryThread'):
            _need(self._slots[name].state=='NOT_ACQUIRED','EMPTY_CREATION_SLOT')
        ticket=self._ticket('CREATE',_PRECREATE+('child.process','child.primaryThread'))
        self._creation['state']='ATTEMPTED'
        self._creation['callQuiescent']=False
        self._slots['child.process'].state=self._slots['child.primaryThread'].state='ACQUIRING'
        return ticket

    def creation_slots(self,ticket):
        self._take(ticket,'CREATE')
        return self._slots['child.process'],self._slots['child.primaryThread']

    @_ack
    def finish_create(self,ticket,outcome,pid=None,tid=None):
        self._take(ticket,'CREATE')
        _need(type(outcome) is str and outcome in ('CREATED','FAILED','UNRESOLVED'),'CREATION_OUTCOME')
        _need((pid is None or (_uint(pid) and pid>0)) and (tid is None or (_uint(tid) and tid>0)), 'CREATION_IDS')
        if outcome=='CREATED':
            _need(all(self._slots[n].value is not None for n in ('child.process','child.primaryThread')),'ORIGINAL_CREATION_SLOTS')
        else:_need(pid is None and tid is None,'NO_UNAVAILABLE_ID_LABELS')
        for name in ('child.process','child.primaryThread'):
            slot=self._slots[name]
            slot.state='UNRESOLVED' if outcome=='UNRESOLVED' else 'OPEN' if slot.value is not None else 'FAILED'
        self._creation=dict(state=outcome,pid=pid,tid=tid,callQuiescent=outcome!='UNRESOLVED')
        self._done(ticket,outcome)
        if outcome!='CREATED' or pid is None or tid is None:self._failure('CREATION_OR_IDENTITY_INCOMPLETE')

    @_ack
    def observe_creation_quiescent(self,ticket):
        # This is a distinct supplied observation of call completion. It does
        # not replace the unavailable creation result, bless its handles, or
        # permit a second creation. The original pending operation is required.
        _need(type(ticket) is _Ticket and ticket.owner is self and ticket in self._pending and
              ticket.kind=='CREATE' and ticket.uncertain and
              self._creation['state']=='UNRESOLVED' and not self._creation['callQuiescent'],
              'ORIGINAL_UNCERTAIN_CREATION_QUIESCENCE')
        self._creation['callQuiescent']=True
        self._pending.remove(ticket)

    def resource_for(self,ticket,name):
        _need(type(ticket) is _Ticket and ticket.owner is self and ticket in self._pending and
              not ticket.uncertain and name in ticket.names,'RESOURCE_TICKET')
        _need(self._slots[name].state in ('OPEN','CLOSE_PENDING') and self._slots[name].value is not None,'HELD_RESOURCE')
        original=dict(ticket.originals)[name]
        _need(original is self._slots[name].value,'ORIGINAL_RESOURCE_CHANGED')
        return original

    def begin_membership(self):
        _need(self._creation['state']=='CREATED' and self._membership=='NOT_OBSERVED','MEMBERSHIP_BEGIN')
        for name in ('child.process','job'):self._open(name);self._idle(name)
        self._membership='PENDING'
        return self._ticket('MEMBERSHIP',('child.process','job'))

    @_ack
    def finish_membership(self,ticket,outcome):
        self._take(ticket,'MEMBERSHIP')
        _need(type(outcome) is str and outcome in ('MEMBER','NOT_MEMBER','FAILED','UNRESOLVED'),'MEMBERSHIP_OUTCOME')
        self._membership=outcome;self._done(ticket,outcome)
        if outcome!='MEMBER':self._failure('MEMBERSHIP:'+outcome)

    def observe_reader_ready(self,channel):
        _need(type(channel) is str and channel in _CHANNELS and not self._ready[channel],'READER_READY')
        self._open(channel+'.readerThread');self._open(channel+'.read');self._open(channel+'.sink')
        self._ready[channel]=True

    def begin_resume(self):
        _need(self._creation['state']=='CREATED' and self._membership=='MEMBER' and
              all(self._ready.values()) and self._resume['state']=='NOT_ATTEMPTED','SINGLE_READY_RESUME')
        _need(self._creation['callQuiescent'] is True and self._creation['pid'] is not None and
              self._creation['tid'] is not None and not self._failures,'CREATION_IDENTITY_READY')
        for name in ('job','child.process','child.primaryThread','stdout.read','stderr.read',
                     'stdout.sink','stderr.sink','stdout.readerThread','stderr.readerThread'):
            self._open(name);self._idle(name)
        capture=self._capture.view()
        _need(capture['state']=='ACTIVE' and all(
              capture['channels'][ch]['reader']=='RUNNING' and
              capture['channels'][ch]['termination']=='NONE' and
              capture['channels'][ch]['sink']=='OPEN' and
              capture['channels'][ch]['cancel']=='NOT_REQUESTED' for ch in _CHANNELS),
              'CURRENT_READY_DRAINS')
        self._resume['state']='PENDING'
        return self._ticket('RESUME',('child.primaryThread',))

    @_ack
    def finish_resume(self,ticket,outcome,prior_count=None):
        self._take(ticket,'RESUME')
        _need(type(outcome) is str and outcome in ('RETURNED','FAILED','UNRESOLVED'),'RESUME_OUTCOME')
        _need((_uint(prior_count,0xfffffffe) if outcome=='RETURNED' else prior_count is None),'RESUME_COUNT')
        self._resume=dict(state=outcome,priorCount=prior_count);self._done(ticket,outcome)
        if outcome!='RETURNED' or prior_count!=1:self._failure('RESUME_NOT_ONCE')

    def borrow_process(self):
        _need(self._creation['state']=='CREATED','CREATED_PROCESS_LEASE')
        self._open('child.process')
        lease=_Lease(self);self._leases.add(lease)
        return lease

    def end_lease(self,lease):
        _need(type(lease) is _Lease and lease._owner is self and lease in self._leases and lease._active,'LEASE_OWNER')
        lease._active=False;self._leases.remove(lease)

    def begin_wait(self,now_ms,*,cutoff_ms=None):
        _need(_uint(now_ms,0xffffffff-1) and self._last_wait_now<=now_ms<self._deadline_ms,'ABSOLUTE_WAIT_BUDGET')
        _need(self._creation['state']=='CREATED' and self._wait['state'] in ('NOT_OBSERVED','TIMEOUT'),'WAIT_BEGIN')
        self._open('child.process');self._idle('child.process')
        stop=self._deadline_ms if cutoff_ms is None else cutoff_ms
        _need(_uint(stop,0xffffffff-1) and now_ms<stop<=self._deadline_ms,'BOUNDED_ORIGINAL_WAIT_CUTOFF')
        remaining=stop-now_ms
        self._last_wait_now=now_ms;self._wait=dict(state='PENDING',timeoutMs=remaining)
        return self._ticket('WAIT',('child.process',),remaining)

    @_ack
    def finish_wait(self,ticket,outcome):
        self._take(ticket,'WAIT')
        _need(type(outcome) is str and outcome in ('SIGNALED','TIMEOUT','FAILED','UNRESOLVED'),'WAIT_OUTCOME')
        self._wait=dict(state=outcome,timeoutMs=ticket.timeout_ms);self._done(ticket,outcome)
        if outcome!='SIGNALED':self._failure('WAIT:'+outcome)

    def begin_exit_query(self):
        _need(self._wait['state']=='SIGNALED' and self._exit['state']=='NOT_OBSERVED','SIGNALED_EXIT_QUERY')
        self._open('child.process');self._idle('child.process')
        self._exit['state']='PENDING'
        return self._ticket('EXIT',('child.process',))

    @_ack
    def finish_exit_query(self,ticket,outcome,code=None):
        self._take(ticket,'EXIT')
        _need(type(outcome) is str and outcome in ('OBSERVED','FAILED','UNRESOLVED'),'EXIT_OUTCOME')
        _need((_uint(code) if outcome=='OBSERVED' else code is None),'EXACT_DWORD_EXIT')
        self._exit=dict(state=outcome,code=code);self._done(ticket,outcome)
        if outcome!='OBSERVED' or code!=0:self._failure('EXIT_ADVERSE')

    def begin_job_retirement(self):
        _need(self._retirement=='NOT_ATTEMPTED','SINGLE_PRIVATE_JOB_RETIREMENT')
        self._open('job');self._idle('job')
        self._retirement='PENDING'
        return self._ticket('RETIRE_JOB',('job',))

    @_ack
    def finish_job_retirement(self,ticket,outcome):
        self._take(ticket,'RETIRE_JOB')
        _need(type(outcome) is str and outcome in ('TERMINATED','FAILED','UNRESOLVED'),'RETIREMENT_OUTCOME')
        self._retirement=outcome;self._done(ticket,outcome);self._failure('FORCED_RETIREMENT:'+outcome)

    def begin_job_accounting(self):
        _need(self._accounting['state']=='NOT_OBSERVED','JOB_ACCOUNTING_ONCE')
        if self._creation['state']=='CREATED' and self._wait['state']=='SIGNALED':phase='POST_EXIT'
        elif self._creation['callQuiescent'] and self._retirement=='TERMINATED':phase='FORCED_QUIESCENT'
        elif self._creation['state']=='FAILED' and self._creation['callQuiescent']:phase='FAILED_CREATION'
        else:raise ValueError('DIRECT_OWNER_V1:POST_ACTIVITY_JOB_ACCOUNTING')
        self._open('job');self._idle('job');self._accounting['state']='PENDING'
        self._accounting['phase']=phase
        return self._ticket('JOB_ACCOUNTING',('job',))

    @_ack
    def finish_job_accounting(self,ticket,outcome,active=None):
        self._take(ticket,'JOB_ACCOUNTING')
        _need(type(outcome) is str and outcome in ('OBSERVED','FAILED','UNRESOLVED'),'ACCOUNTING_OUTCOME')
        _need((_uint(active) if outcome=='OBSERVED' else active is None),'ACCOUNTING_ACTIVE')
        self._accounting=dict(state=outcome,active=active,phase=self._accounting['phase']);self._done(ticket,outcome)
        if outcome!='OBSERVED' or active!=0:self._failure('JOB_NOT_OBSERVED_EMPTY')

    def begin_capture_sink_close(self, capture_ticket, staged_readback=None, no_reader_cleanup=None):
        # Validate the original capture operation, not a caller-supplied label.
        fields, row = self._capture._take(capture_ticket, 'CLOSE')
        ch = capture_ticket._channel
        name = ch + '.sink'
        self._open(name); self._idle(name)
        if no_reader_cleanup is not None:
            _need(staged_readback is None and no_reader_cleanup.owner is self and
                  no_reader_cleanup is self._capture._no_reader_cleanup and
                  no_reader_cleanup.coordinator.no_reader_cleanup is no_reader_cleanup and
                  self._capture._pending=={capture_ticket} and not self._capture._exports,
                  'ORIGINAL_NO_READER_CLOSE_TOKEN')
        elif staged_readback is None:
            _need(self._capture._pending == {capture_ticket}, 'SOLE_ORIGINAL_CAPTURE_CLOSE')
        else:
            self._capture.staged_close_allowed(staged_readback, capture_ticket)
        _need(row['reader'] == ('NOT_STARTED' if no_reader_cleanup is not None else 'TERMINATED') and row['sink'] == 'CLOSE_REQUESTED',
              'ORIGINAL_TERMINATED_CAPTURE_CLOSE')
        ticket = self._ticket('CAPTURE_CLOSE:' + name, (name,))
        ticket.capture_ticket = capture_ticket
        ticket.close_outcome = None
        self._slots[name].state = 'CLOSE_PENDING'
        return ticket

    @_ack
    def finish_capture_sink_close(self, ticket, outcome):
        _need(type(ticket) is _Ticket and len(ticket.names) == 1,
              'CAPTURE_CLOSE_ACK')
        self._take(ticket, 'CAPTURE_CLOSE:' + ticket.names[0])
        _need(type(outcome) is str and outcome in ('CLOSED','FAILED','UNRESOLVED') and
              ticket.close_outcome is None, 'ONE_CAPTURE_CLOSE_OUTCOME')
        # Keep the delivered effect outcome before either acknowledgement.
        # An acknowledgement exception never grants another native close.
        ticket.close_outcome = outcome
        self._capture.finish_sink_close(ticket.capture_ticket, outcome)
        self._slots[ticket.names[0]].state = outcome
        self._done(ticket, outcome)
        if outcome != 'CLOSED': self._failure('RESOURCE_CLOSE:' + outcome)

    def begin_close(self,name):
        _need(type(name) is str and name in _RESOURCES,'CLOSE_ROLE')
        self._open(name);self._idle(name)
        if name in ('stdin.child','stdout.write','stderr.write','startup.attributeList','startup.storage'):
            _need(self._creation['state'] in ('NOT_ATTEMPTED','CREATED','FAILED'),'CREATION_USE_UNRESOLVED')
        if name=='child.process':_need(not self._leases,'PROCESS_BORROWED')
        channels=self._capture.view()['channels']
        for ch in _CHANNELS:
            if name in (ch+'.read',ch+'.readerThread',ch+'.sink'):
                # Conservatively retain each reader resource until every
                # capture effect has acknowledged; cancellation uses that
                # original reader capability even after reader termination.
                _need(self._capture.view()['pending']==0,'CAPTURE_OPERATION_PENDING')
                _need(channels[ch]['reader']=='TERMINATED','READER_NOT_TERMINATED')
                if name==ch+'.sink':_need(channels[ch]['sink']=='CLOSED','CAPTURE_SINK_NOT_CLOSED')
        self._slots[name].state='CLOSE_PENDING'
        return self._ticket('CLOSE:'+name,(name,))

    @_ack
    def finish_close(self,ticket,outcome):
        _need(type(ticket) is _Ticket and len(ticket.names)==1,'CLOSE_ACK')
        self._take(ticket,'CLOSE:'+ticket.names[0])
        _need(type(outcome) is str and outcome in ('CLOSED','FAILED','UNRESOLVED'),'CLOSE_OUTCOME')
        self._slots[ticket.names[0]].state=outcome;self._done(ticket,outcome)
        if outcome!='CLOSED':self._failure('RESOURCE_CLOSE:'+outcome)

    def snapshot(self):
        c=self._capture.view();b=c['budget']
        capture=dict(state=c['state'],pending=c['pending'],unacknowledgedExports=c['unacknowledgedExports'],
                     failures=len(c['failures']),spent=b['spent'],held=b['held'],
                     refused=b['refused'],uncertain=b['uncertain'])
        clean=(not self._failures and not self._pending and not self._leases and
               self._creation['state']=='CREATED' and self._creation['callQuiescent'] and self._creation['pid'] is not None and self._creation['tid'] is not None and
               self._membership=='MEMBER' and all(self._ready.values()) and
               self._resume==dict(state='RETURNED',priorCount=1) and
               self._wait['state']=='SIGNALED' and self._exit==dict(state='OBSERVED',code=0) and
               self._retirement=='NOT_ATTEMPTED' and self._accounting==dict(state='OBSERVED',active=0,phase='POST_EXIT') and
               all(slot.state=='CLOSED' for slot in self._slots.values()) and
               capture['state']=='SEALED_COMPLETE' and capture['pending']==0 and
               capture['unacknowledgedExports']==0 and capture['failures']==0 and
               capture['held']==0 and not capture['refused'] and not capture['uncertain'])
        return dict(schema=2,kind='SUPPLIED_DIRECT_OWNER_V2',binding=_copy(self._binding),
                    creation=_copy(self._creation),membership=self._membership,readerReady=_copy(self._ready),
                    resume=_copy(self._resume),wait=_copy(self._wait),exit=_copy(self._exit),
                    jobRetirement=self._retirement,jobAccounting=_copy(self._accounting),
                    resourceClosures={name:slot.state for name,slot in self._slots.items()},
                    pendingOperations=len(self._pending),leases=len(self._leases),failures=list(self._failures),
                    capture=capture,classification='CLEAN_LOCAL' if clean else 'ADVERSE',
                    physicalCapture=False,sourceCustody=False,nativeEligibility=False,wholeAttempt=False)

    def begin_unstarted_read_close(self, name, token):
        _need(name in ('stdout.read','stderr.read') and token.owner is self,
              'UNSTARTED_ORIGINAL_READ_ROLE')
        self._capture.require_no_reader_cleanup(token)
        self._open(name);self._idle(name)
        _need(self._slots[name].value is dict(token.resources)[name],
              'UNSTARTED_ORIGINAL_READ_SLOT')
        ticket=self._ticket('CLOSE:'+name,(name,))
        self._slots[name].state='CLOSE_PENDING'
        return ticket
