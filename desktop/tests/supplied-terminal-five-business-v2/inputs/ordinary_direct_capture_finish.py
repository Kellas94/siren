"""Private staged final-read continuation over the preserved capture core.

C0 is injected from a separately frozen source closure. No effects or imports
of native libraries occur here. Caller serialization is still required.
"""
import ordinary_direct_capture_core as C0
_Budget = C0._Budget
_ROLES = ('stdout', 'stderr', 'archive', 'index')

def _need(ok, code):
    if ok is not True:
        raise ValueError('CAPTURE_FINISH:' + code)

class _NoReaderCleanup:
    def __init__(self, coordinator, attempts, resources):
        self.coordinator=coordinator
        self.capture=coordinator.capture;self.owner=coordinator.owner
        self.backend=coordinator.backend
        self.attempts=attempts;self.resources=resources

class _Capture(C0._Capture):
    def __init__(self, binding, budget):
        super().__init__(binding, budget)
        self._frozen = False
        self._aborted = False
        self._final = None
        self._index_write = None
        self._no_reader_cleanup = None

    def _writer(self):
        _need(not self._frozen, 'WRITERS_FROZEN')

    def begin_read(self, *args, **kwargs):
        self._writer()
        return super().begin_read(*args, **kwargs)

    def begin_prefix(self):
        self._writer()
        return super().begin_prefix()

    def request_cancel(self, *args, **kwargs):
        if not self._aborted:
            self._writer()
        return super().request_cancel(*args, **kwargs)

    def index_bytes(self):
        self._writer()
        return super().index_bytes()

    def freeze_writers(self):
        self._live()
        _need(not self._frozen and not self._pending and not self._exports,
              'QUIESCENT_WRITERS')
        _need(all(r['reader'] == 'TERMINATED' and r['sink'] == 'OPEN'
                  for r in self._channels.values()), 'READERS_TERMINATED')
        _need(self._discovery != 'OPEN', 'DISCOVERY_ENDED')
        raw = super().index_bytes() if self._binding['edge'] == 'electron' else b''
        self._frozen = True
        if raw:
            # Physical publication is another occurrence, separately charged
            # from INDEX generation, using the existing write operation kind.
            reservation = self._reserve((('ARCHIVE_WRITE', len(raw)),))
            self._index_write = self._new('INDEX_WRITE', bytes=raw,
                                          reservation=reservation, outcome=None)
        return self._index_write

    def finish_index_write(self, ticket, outcome, written):
        fields, unused = self._take(ticket, 'INDEX_WRITE')
        _need(ticket is self._index_write and fields['outcome'] is None,
              'ORIGINAL_INDEX_WRITE')
        _need(outcome in ('COMMITTED', 'FAILED', 'UNRESOLVED') and
              (written is None or (type(written) is int and
               0 <= written <= len(fields['bytes']))), 'INDEX_WRITE_OUTCOME')
        _need((outcome == 'UNRESOLVED') == (written is None) and
              (outcome != 'COMMITTED' or written == len(fields['bytes'])),
              'INDEX_WRITE_AVAILABILITY')
        fields['outcome'] = outcome
        self._budget.settle(fields['reservation'], 0, written)
        self._done(ticket)
        if outcome != 'COMMITTED':
            self._failure('INDEX_WRITE_' + outcome)

    def begin_final_readback(self, maxima, resources):
        _need(not self._aborted and self._frozen and self._final is None and not self._pending and
              not self._exports, 'FINAL_BEGIN')
        _need(type(resources) is tuple and len(resources) == 4, 'ROLE_RESOURCES')
        electron = self._binding['edge'] == 'electron'
        _need(all(r is not None for r in resources[:2]) and
              (all(r is not None for r in resources[2:]) if electron else
               resources[2:] == (None, None)), 'FIXED_ROLES')
        actual = resources if electron else resources[:2]
        _need(len({id(r) for r in actual}) == len(actual), 'DISTINCT_RESOURCES')
        if electron:
            _need(self._index_write is not None and
                  self._index_write._fields['outcome'] == 'COMMITTED',
                  'INDEX_PUBLICATION')
        ticket = super().begin_seal(maxima)
        ticket._fields.update(phase='RESERVED', resources=resources, rows=None,
                              active_calls=(), settled=False)
        self._final = ticket
        return ticket

    def final_read_started(self, ticket):
        fields, unused = self._take(ticket, 'READBACK')
        _need(ticket is self._final and fields['phase'] == 'RESERVED',
              'READ_START_ONCE')
        fields['phase'] = 'READING'

    def stage_final_readback(self, ticket, rows):
        fields, unused = self._take(ticket, 'READBACK')
        _need(ticket is self._final and fields['phase'] == 'READING' and
              fields['rows'] is None, 'STAGE_ONCE')
        _need(type(rows) is tuple and len(rows) == 4, 'STAGED_ROLES')
        staged = []
        active = []
        for i, (role, resource, maximum, row) in enumerate(zip(
                _ROLES, fields['resources'], fields['maxima'], rows)):
            _need(type(row) is dict and set(row) ==
                  {'role','resource','body','consumed','complete','quiescent','calls'},
                  'STAGED_KEYS')
            _need(row['role'] == role and row['resource'] is resource and
                  type(row['body']) is bytes and len(row['body']) <= maximum and
                  type(row['complete']) is bool and type(row['quiescent']) is bool and
                  type(row['calls']) is tuple, 'STAGED_IDENTITY')
            n = row['consumed']
            _need(n is None or (type(n) is int and len(row['body']) <= n <= maximum),
                  'STAGED_CONSUMPTION')
            if resource is None:
                _need(row['body'] == b'' and n == 0 and row['complete'] and
                      row['quiescent'] and not row['calls'], 'INAPPLICABLE_ROLE')
            else:
                _need(len(row['calls']) > 0 and len({id(c) for c in row['calls']}) ==
                      len(row['calls']), 'ORIGINAL_CALL_ROSTER')
            if not row['quiescent']:
                _need(n is None and not row['complete'], 'ACTIVE_EFFECT_UNKNOWN')
                active.extend(c for c in row['calls'] if c.state != 'RETURNED')
                _need(bool(active), 'ACTIVE_ORIGINAL_CALL')
            if row['complete']:
                _need(row['quiescent'] and n == len(row['body']) == maximum, 'COMPLETE_BYTES')
            staged.append(dict(row))  # bytes immutable; no caller dict aliases.
        # Validation completes before any irreversible budget settlement.
        fields['rows'] = tuple(staged)
        fields['active_calls'] = tuple(active)
        for i, row in enumerate(staged):
            self._budget.settle(fields['reservation'], i, row['consumed'])
        fields['settled'] = True
        fields['phase'] = ('UNRESOLVED' if active else 'STAGED_QUIESCENT' if
                           all(r['complete'] for r in staged) else 'FAILED_QUIESCENT')
        if fields['phase'] != 'STAGED_QUIESCENT':
            self._failure('FINAL_READ_' + fields['phase'])

    def observe_final_call_quiescence(self, ticket, original_call):
        fields, unused = self._take(ticket, 'READBACK')
        _need(ticket is self._final and fields['phase'] == 'UNRESOLVED' and
              original_call in fields['active_calls'] and
              original_call.state == 'QUIESCENT_UNKNOWN', 'ORIGINAL_QUIESCENCE')
        fields['active_calls'] = tuple(c for c in fields['active_calls']
                                       if c is not original_call)
        if not fields['active_calls']:
            fields['phase'] = 'FAILED_QUIESCENT'
        # No effect reinterpretation or refund, even after call quiescence.

    def staged_close_allowed(self, ticket, close_ticket=None):
        fields, unused = self._take(ticket, 'READBACK')
        expected = {ticket} if close_ticket is None else {ticket, close_ticket}
        _need(ticket is self._final and fields['phase'] in
              ('STAGED_QUIESCENT', 'FAILED_QUIESCENT') and fields['settled'] and
              not fields['active_calls'] and self._pending == expected and
              not self._exports, 'EXACT_QUIESCENT_CONTINUATION')
        return True

    def seal_staged_capture(self, ticket):
        self.staged_close_allowed(ticket)
        fields = ticket._fields
        bodies = tuple(r['body'] for r in fields['rows'])
        self._done(ticket)
        fields['phase'] = 'CONSUMED'
        try:
            for i, name in enumerate(('stdout','stderr')):
                r = self._channels[name]
                C0._need(bodies[i] == bytes(r['physical']), 'STREAM_READBACK')
                if (r['reader'] != 'TERMINATED' or r['termination'] != 'EOF_REPORTED' or
                    r['sink'] != 'CLOSED' or r['overflow'] or r['unknown'] or
                    r['observed'] != len(r['committed']) or r['physical'] != r['committed']):
                    self._failure(name + ':INCOMPLETE')
            if self._binding['edge'] == 'electron':
                C0._need(self._archive_close == 'CLOSED', 'DISCOVERY_UNCLOSED')
                C0._need(C0._equal(C0._read_index(bodies[3]), self._index()), 'INDEX_READBACK')
                C0._need(len(bodies[2]) == self._archive_size and
                         C0.hashlib.sha256(bodies[2]).hexdigest() ==
                         self._archive_hash.hexdigest(), 'ARCHIVE_READBACK')
                C0._frames(bodies[2], self._observations, bodies[1])
            if (not self._budget._settled(self._reservations) or self._budget._uncertain or
                self._budget._refused):
                self._failure('BUDGET_INCOMPLETE')
            self._state = 'SEALED_ADVERSE' if self._failures else 'SEALED_COMPLETE'
            return self.view()
        except BaseException as error:
            self._failure('SEAL_REFUSED', error)
            self._state = 'SEALED_ADVERSE'
            raise

    def begin_seal(self, maxima):
        _need(not self._frozen, 'USE_STAGED_FINAL')
        return super().begin_seal(maxima)

    def seal_capture(self, *args, **kwargs):
        _need(not self._frozen, 'USE_STAGED_FINAL')
        return super().seal_capture(*args, **kwargs)

    def freeze_for_abort(self, error):
        self._live()
        _need(isinstance(error, BaseException), 'ACTUAL_ABORT_ERROR')
        self._aborted = True
        self._frozen = True
        self._failure('FINISH_ABORT', error)
        # Cancellation and original reader waits remain available. Existing
        # operations still require acknowledgements; no effect becomes known.

    def bind_no_reader_cleanup(self, token):
        self._live()
        _need(type(token) is _NoReaderCleanup and token.capture is self and
              token.owner._capture is self and self._no_reader_cleanup is None and
              self._aborted and self._frozen, 'ORIGINAL_ABORT_ABSENCE_TOKEN')
        _need(not self._pending and not self._exports and not self._reservations and
              not self._observations and self._archive_size==0 and
              self._final is None and self._index_write is None, 'NO_CAPTURE_HISTORY')
        _need(all(r['reader']=='RUNNING' and r['termination']=='NONE' and
                  r['cancel']=='NOT_REQUESTED' and not r['observed'] and
                  not r['physical'] and not r['committed'] and not r['generation']
                  for r in self._channels.values()), 'NO_READER_HISTORY')
        self._no_reader_cleanup=token
        for row in self._channels.values():row['reader']='NOT_STARTED'

    def require_no_reader_cleanup(self, token):
        _need(type(token) is _NoReaderCleanup and token is self._no_reader_cleanup and
              token.capture is self and token.owner._capture is self and
              token.coordinator.no_reader_cleanup is token and self._aborted and
              self._frozen and not self._pending and not self._exports and
              all(r['reader']=='NOT_STARTED' and r['termination']=='NONE' and
                  r['cancel']=='NOT_REQUESTED' for r in self._channels.values()),
              'BOUND_NO_READER_CLEANUP')

    def request_unstarted_sink_close(self, channel, token):
        self.require_no_reader_cleanup(token)
        row=self._channel(channel)
        _need(row['sink']=='OPEN', 'UNSTARTED_SINK_OPEN_ONCE')
        row['sink']='CLOSE_REQUESTED'
        return self._new('CLOSE',channel)
