"""Private maintained-caller composition; unexecuted, not installed.

Q/C/S/B/T/P are exact modules from the future checked source closure. Effects
and identity observation stay behind those original owners. The proposed
instrument supplies ports; those supplied values are not native admission.
"""
import ordinary_direct_finish_coordinator as Q
import ordinary_direct_capture_finish as C
import ordinary_direct_capture_core as C0
import ordinary_direct_startup_storage as T
import ordinary_direct_fixed_plan as P
import ordinary_direct_owner_reader as DR
import ordinary_direct_finish_reader as R
import json
import hashlib
import ordinary_direct_timing_v1 as TM
import ordinary_direct_process_owner as SO

_EDGES=('inner','electron','ui')
_ROLES=('stdout','stderr','archive','index')

def _need(ok,code):
    if ok is not True:raise ValueError('MAINTAINED_DIRECT:'+code)

def _fixed_files(plan):
    root=plan.cwd+'\\execution\\'
    files=dict(stdout=root+plan.edge+'-stdout.log',stderr=root+plan.edge+'-stderr.log')
    if plan.edge=='electron':
        files.update(archive=root+'electron-stderr-prefix-frames.bin',
                     index=root+'electron-stderr-prefix-index.json')
    return files

class _OwnedEdge:
    """One original edge, retained by the caller before acquire_and_start.

    The parent supplies one inherited absolute clock coordinate for all its
    edges. Nothing here adopts a fresh cleanup deadline or Popen settlement.
    """
    def __init__(self, coordinator, plan, now_ms, describe,*,timing=None):
        _need(type(coordinator) is Q._Coordinator,'EXACT_COORDINATOR')
        plan=P._validate_fixed_plan(plan)
        five=type(timing) is TM._FiveRoleTimingV2
        external=type(timing) is TM._ExternalTimingV1 or five
        _need(plan.edge in (('owner','outer','inner','electron','ui') if five else ('owner','outer') if external else _EDGES) and coordinator.capture._binding['edge']==plan.edge,
              'FIXED_MAINTAINED_EDGE')
        expected_deadline=timing.supervision_cutoff_ms if external else plan.maintained_parent_budget_seconds*1000
        _need(coordinator.owner._deadline_ms==expected_deadline,'UNCHANGED_PARENT_DEADLINE_COORDINATE')
        _need(callable(now_ms) and callable(describe),'FIXED_CLOCK_DESCRIPTION_PORTS')
        self.q=coordinator;self.plan=plan;self.now_ms=now_ms;self.describe=describe
        self.files=_fixed_files(plan)
        self.primary=None;self.secondary=[];self.identity=None;self.identity_lease=None
        self._identity_slot=None;self._identity_handle=None;self._identity_pid=None
        self.started=False;self.finalization_started=False;self.finalization_complete=False;self.result=None
        self.close_attempts=set();self.cancel_attempts=set();self.prefix_exports=[]
        self._finalization_interrupted=False
        self._final_clock_unavailable=False;self._final_clock_last=-1
        self._final_pump_unavailable=False
        self._timing=timing;self._external_execution=external;self._five_role_execution=five
        if timing is not None:
            _need(type(timing) in (TM._EdgeTimingV1,TM._ExternalTimingV1,TM._FiveRoleTimingV2),'EXACT_LOCAL_TIMING_POLICY')
            timing.validate_for(timing.parent,plan.edge,now_ms)
            bound={key:value for key,value in timing.declaration()['roleBinding'].items() if key in ('attemptId','edge','headerSha256','creationInvocationId')}
            _need(C0._equal(bound,coordinator.capture._binding) and timing.supervision_cutoff_ms==coordinator.owner._deadline_ms,'ORIGINAL_TIMED_OWNER_BINDING')
            _need(coordinator.backend._dispatch_guard is None and coordinator._timing_waits is None,'SINGLE_DISPATCH_TIMING_BIND')
            coordinator._timing_waits=[];coordinator.backend._dispatch_guard=timing.admit

    def _remaining_ms(self):
        if self._timing is not None:return self._timing.remaining('WORK')
        now=self.now_ms()
        _need(type(now) is int and 0<=now<=0xfffffffe,'PARENT_ABSOLUTE_CLOCK')
        return max(0,self.q.owner._deadline_ms-now)

    def _abort(self,phase,error):
        _need(isinstance(error,BaseException),'ACTUAL_ERROR')
        if self.primary is None:self.primary=error
        elif error is not self.primary and not any(saved is error for stage,saved in self.secondary):
            # Retain the actual later object before optional abort bookkeeping.
            self.secondary.append((phase,error))
        try:
            with self.q.lock:
                if self.q.capture._state not in ('SEALED_COMPLETE','SEALED_ADVERSE'):
                    self.q._record_abort(phase,error)
                else:self.q.owner.bookkeeping_failed(error)
        except BaseException as retention_error:
            self.secondary.append(('ABORT_RETENTION:'+phase,retention_error))

    def _attempt(self,phase,operation):
        try:return operation()
        except BaseException as error:
            self.secondary.append((phase,error))
            self._abort(phase,error)
            return None

    def _close_resource_once(self,name):
        # A pending/failed attempt is not retried by a later finally path.
        if name in self.close_attempts:return
        if self.q.owner._slots[name].state!='OPEN':return
        self.close_attempts.add(name)
        def close():
            with self.q.lock:
                if name in self.q.backend.handles:
                    self.q.backend.require_resource_quiescence(name)
            return self.q.close_resource(name)
        self._attempt('RESOURCE_CLOSE:'+name,close)

    def _final_port(self,phase,operation):
        try:return True,operation()
        except BaseException as error:
            self._finalization_interrupted=True
            self._abort('FINALIZATION_PORT:'+phase,error)
            return False,None

    def _final_now(self):
        # An unavailable clock never becomes a made-up zero remaining budget.
        # Do not retry the same failed port during this finalization.
        if self._final_clock_unavailable:return None
        def read():
            now=self.now_ms() if self._timing is None else self._timing.sample()
            _need(type(now) is int and 0<=now<=0xfffffffe and self._final_clock_last<=now,
                  'FINAL_PARENT_ABSOLUTE_CLOCK')
            self._final_clock_last=now
            return now
        available,now=self._final_port('CLOCK',read)
        if not available:self._final_clock_unavailable=True
        return now

    def _cancel_reader_for_adversity_once(self,channel,initial_normal):
        with self.q.lock:
            adverse=(not initial_normal or self.primary is not None or bool(self.secondary) or
                     self.q.capture._state!='ACTIVE')
            needed=(adverse and not self.q.readers[channel].native_signaled and
                    channel not in self.cancel_attempts)
            if needed:self.cancel_attempts.add(channel)
        if needed:
            # Original cancellation needs no new clock and never means that
            # the outstanding read, callback or thread has completed.
            self._attempt('CANCEL_READER:'+channel,lambda:self.q.cancel_reader(channel))

    def acquire_and_start(self,security,make_storage,pump,sleep):
        _need(not self.started and not self.finalization_started,'SINGLE_START')
        self.started=True
        try:
            _need(self._remaining_ms()>0,'INHERITED_START_DEADLINE')
            self.q.acquire_job();self.q.acquire_nul(security)
            for channel in ('stdout','stderr'):
                self.q.acquire_pipe(channel,security)
                self.q.acquire_sink(channel,self.files[channel])
            if self.plan.edge=='electron':
                self.q.acquire_electron_files((self.files['archive'],self.files['index']))
            # The production storage factory must join the fixed checked plan;
            # a constructor-bypassing fake is an explicitly distinct test port.
            storage=make_storage(self.q,self.plan)
            _need(type(storage) is T._StartupStorage,'EXACT_STARTUP_STORAGE')
            self.q.attach_startup(storage)
            _need(self._remaining_ms()>0,'INHERITED_CREATE_DEADLINE')
            ticket,call=self.q.create_once(self.plan)
            _need(call.state=='RETURNED' and bool(call.raw),'KNOWN_CHILD_CREATION')
            if self._timing is not None:_need(self._remaining_ms()>0,'POST_CREATE_WORK_CUTOFF')
            _need(self.q.observe_membership()=='MEMBER','ORIGINAL_PRIVATE_JOB_MEMBER')
            for name in ('stdin.child','stdout.write','stderr.write',
                         'startup.attributeList','startup.storage'):
                self._close_resource_once(name)
            _need(not self.secondary,'STARTUP_CLEANUP_ADVERSE')
            self.q.start_readers()
            while not all(reader.armed for reader in self.q.readers.values()):
                _need(self._remaining_ms()>0,'DRAIN_READY_PARENT_DEADLINE')
                _need(self.q.capture._state=='ACTIVE' and
                      not any(reader.exception is not None for reader in self.q.readers.values()),
                      'DRAIN_READY_ADVERSE')
                pump(self.q)
                if not all(reader.armed for reader in self.q.readers.values()):sleep(min(0.001,self._remaining_ms()/1000))
            _need(self._remaining_ms()>0,'INHERITED_RESUME_DEADLINE')
            resumed=self.q.resume_child()
            _need(resumed.state=='RETURNED' and type(resumed.raw) is int and resumed.raw==1,
                  'ORIGINAL_CHILD_RESUMED_ONCE')
            self._close_resource_once('child.primaryThread')
            _need(not self.secondary,'PRIMARY_THREAD_CLOSE_ADVERSE')
            return self
        except BaseException as error:
            self._abort('MAINTAINED_START',error)
            raise

    def borrow_identity(self):
        _need(not self.finalization_started and self.identity_lease is None,
              'IDENTITY_LEASE_ONCE_BEFORE_FINALIZATION')
        with self.q.lock:
            self.identity_lease=self.q.owner.borrow_process()
            self._identity_slot=self.identity_lease.value
            self._identity_handle=self._identity_slot.cell.value
            self._identity_pid=self.q.owner._creation['pid']
            _need(type(self._identity_handle) is int and 0<self._identity_handle<(1<<64)-16 and
                  type(self._identity_pid) is int and self._identity_pid>0,
                  'RETAINED_ORIGINAL_IDENTITY_VALUES')
        return self.identity_lease

    def original_process_handle(self):
        _need(not self.finalization_started and self.identity_lease is not None,
              'LIVE_ORIGINAL_IDENTITY_LEASE')
        slot=self.identity_lease.value
        _need(slot is self._identity_slot and slot is self.q.backend.handles['child.process'] and
              type(slot.cell.value) is int and slot.cell.value==self._identity_handle and
              self.q.owner._creation['pid']==self._identity_pid,'ORIGINAL_PROCESS_SLOT')
        return self._identity_handle

    def remember_identity(self,value):
        self.original_process_handle()
        _need(self.identity is None and type(value) is dict and
              set(value)=={'pid','image','createdFileTime'} and
              type(value['pid']) is int and value['pid']==self.q.owner._creation['pid'] and
              type(value['image']) is str and value['image'].casefold()==self.plan.application.casefold() and
              type(value['createdFileTime']) is str and 1<=len(value['createdFileTime'])<=20 and
              value['createdFileTime'].isascii() and value['createdFileTime'].isdecimal() and
              0<int(value['createdFileTime'])<(1<<64),
              'OBSERVED_ORIGINAL_IDENTITY')
        self.identity=dict(value)
        return dict(value)

    def committed_prefix(self,consume):
        _need(self.plan.edge=='electron' and not self.finalization_started and
              callable(consume),'OWNED_ENDPOINT_PREFIX')
        exported=self.q.publish_prefix()
        _need(exported is not None,'COMMITTED_PREFIX_EXPORT')
        viewed=False;primary=None
        try:
            with self.q.lock:
                value=exported.view();viewed=True
                self.prefix_exports.append(value)
            return consume(value['bytes'])
        except BaseException as error:
            primary=error
            self._abort('ENDPOINT_PREFIX_CONSUMPTION',error)
            raise
        finally:
            if viewed:
                try:
                    with self.q.lock:self.q.capture.acknowledge_export(exported)
                except BaseException as error:
                    self._abort('ENDPOINT_PREFIX_ACK',error)
                    if primary is None:raise
                    self.secondary.append(('ENDPOINT_PREFIX_ACK',error))

    def finish_endpoint_discovery(self):
        _need(self.plan.edge=='electron' and not self.finalization_started,'ENDPOINT_PHASE')
        with self.q.lock:self.q.capture.finish_discovery('ENDPOINT_FOUND')

    def wait_original_exit(self):
        _need(not self.finalization_started and self._remaining_ms()>0,
              'ORIGINAL_WAIT_PARENT_DEADLINE')
        try:
            outcome=(self.q.wait_process(self.now_ms()) if self._timing is None else
                self.q.wait_process(self._timing.sample(),cutoff_ms=self._timing.work_cutoff_ms))
            _need(outcome=='SIGNALED','ORIGINAL_PROCESS_SIGNAL')
            if self._timing is not None:_need(self._remaining_ms()>0,'POST_WAIT_WORK_CUTOFF')
            call,code=self.q.query_exit()
            if self._timing is not None:_need(self._remaining_ms()>0,'POST_QUERY_WORK_CUTOFF')
            _need(call.state=='RETURNED' and bool(call.raw) and
                  type(code.value) is int and code.value==0,'ORIGINAL_NORMAL_EXIT')
            with self.q.lock:
                return dict(kind='DIRECT_ORIGINAL_EXIT_V1',binding=dict(self.q.capture._binding),
                    pid=self.q.owner._creation['pid'],wait=dict(self.q.owner._wait),
                    exit=dict(self.q.owner._exit))
        except BaseException as error:
            self._abort('ORIGINAL_WAIT_EXIT',error)
            raise

    def _job_empty(self):
        row=self.q.owner._accounting
        return row['state']=='OBSERVED' and type(row['active']) is int and row['active']==0

    def finalize(self,primary,pump,sleep):
        if self.finalization_started:
            _need(self.result is not None,'ORIGINAL_FINALIZATION_INCOMPLETE_NO_RETRY')
            return self.result
        self.finalization_started=True
        if self._timing is not None:self._timing.begin_cleanup()
        if primary is not None:self._abort('CALLER_PRIMARY',primary)
        if self.identity_lease is not None:
            lease=self.identity_lease
            def end_identity_lease():
                with self.q.lock:self.q.owner.end_lease(lease)
            self._attempt('END_IDENTITY_LEASE',end_identity_lease)
        normal=(self.primary is None and not self.secondary and
                self.q.owner._wait['state']=='SIGNALED' and
                self.q.owner._exit==dict(state='OBSERVED',code=0))
        if not normal:
            if self.primary is None:self._abort('MISSING_NORMAL_EXIT',RuntimeError('DIRECT_NORMAL_EXIT_UNAVAILABLE'))
            if self.q.owner._creation['state']!='NOT_ATTEMPTED' and self.q.owner._slots['job'].state=='OPEN':
                self._attempt('OWNED_JOB_RETIREMENT',self.q.retire_job)
            if self.q.owner._creation['state']=='CREATED' and (self.q.owner._wait['state']=='NOT_OBSERVED' or
                self._timing is not None and self.q.owner._wait['state']=='TIMEOUT'):
                now=self._final_now()
                if now is not None and now<self.q.owner._deadline_ms:
                    self._attempt('FORCED_ORIGINAL_WAIT',lambda:self.q.wait_process(now))
        if self.q.owner._slots['job'].state=='OPEN':
            now=self._final_now()
            accounting=(self._attempt('BEGIN_JOB_ACCOUNTING',self.q.begin_accounting)
                if now is not None and now<self.q.owner._deadline_ms else None)
            if accounting is not None:
                while not self.q.accounting['complete']:
                    now=self._final_now()
                    if now is None:break
                    if now>=self.q.owner._deadline_ms:
                        self._attempt('EXPIRE_JOB_ACCOUNTING',lambda:self.q.expire_accounting(accounting,now))
                        break
                    previous_errors=len(self.secondary)
                    self._attempt('POLL_JOB_ACCOUNTING',lambda:self.q.poll_accounting(accounting,now))
                    if len(self.secondary)!=previous_errors or self.q.accounting['complete']:break
                    now=self._final_now()
                    if now is None:break
                    if now>=self.q.owner._deadline_ms:continue
                    available,unused=self._final_port('SLEEP',lambda:sleep(min(0.001,(self.q.owner._deadline_ms-now)/1000)))
                    if not available:break
        for channel in ('stdout','stderr'):
            reader=self.q.readers[channel]
            if self.q.backend.handles[channel+'.readerThread'].state!='OPEN':continue
            self._cancel_reader_for_adversity_once(channel,normal)
            if not self._final_pump_unavailable and not self._final_clock_unavailable:
                available,unused=self._final_port('PUMP',lambda:pump(self.q))
                if not available:self._final_pump_unavailable=True
            now=self._final_now()
            # PUMP/CLOCK may have made this very channel adverse. Re-evaluate
            # before waiting, without retrying a cancellation already attempted.
            self._cancel_reader_for_adversity_once(channel,normal)
            if now is not None and now<self.q.owner._deadline_ms:
                self._attempt('WAIT_READER:'+channel,
                    lambda ch=channel:self.q.observe_reader_end(ch,self.q.owner._deadline_ms-now))
        normal=(normal and self.primary is None and not self.secondary and self._job_empty() and
                all(reader.native_signaled for reader in self.q.readers.values()))
        if normal:
            self._attempt('FREEZE_AND_PUBLISH_INDEX',self.q.freeze_and_publish_index)
            if not self.secondary:self._attempt('STAGE_FINAL',self.q.stage_final)
        if self.q.final_ticket is not None:
            # Neither missing rows nor partially settled staging grants close.
            def staged_allowed():
                with self.q.lock:self.q.capture.staged_close_allowed(self.q.final_ticket)
                return True
            if self._attempt('STAGED_CLOSE_PERMISSION',staged_allowed) is True:
                for channel in ('stdout','stderr'):
                    self._attempt('CLOSE_STAGED_SINK:'+channel,
                                  lambda ch=channel:self.q.close_staged_sink(ch))
                if self.plan.edge=='electron':
                    for role in ('archive','index'):
                        self._attempt('CLOSE_STAGED_EXTRA:'+role,lambda r=role:self.q.close_staged_extra(r))
                self._attempt('CONSUME_FINAL',self.q.seal_final)
        else:
            for channel in ('stdout','stderr'):
                if self.q.owner._slots[channel+'.sink'].state=='OPEN':
                    self._attempt('CLOSE_ABORT_SINK:'+channel,lambda ch=channel:self.q.close_sink(ch))
            if self.plan.edge=='electron':
                for role in ('archive','index'):
                    if self.q.extras[role]['state']=='OPEN':
                        self._attempt('CLOSE_ABORT_EXTRA:'+role,lambda r=role:self.q.close_staged_extra(r))
        for name in ('stdout.read','stderr.read','stdout.readerThread','stderr.readerThread',
                     'stdin.child','stdout.write','stderr.write','child.primaryThread',
                     'startup.attributeList','startup.storage'):
            self._close_resource_once(name)
        activity_quiescent=(self.q.owner._creation['state']=='NOT_ATTEMPTED' or self._job_empty())
        if activity_quiescent:
            self._close_resource_once('child.process');self._close_resource_once('job')
        self.finalization_complete=not self._finalization_interrupted
        self.result=self.project_outcome()
        return self.result


    def project_timed_outcome(self):
        _need(self._timing is not None,'TIMING_RECEIPT_REQUIRES_OPT_IN')
        try:self._timing.sample()
        except BaseException as error:self._abort('TIMING_FINAL_SAMPLE',error)
        row=self.project_outcome();waits=[]
        for receipt in self.q._timing_waits:
            ticket=receipt['_ticket']
            _need(type(ticket) is SO._Ticket and ticket.owner is self.q.owner and
                ticket.timeout_ms==receipt['timeoutMs'],'ORIGINAL_TIMED_WAIT_TICKET')
            waits.append({key:value for key,value in receipt.items() if key!='_ticket'})
        observed=row['owner']['exit'];available=observed['state']=='OBSERVED'
        return dict(schema=1,kind='SIREN_FIVE_ROLE_TIMED_EDGE_V2' if self._five_role_execution else 'SIREN_EXTERNAL_TIMED_EDGE_V1' if self._external_execution else 'SIREN_TIMED_EDGE_V1',timing=self._timing.snapshot(),waits=waits,
            exitObservation=dict(available=available,code=observed['code'] if available else None),edge=row)

    def _description(self,error):
        if error is None:return None
        # Rendering failure is allowed to escape to the maintained publisher's
        # explicit unavailable-result branch. Never invent a successful error.
        value=self.describe(error)
        _need(type(value) is dict,'ACTUAL_ERROR_DESCRIPTION')
        return value

    def _call_projection(self,call):
        raw=call.raw
        kind=('NULL' if raw is None else 'INTEGER' if type(raw) is int else
              'BOOLEAN' if type(raw) is bool else 'UNAVAILABLE')
        return dict(label=call.label,state=call.state,resultKind=kind,
            raw=raw if kind!='UNAVAILABLE' else None,savedError=call.error,
            exception=self._description(call.exception))

    def project_outcome(self):
        """Pure retained-state projection; no IO, retry, refund or close right.

        Parent callers project again after ALL sibling edges finish, since a
        shared budget can still have another edge's holds at earlier snapshots.
        That is another metadata occurrence, never another capture/body read.
        """
        q=self.q;finish=None;body_rows=None;projection_errors=[]
        admitted_phases=('STAGED_QUIESCENT','FAILED_QUIESCENT','UNRESOLVED','CONSUMED')
        with q.lock:
            ticket=q.final_ticket
            joined=(ticket is not None and ticket is q.capture._final and
                    ticket._owner is q.capture and ticket._kind=='READBACK')
            fields=None if not joined else ticket._fields
            phase=None if fields is None else fields.get('phase')
            rows_state=('UNAVAILABLE' if fields is None else 'NOT_STAGED' if
                        fields.get('rows') is None else 'PRESENT_UNFINALIZED')
            settled=None if fields is None else fields.get('settled')
            staged=(joined and phase in admitted_phases and settled is True and
                    type(fields.get('rows')) is tuple and len(fields['rows'])==4)
            if staged:
                resources=fields.get('resources')
                expected=tuple(q.backend.handles[q.backend._name(role)] if
                    self.plan.edge=='electron' or i<2 else None for i,role in enumerate(_ROLES))
                _need(type(resources) is tuple and len(resources)==4 and
                      all(a is b for a,b in zip(resources,expected)), 'FINAL_ORIGINAL_RESOURCE_JOIN')
                body_rows=tuple(row['body'] for row in fields['rows'])
                _need(all(type(body) is bytes for body in body_rows),'RETAINED_STAGED_BYTES')
        # finish_record owns its lock. Do not require a new reentrant lock just
        # to project an existing owner. A changed concurrent snapshot is refused
        # conservatively; clean parent projection occurs after siblings settle.
        if staged:
            try:
                finish=q.finish_record()
                raw=json.dumps(finish,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')
                finish_classification=R.read(raw,body_rows)['classification']
                rows_state='STAGED'
            except BaseException as error:
                projection_errors.append(dict(kind='ACTUAL_EXCEPTION',error=self._description(error)))
                finish=None;body_rows=None
        with q.lock:
            owner=q.owner.snapshot();capture=q.capture.view()
            owner_classification=DR.read_edge(owner)['classification']
            if finish is not None and not C0._equal(finish['capture'],capture):
                projection_errors.append(dict(kind='SNAPSHOT_CHANGED',error=None))
                finish=None;body_rows=None
            if finish is not None:disposition='STAGED_FINISH'
            elif not q.final_started and q.final_ticket is None and q.prefinal_abort is not None:
                disposition='PREFINAL_ABORT'
            else:disposition='FINAL_READBACK_UNAVAILABLE'
            attempts={}
            for channel,attempt in q.backend.reader_attempts.items():
                call=attempt['call']
                attempts[channel]=dict(state=attempt['state'],call=None if call is None else
                    self._call_projection(call),backendSlot=q.backend.handles[channel+'.readerThread'].state,
                    ownerSlot=q.owner._slots[channel+'.readerThread'].state)
            availability={}
            for i,role in enumerate(_ROLES):
                applicable=role in self.files
                if not applicable:
                    availability[role]=dict(state='NOT_APPLICABLE',reference=None)
                elif body_rows is None:
                    availability[role]=dict(state='UNAVAILABLE',reference=None)
                else:
                    body=body_rows[i]
                    availability[role]=dict(state='RETAINED_STAGED_BYTES',reference=dict(
                        path=self.files[role],bytes=len(body),sha256=hashlib.sha256(body).hexdigest()))
            clean=(self.finalization_complete and finish is not None and phase=='CONSUMED' and
                   owner_classification=='CLEAN_LOCAL' and finish_classification=='CLEAN_INERT' and
                   self.primary is None and not self.secondary and not projection_errors and
                   self.identity is not None)
            record=dict(schema=1,kind='MAINTAINED_DIRECT_EDGE_V1',binding=dict(capture['binding']),
                disposition=disposition,classification='CLEAN_INERT' if clean else 'ADVERSE',
                finalizationComplete=self.finalization_complete,identity=self.identity,
                owner=owner,capture=capture,readerAttempts=attempts,
                finalReadback=dict(finalAttemptStarted=q.final_started,
                    ticketPresent=ticket is not None,ticketJoined=joined,
                    phase=phase,rowsState=rows_state,settled=settled,
                    finishRecordAvailability='AVAILABLE' if finish is not None else 'UNAVAILABLE'),
                captureFinish=finish,bodyAvailability=availability,
                calls=[self._call_projection(call) for call in q.backend.calls],
                primaryPresent=self.primary is not None,primary=self._description(self.primary),
                secondary=[dict(stage=stage,error=self._description(error)) for stage,error in self.secondary],
                projectionErrors=projection_errors,physicalCapture=False,sourceCustody=False,
                nativeEligibility=False,wholeAttempt=False,
                scope='supplied original-owner projection; no capability transfer')
        if self._external_execution:
            record['kind']='SIREN_FIVE_ROLE_DIRECT_EDGE_V2' if self._five_role_execution else 'SIREN_EXTERNAL_DIRECT_EDGE_V1'
            record['execution']=self._timing.execution_descriptor(q.owner._deadline_ms)
        raw=json.dumps(record,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')
        _need(len(raw)<=262144,'BOUNDED_EDGE_PROJECTION')
        return json.loads(raw)
