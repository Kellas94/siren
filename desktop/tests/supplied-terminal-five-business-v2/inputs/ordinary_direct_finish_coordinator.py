"""One original-resource finish owner over the preserved edge coordinator.

Q0 is injected. Effects remain outside the supplied lock. Final helper records
are explicitly inert/supplied until physical qualification is separately done.
"""
import ordinary_direct_coordinator_base as Q0
import ordinary_direct_capture_core as C0
import ordinary_direct_capture_finish as C
_ROLES = ('stdout','stderr','archive','index')

def _need(ok, code):
    if ok is not True:
        raise ValueError('CAPTURE_FINISH_COORDINATOR:' + code)

def _closed(call):
    return 'UNRESOLVED' if call.state != 'RETURNED' else 'CLOSED' if call.raw else 'FAILED'

class _Coordinator(Q0._Coordinator):
    def __init__(self, *args):
        super().__init__(*args)
        self.extras = {r:dict(state='NOT_ACQUIRED', resource=self.backend.handles[r],
                             acquisition=None, close=None) for r in ('archive','index')}
        self.final_ticket = None
        self.events = []
        self.accounting = None
        self.prefinal_abort = None
        self.final_started = False
        self.no_reader_cleanup = None
        self.acquisition_ack_errors = []

    def acquire_sink(self, channel, path):
        _need(channel in self.readers, 'CHANNEL')
        with self.lock:
            _need(not self.capture._aborted,'NO_ACQUISITION_AFTER_ABORT')
            ticket=self.owner.begin_acquire(channel+'.sink')
        ack_attempted=False
        try:
            slot=self.backend.acquire_fixed_file(channel,path)
            if slot.state!='OPEN':raise ValueError('CAPTURE_FINISH_COORDINATOR:SINK_ACQUIRED')
            with self.lock:
                ack_attempted=True
                _need(self._acquired(ticket,slot),'SINK_ACQUIRED')
        except BaseException as error:
            slot=self.backend.handles[channel+'.sink']
            with self.lock:
                # Primary first, including metadata errors after a known HANDLE.
                self._record_abort('STREAM_ACQUISITION',error,slot.original_call)
                if not ack_attempted:
                    ack_attempted=True
                    try:self._acquired(ticket,slot)
                    except BaseException as ack_error:self.acquisition_ack_errors.append(ack_error)
            raise

    def start_readers(self):
        with self.lock:
            _need(not self.reader_creation_started and not self.backend.reader_creation_barred and
                  not self.capture._aborted,'READER_PAIR_START_ONCE_BEFORE_ABORT')
            self.reader_creation_started=True
        try:
            with self.lock:
                for ch in self.readers:
                    def main(argument,channel=ch):return self._reader_main(channel)
                    self.callbacks[ch]=self.backend.t['READER_CALLBACK'](main)
            for ch in self.readers:
                with self.lock:
                    _need(not self.capture._aborted,'NO_READER_DISPATCH_AFTER_ABORT')
                    ticket=self.owner.begin_acquire(ch+'.readerThread')
                slot,call,tid=self.backend.create_reader_suspended(ch,self.callbacks[ch],self.readers[ch])
                with self.lock:
                    if slot.state!='OPEN':
                        error=call.exception or ValueError('CAPTURE_FINISH_COORDINATOR:READER_ACQUIRE')
                        self._record_abort('READER_CREATION',error,call)
                        try:self._acquired(ticket,slot)
                        except BaseException as ack_error:self.acquisition_ack_errors.append(ack_error)
                        raise error
                    _need(self._acquired(ticket,slot),'READER_ACQUIRED')
                    _need(not self.capture._aborted,'NO_READER_RESUME_AFTER_ABORT')
                resumed=self.backend.resume(ch+'.readerThread')
                with self.lock:
                    self._absorb_backend_failure()
                    if resumed.state!='RETURNED' or resumed.raw!=1:
                        raise resumed.exception or RuntimeError('READER_RESUME_FAILED')
        except BaseException as error:
            with self.lock:self._record_abort('READER_START',error)
            raise

    def acquire_electron_files(self, paths):
        _need(self.capture._binding['edge'] == 'electron' and type(paths) is tuple
              and len(paths) == 2, 'ELECTRON_FIXED_FILES')
        for role, path in zip(('archive','index'), paths):
            with self.lock:
                row = self.extras[role]
                _need(row['state'] == 'NOT_ACQUIRED', 'EXTRA_ACQUIRE_ONCE')
                row['state'] = 'ACQUIRING'
            try:
                slot = self.backend.acquire_fixed_file(role, path)
                _need(slot.state == 'OPEN', 'EXTRA_ACQUIRE_RETURNED_OPEN')
            except BaseException as error:
                with self.lock:
                    self._record_abort('EXTRA_ACQUISITION', error)
                raise
            finally:
                with self.lock:
                    slot = self.backend.handles[role]
                    row['acquisition'] = slot.original_call
                    row['state'] = slot.state
            _need(row['state'] == 'OPEN', 'EXTRA_OPEN')

    def publish_prefix(self):
        with self.lock:
            ticket = self.capture.begin_prefix()
            payload = ticket.bytes_for_port
            _need(self.extras['archive']['state'] == 'OPEN', 'ARCHIVE_OPEN')
        call, written = self.backend.write_role('archive', payload)
        with self.lock:
            status = ('UNRESOLVED' if written is None else 'COMMITTED' if
                      call.raw and written == len(payload) else 'FAILED')
            exported = self.capture.finish_frame(ticket, status, written)
            if status != 'COMMITTED':
                self._record_abort('ARCHIVE_WRITE', call.exception or
                                   RuntimeError('ARCHIVE_WRITE_NOT_COMMITTED'), call)
            return exported

    def freeze_and_publish_index(self):
        with self.lock:
            try:
                ticket = self.capture.freeze_writers()
            except BaseException as error:
                self._record_abort('WRITER_FREEZE', error)
                raise
            self.events.append('WRITERS_FROZEN')
        if ticket is not None:
            call, n = self.backend.write_role('index', ticket._fields['bytes'])
            with self.lock:
                self.capture.finish_index_write(ticket,
                    'UNRESOLVED' if n is None else 'COMMITTED' if
                    call.raw and n == len(ticket._fields['bytes']) else 'FAILED', n)
                if n is None or n != len(ticket._fields['bytes']):
                    self._record_abort('INDEX_WRITE', call.exception or
                                       RuntimeError('INDEX_WRITE_NOT_COMMITTED'), call)
                else:
                    self.events.append('INDEX_PUBLISHED')

    def stage_final(self):
        electron = self.capture._binding['edge'] == 'electron'
        with self.lock:
            _need(not self.capture._aborted and self.prefinal_abort is None and
                  not self.final_started and self.capture._frozen and
                  self.final_ticket is None, 'FINAL_AFTER_FREEZE_ONCE')
            self.final_started = True
        try:
            try:
                maxima = self.backend.final_sizes(electron)
            except BaseException as error:
                with self.lock:
                    self._record_abort('FINAL_METADATA', error)
                raise
            resources = tuple(self.backend.handles[self.backend._name(r)] if
                              electron or i < 2 else None for i,r in enumerate(_ROLES))
            with self.lock:
                ticket = self.capture.begin_final_readback(maxima, resources)
                self.final_ticket = ticket
                self.events.append('FINAL_RESERVED')
                self.capture.final_read_started(ticket)
            rows = self.backend.final_read(maxima, resources)
            with self.lock:
                self.capture.stage_final_readback(ticket, rows)
                self.events.append('FINAL_STAGED')
            return ticket
        except BaseException as error:
            with self.lock:
                if self.prefinal_abort is None:
                    self._record_abort('FINAL_FINISH', error)
            raise

    def close_staged_sink(self, channel):
        with self.lock:
            _need(channel in self.readers and self.readers[channel].native_signaled,
                  'ORIGINAL_READER_SIGNALED')
            self.capture.staged_close_allowed(self.final_ticket)
            ct = self.capture.request_sink_close(channel)
            ticket = self.owner.begin_capture_sink_close(ct, self.final_ticket)
        call = self.backend.close_handle(channel + '.sink')
        with self.lock:
            self.owner.finish_capture_sink_close(ticket, _closed(call))
            self.events.append('CLOSE:' + channel)
        return call

    def close_staged_extra(self, role):
        with self.lock:
            _need(self.capture._binding['edge'] == 'electron' and role in self.extras,
                  'ELECTRON_CLOSE_ROLE')
            if self.final_ticket is None:
                _need(self.prefinal_abort is not None and self.capture._aborted,
                      'ADVERSE_PREFINAL_ONLY')
                _need(not self.capture._pending and not self.capture._exports,
                      'PREFINAL_CAPTURE_EFFECTS_PENDING')
            else:
                self.capture.staged_close_allowed(self.final_ticket)
            self.backend.require_file_quiescence(role)
            row = self.extras[role]
            _need(row['state'] == 'OPEN' and row['close'] is None and
                  row['resource'] is self.backend.handles[role], 'EXTRA_CLOSE_ONCE')
            row['state'] = 'CLOSE_PENDING'
        call = self.backend.close_handle(role)
        with self.lock:
            row['close'] = call  # delivered effect retained before capture ack
            row['state'] = _closed(call)
            if role == 'archive':
                if self.capture._discovery == 'OPEN' and self.prefinal_abort is not None:
                    self.capture.finish_discovery('FAILED')
                self.capture.observe_archive_closed(row['state'])
            if row['state'] != 'CLOSED':
                self.capture._failure('EXTRA_CLOSE:' + role + ':' + row['state'])
            self.events.append('CLOSE:' + role)
        return call

    def seal_final(self):
        with self.lock:
            _need(self.final_ticket is not None, 'ORIGINAL_FINAL')
            if self.capture._binding['edge'] == 'electron':
                _need(all(row['state'] in ('CLOSED','FAILED') for row in self.extras.values()),
                      'EXTRA_CLOSE_UNRESOLVED')
            _need(all(r['sink'] in ('CLOSED','FAILED') for r in self.capture._channels.values()),
                  'SINK_CLOSE_UNRESOLVED')
            result = self.capture.seal_staged_capture(self.final_ticket)
            self.events.append('FINAL_CONSUMED')
            return result

    def begin_accounting(self):
        with self.lock:
            _need(self.accounting is None, 'ACCOUNTING_ONCE')
            ticket = self.owner.begin_job_accounting()
            self.accounting = dict(ticket=ticket, rows=[], last=-1, complete=False)
            return ticket

    def poll_accounting(self, ticket, now_ms):
        with self.lock:
            a = self.accounting
            _need(a is not None and ticket is a['ticket'] and not a['complete'] and
                  type(now_ms) is int and a['last'] <= now_ms < self.owner._deadline_ms,
                  'ACCOUNTING_ORIGINAL_DEADLINE')
            a['last'] = now_ms
        call, active = self.backend.account_detached()
        with self.lock:
            # Immutable primitive active copied before another query can mutate
            # the backend's shared native output structure.
            a['rows'].append(dict(now=now_ms, call=call, active=active))
            outcome = 'UNRESOLVED' if call.state != 'RETURNED' else 'OBSERVED' if call.raw else 'FAILED'
            if outcome != 'OBSERVED' or active == 0:
                a['complete'] = True
                self.owner.finish_job_accounting(ticket, outcome, active)
            return active

    def expire_accounting(self, ticket, now_ms):
        with self.lock:
            a = self.accounting
            _need(a is not None and ticket is a['ticket'] and not a['complete'] and
                  type(now_ms) is int and now_ms >= self.owner._deadline_ms and
                  now_ms >= a['last'], 'ACCOUNTING_EXPIRED')
            a['complete'] = True
            # Retain the last nonempty row, but never report observed emptiness.
            self.owner.finish_job_accounting(ticket, 'FAILED', None)

    def finish_record(self):
        with self.lock:
            t = self.final_ticket
            _need(t is not None and t._fields['rows'] is not None, 'STAGED_RECORD')
            f = t._fields
            roles = []
            for i, row in enumerate(f['rows']):
                role = row['role']
                closure = (self.capture._channels[role]['sink'] if i < 2 else
                           self.extras[role]['state'] if row['resource'] is not None else
                           'NOT_APPLICABLE')
                roles.append(dict(role=role, applicable=row['resource'] is not None,
                                  resourceId=None if row['resource'] is None else
                                  self.backend._name(role), reservationIndex=i,
                                  maximum=f['maxima'][i], bytes=len(row['body']),
                                  sha256=C0.hashlib.sha256(row['body']).hexdigest(),
                                  consumed=row['consumed'], complete=row['complete'],
                                  quiescent=not any(c in f['active_calls'] for c in row['calls']),
                                  calls=[dict(label=c.label,state=c.state) for c in row['calls']],
                                  closure=closure))
            capture = self.capture.view()
            return dict(schema=1,kind='INERT_CAPTURE_FINISH_V1',binding=capture['binding'],
                        ticketId='original-final-readback',reservationId='original-final-reservation',
                        phase=f['phase'],roles=roles,events=list(self.events),capture=capture,
                        captureCharges=[charge for reservation in self.capture._reservations
                                        for charge in reservation.charges],
                        streamOccurrences=[dict(chargeIndex=i,channel=reservation.channel)
                            for i,(reservation,charge) in enumerate(
                                (reservation,charge) for reservation in self.capture._reservations
                                for charge in reservation.charges)
                            if charge is not None and charge[0] in ('READ','APPEND')],
                        physicalCapture=False,nativeEligibility=False,wholeAttempt=False)

    def close_sink(self, channel):
        # Check before either owner/capture close transition: refusal must not
        # strand a CLOSE ticket for an effect that has not been attempted.
        with self.lock:
            self.backend.require_file_quiescence(channel)
            unstarted=not self.readers[channel].native_signaled and self.prefinal_abort is not None
        if unstarted:
            with self.lock:token=self.seal_no_reader_start_cleanup()
            return self.close_unstarted_sink(channel,token)
        return super().close_sink(channel)

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
                    n=count.value if written.state=='RETURNED' and written.raw else None
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

    def _record_abort(self, phase, error, call=None):
        _need(isinstance(error, BaseException), 'ACTUAL_PREFINAL_ERROR')
        if self.prefinal_abort is None:
            self.prefinal_abort = dict(phase=phase, error=error, call=call,
                resources=tuple((role,self.backend.handles[self.backend._name(role)])
                                for role in _ROLES))
        self.capture.freeze_for_abort(error)
        self.owner.bookkeeping_failed(error)

    def seal_no_reader_start_cleanup(self):
        _need(self.prefinal_abort is not None and self.capture._aborted,
              'ACTUAL_INITIAL_ABORT')
        self.backend.reader_creation_barred=True
        attempts=self.backend.require_reader_absence(self.owner)
        _need(all(not r.armed and not r.callback_returned and not r.native_signaled and
                  r.read_ticket is None for r in self.readers.values()), 'NO_READER_EXECUTION')
        if self.no_reader_cleanup is not None:
            self._validate_no_reader_token(self.no_reader_cleanup)
            return self.no_reader_cleanup
        resources=tuple((name,self.backend.handles[name]) for ch in ('stdout','stderr')
                        for name in (ch+'.sink',ch+'.read',ch+'.readerThread'))
        token=C._NoReaderCleanup(self,attempts,resources)
        self.capture.bind_no_reader_cleanup(token)
        self.no_reader_cleanup=token
        self.backend.reader_absence_sealed=True
        return token

    def _validate_no_reader_token(self, token):
        _need(type(token) is C._NoReaderCleanup and token is self.no_reader_cleanup and
              token.coordinator is self and token.capture is self.capture and
              token.owner is self.owner and token.backend is self.backend,
              'EXACT_EDGE_ABSENCE_TOKEN')
        attempts=self.backend.require_reader_absence(self.owner)
        _need(all(a is b for a,b in zip(attempts,token.attempts)) and
              all(self.backend.handles[n] is r for n,r in token.resources),
              'ORIGINAL_ABSENCE_RESOURCES')
        self.capture.require_no_reader_cleanup(token)

    def close_unstarted_sink(self, channel, token):
        with self.lock:
            _need(channel in self.readers,'CHANNEL')
            self._validate_no_reader_token(token)
            self.backend.require_file_quiescence(channel)
            name=channel+'.sink'
            self.owner._open(name);self.owner._idle(name)
            _need(self.owner._slots[name].value is dict(token.resources)[name] and
                  self.backend.handles[name].state=='OPEN','ORIGINAL_UNSTARTED_SINK')
            ct=self.capture.request_unstarted_sink_close(channel,token)
            ticket=self.owner.begin_capture_sink_close(ct,no_reader_cleanup=token)
        call=self.backend.close_handle(name)
        with self.lock:
            self._absorb_backend_failure()
            self.owner.finish_capture_sink_close(ticket,_closed(call))
        return call

    def close_resource(self, name):
        # Fence before the owner changes OPEN to CLOSE_PENDING. The backend
        # checks again at the original CloseHandle dispatch boundary.
        with self.lock:
            if name in self.backend.handles:
                self.backend.require_resource_quiescence(name)
        if name not in ('stdout.read','stderr.read') or self.prefinal_abort is None:
            return super().close_resource(name)
        channel=name.split('.')[0]
        if self.readers[channel].native_signaled:return super().close_resource(name)
        with self.lock:
            token=self.seal_no_reader_start_cleanup()
            self._validate_no_reader_token(token)
            _need(self.backend.handles[name].state=='OPEN','ORIGINAL_UNSTARTED_READ')
            self.backend.require_resource_quiescence(name)
            ticket=self.owner.begin_unstarted_read_close(name,token)
        call=self.backend.close_handle(name)
        with self.lock:
            self._absorb_backend_failure()
            self.owner.finish_close(ticket,_closed(call))
        return call
