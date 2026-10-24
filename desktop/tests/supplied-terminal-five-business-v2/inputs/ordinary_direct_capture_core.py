"""Private ticket-based supplied-outcome model; no filesystem/process/native IO.

All methods require the future owner's serialized transition authority. There
are no external callbacks, native thread operations or implicit lock claims.
"""
import hashlib
import json

_STREAM_MAX = 1048576
_ARCHIVE_MAX = 4194304
_METADATA_MAX = 262144
_AGGREGATE_MAX = 16777216
_UINT64_MAX = (1 << 64) - 1
_CHANNELS = ('stdout', 'stderr')
_EDGES = ('owner', 'outer', 'inner', 'electron', 'ui')
_OPS = ('READ', 'APPEND', 'SNAPSHOT', 'FRAME', 'ARCHIVE_WRITE', 'EXPORT_BYTES',
        'EXPORT_TOKEN', 'CONSUMER_BYTES', 'CONSUMER_TOKEN', 'INDEX', 'FINAL_READ')


def _need(ok, code):
    if ok is not True:
        raise ValueError('CAPTURE_V2:' + code)


def _uint(n):
    return type(n) is int and 0 <= n <= _UINT64_MAX


def _hex(s, n):
    return type(s) is str and len(s) == n and all(c in '0123456789abcdef' for c in s)


def _encoded(value):
    return json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii') + b'\n'


def _copy(value):
    if type(value) is dict:
        return {k: _copy(v) for k, v in value.items()}
    if type(value) is list:
        return [_copy(v) for v in value]
    return value


def _equal(a, b):
    if type(a) is not type(b):
        return False
    if type(a) is dict:
        return set(a) == set(b) and all(_equal(a[k], b[k]) for k in a)
    if type(a) is list:
        return len(a) == len(b) and all(_equal(x, y) for x, y in zip(a, b))
    return a == b


class _Reservation:
    pass


class _Budget:
    def __init__(self):
        self._spent = 0
        self._held = 0
        self._pending = {}
        self._rows = []
        self._refused = False
        self._uncertain = False

    def reserve(self, rows):
        _need(type(rows) is tuple and len(rows) > 0, 'RESERVE_ROWS')
        _need(all(type(r) is tuple and len(r) == 2 and type(r[0]) is str and
                  r[0] in _OPS and _uint(r[1]) for r in rows), 'RESERVE_ROW')
        total = sum(r[1] for r in rows)
        if self._refused or self._uncertain or total > _AGGREGATE_MAX - self._spent - self._held:
            self._refused = True
            raise ValueError('CAPTURE_V2:AGGREGATE_REFUSED')
        ticket = _Reservation()
        ticket.charges = [None] * len(rows)
        self._pending[ticket] = list(rows)
        self._held += total
        return ticket

    def settle(self, ticket, index, actual):
        _need(type(ticket) is _Reservation and ticket in self._pending and
              type(index) is int and 0 <= index < len(self._pending[ticket]), 'RESERVATION_ID')
        rows = self._pending[ticket]
        row = rows[index]
        _need(type(row) is tuple, 'RESERVATION_REUSED')
        operation, maximum = row
        if not (actual is None or (_uint(actual) and actual <= maximum)):
            self._uncertain = True
            raise ValueError('CAPTURE_V2:RESERVATION_ACTUAL')
        # A None effect remains a held uncertainty, never an inferred zero.
        if actual is None:
            self._uncertain = True
            rows[index] = 'UNKNOWN'
        else:
            self._spent += actual
            self._held -= maximum
            rows[index] = 'SETTLED'
        ticket.charges[index] = (operation, maximum, actual, None if actual is None else maximum - actual)
        self._rows.append((operation, maximum, actual,
                           None if actual is None else maximum - actual))

    def view(self):
        return dict(spent=self._spent, held=self._held, refused=self._refused,
                    uncertain=self._uncertain, rows=list(self._rows), wholeAttempt=False)

    def _settled(self, tickets):
        return all(t in self._pending and all(row == 'SETTLED' for row in self._pending[t])
                   for t in tickets)


class _Operation:
    def __init__(self, owner, kind, channel=None, **fields):
        self._owner, self._kind, self._channel = owner, kind, channel
        self._fields = fields

    @property
    def bytes_for_port(self):
        _need(self._kind in ('APPEND', 'FRAME'), 'PORT_BYTES_KIND')
        return self._fields['bytes']


class _Export:
    def __init__(self, owner, binding, observation, payload, reservation):
        self._owner = owner
        self._binding = _copy(binding)
        self._observation = _copy(observation)
        self._payload = payload
        self._reservation = reservation
        self._viewed = False

    def view(self):
        self._owner._consume_export(self)
        return dict(binding=_copy(self._binding), observation=_copy(self._observation),
                    bytes=self._payload)


def _ack(method):
    def guarded(self, *args, **kwargs):
        try:
            return method(self, *args, **kwargs)
        except BaseException as error:
            if self._state not in ('SEALED_COMPLETE', 'SEALED_ADVERSE'):
                self._budget._uncertain = True
                self._failure('ACK_REFUSED', error)
            raise
    return guarded


def _binding(value):
    _need(type(value) is dict and set(value) ==
          {'attemptId', 'edge', 'headerSha256', 'creationInvocationId'}, 'BINDING_KEYS')
    _need(_hex(value['attemptId'], 32) and type(value['edge']) is str and
          value['edge'] in _EDGES and _hex(value['headerSha256'], 64) and
          _hex(value['creationInvocationId'], 32), 'BINDING_VALUE')
    return _copy(value)


def _read_index(raw):
    _need(type(raw) is bytes and 1 <= len(raw) <= _METADATA_MAX and
          not raw.startswith(b'\xef\xbb\xbf'), 'INDEX_BYTES')
    def pairs(rows):
        value = {}
        for k, v in rows:
            _need(k not in value, 'INDEX_DUPLICATE')
            value[k] = v
        return value
    return json.loads(raw.decode('utf8', 'strict'), object_pairs_hook=pairs)


def _frames(raw, observations, final_stderr):
    _need(type(raw) is bytes and len(raw) <= _ARCHIVE_MAX and
          type(observations) is list and type(final_stderr) is bytes, 'FRAME_INPUT')
    offset = 0
    previous_generation = 0
    previous_observed = 0
    keys = {'ordinal', 'generation', 'offset', 'length', 'sha256',
            'observedBytesAtSnapshot', 'retainedPrefixBytes',
            'readerStateAtSnapshot', 'eofSeenAtSnapshot', 'consumerPhase'}
    for ordinal, token in enumerate(observations, 1):
        _need(type(token) is dict and set(token) == keys, 'FRAME_TOKEN_KEYS')
        _need(all(_uint(token[k]) for k in
                  ('ordinal', 'generation', 'offset', 'length',
                   'observedBytesAtSnapshot', 'retainedPrefixBytes')), 'FRAME_TOKEN_INTS')
        n = token['length']
        _need(token['ordinal'] == ordinal and token['offset'] == offset and
              n <= _STREAM_MAX and token['retainedPrefixBytes'] == n and
              token['observedBytesAtSnapshot'] >= max(n, previous_observed) and
              token['generation'] >= previous_generation, 'FRAME_TOKEN_COUNTERS')
        _need(_hex(token['sha256'], 64) and token['consumerPhase'] == 'ENDPOINT_DISCOVERY' and
              type(token['readerStateAtSnapshot']) is str and
              token['readerStateAtSnapshot'] in ('RUNNING', 'TERMINATED') and
              type(token['eofSeenAtSnapshot']) is bool, 'FRAME_TOKEN_VALUE')
        _need(offset + 48 + n <= len(raw), 'FRAME_TRUNCATED')
        header = raw[offset:offset + 48]
        payload = raw[offset + 48:offset + 48 + n]
        digest = hashlib.sha256(payload)
        _need(int.from_bytes(header[:8], 'big') == ordinal and
              int.from_bytes(header[8:16], 'big') == n and
              header[16:] == digest.digest() and token['sha256'] == digest.hexdigest(), 'FRAME_CONTENT')
        _need(n <= len(final_stderr) and payload == final_stderr[:n], 'FRAME_FINAL_JOIN')
        offset += 48 + n
        previous_generation = token['generation']
        previous_observed = token['observedBytesAtSnapshot']
    _need(offset == len(raw), 'FRAME_TRAILING')


class _Capture:
    def __init__(self, binding, budget):
        self._binding = _binding(binding)
        _need(type(budget) is _Budget, 'BUDGET_TYPE')
        self._budget = budget
        self._reservations = []
        self._pending = set()
        self._exports = set()
        self._failures = []
        self._first_exception = None
        self._state = 'ACTIVE'
        self._channels = {name: dict(physical=bytearray(), committed=bytearray(),
                                     observed=0, generation=0, unknown=False,
                                     reader='RUNNING', termination='NONE',
                                     cancel='NOT_REQUESTED', sink='OPEN', overflow=False)
                          for name in _CHANNELS}
        self._observations = []
        self._archive_size = 0
        self._archive_hash = hashlib.sha256()
        self._archive_close = 'NOT_ATTEMPTED'
        self._discovery = 'OPEN' if binding['edge'] == 'electron' else 'NOT_APPLICABLE'

    def _failure(self, code, error=None):
        if self._state == 'ACTIVE':
            self._state = 'STOPPING'
        self._failures.append(code)
        if self._first_exception is None and error is not None:
            self._first_exception = error

    def _live(self, active=False):
        _need(self._state not in ('SEALED_COMPLETE', 'SEALED_ADVERSE'), 'SEALED')
        if active:
            _need(self._state == 'ACTIVE', 'NOT_ACTIVE')

    def _channel(self, channel):
        _need(type(channel) is str and channel in _CHANNELS, 'CHANNEL')
        return self._channels[channel]

    def _new(self, kind, channel=None, **fields):
        operation = _Operation(self, kind, channel, **fields)
        self._pending.add(operation)
        return operation

    def _take(self, ticket, kind):
        self._live()
        if not (type(ticket) is _Operation and ticket._owner is self and
                ticket in self._pending and ticket._kind == kind):
            self._failure('TICKET_REFUSED')
            raise ValueError('CAPTURE_V2:TICKET_REFUSED')
        return ticket._fields, self._channels.get(ticket._channel)

    def _done(self, ticket):
        self._pending.remove(ticket)

    def _reserve(self, rows, channel=None):
        try:
            reservation = self._budget.reserve(rows)
            reservation.channel = channel
            self._reservations.append(reservation)
            return reservation
        except BaseException as error:
            self._failure('BUDGET_REFUSED', error)
            raise

    def _available(self, channel, kinds):
        _need(not any(t._channel == channel and t._kind in kinds for t in self._pending),
              'CHANNEL_PENDING')

    def begin_read(self, channel, requested_maximum=65536):
        self._live(active=True)
        row = self._channel(channel)
        _need(type(requested_maximum) is int and 1 <= requested_maximum <= 65536 and
              row['reader'] == 'RUNNING' and row['termination'] == 'NONE' and
              row['sink'] == 'OPEN', 'READ_BEGIN')
        self._available(channel, ('READ', 'APPEND'))
        reservation = self._reserve((('READ', requested_maximum),), channel=channel)
        return self._new('READ', channel, maximum=requested_maximum, reservation=reservation)

    @_ack
    def finish_read(self, ticket, outcome, data=b'', error=None):
        fields, row = self._take(ticket, 'READ')
        _need(type(outcome) is str and outcome in ('DATA', 'EOF', 'ERROR', 'CANCELLED', 'UNKNOWN') and
              type(data) is bytes and len(data) <= fields['maximum'], 'READ_OUTCOME')
        _need((outcome == 'DATA' and len(data) > 0) or
              (outcome != 'DATA' and data == b''), 'READ_VARIANT')
        self._done(ticket)
        self._budget.settle(fields['reservation'], 0, None if outcome == 'UNKNOWN' else len(data))
        if outcome != 'DATA':
            row['termination'] = {'EOF':'EOF_REPORTED', 'ERROR':'ERROR',
                                  'CANCELLED':'CANCELLED', 'UNKNOWN':'UNKNOWN'}[outcome]
            if outcome != 'EOF':
                row['unknown'] = outcome == 'UNKNOWN'
                self._failure('READ_' + outcome, error)
            return None
        row['observed'] += len(data)
        room = _STREAM_MAX - len(row['physical'])
        kept = min(room, len(data))
        if kept < len(data):
            row['overflow'] = True
            self._failure('STREAM_OVERFLOW')
        reservation = self._reserve((('APPEND', kept),), channel=ticket._channel)
        return self._new('APPEND', ticket._channel, bytes=data[:kept], reservation=reservation)

    @_ack
    def finish_append(self, ticket, outcome, written, error=None):
        fields, row = self._take(ticket, 'APPEND')
        payload = fields['bytes']
        _need(type(outcome) is str and outcome in ('COMMITTED', 'FAILED', 'UNRESOLVED') and
              (written is None or (_uint(written) and written <= len(payload))), 'APPEND_OUTCOME')
        _need((outcome == 'UNRESOLVED') == (written is None), 'APPEND_AVAILABILITY')
        _need(outcome != 'COMMITTED' or written == len(payload), 'APPEND_SHORT_SUCCESS')
        self._done(ticket)
        self._budget.settle(fields['reservation'], 0, written)
        if written is None:
            row['unknown'] = True
        else:
            row['physical'].extend(payload[:written])
        if outcome == 'COMMITTED':
            row['committed'].extend(payload)
            row['generation'] += 1
        else:
            self._failure('APPEND_' + outcome, error)

    def begin_prefix(self):
        self._live(active=True)
        _need(self._binding['edge'] == 'electron' and self._discovery == 'OPEN', 'PREFIX_PHASE')
        _need(not any(t._kind == 'FRAME' for t in self._pending), 'FRAME_PENDING')
        row = self._channels['stderr']
        n = len(row['committed'])
        if 48 + n > _ARCHIVE_MAX - self._archive_size:
            self._failure('ARCHIVE_EXHAUSTED')
            raise ValueError('CAPTURE_V2:ARCHIVE_CAP')
        token = dict(ordinal=len(self._observations)+1, generation=row['generation'],
                     offset=self._archive_size, length=n,
                     sha256=hashlib.sha256(row['committed']).hexdigest(),
                     observedBytesAtSnapshot=row['observed'], retainedPrefixBytes=n,
                     readerStateAtSnapshot=row['reader'],
                     eofSeenAtSnapshot=row['termination'] == 'EOF_REPORTED',
                     consumerPhase='ENDPOINT_DISCOVERY')
        encoded = _encoded(dict(binding=self._binding, observation=token))
        reservation = self._reserve((('SNAPSHOT', n), ('FRAME', 48+n),
                                     ('ARCHIVE_WRITE', 48+n), ('EXPORT_BYTES', n),
                                     ('EXPORT_TOKEN', len(encoded)), ('CONSUMER_BYTES', n),
                                     ('CONSUMER_TOKEN', len(encoded))))
        payload = bytes(row['committed'])
        frame = (token['ordinal'].to_bytes(8, 'big') + n.to_bytes(8, 'big') +
                 bytes.fromhex(token['sha256']) + payload)
        self._budget.settle(reservation, 0, n)
        self._budget.settle(reservation, 1, len(frame))
        return self._new('FRAME', 'stderr', bytes=frame, payload=payload,
                         token=token, tokenBytes=len(encoded), reservation=reservation)

    @_ack
    def finish_frame(self, ticket, outcome, written, error=None):
        fields, row = self._take(ticket, 'FRAME')
        frame = fields['bytes']
        _need(type(outcome) is str and outcome in ('COMMITTED', 'FAILED', 'UNRESOLVED') and
              (written is None or (_uint(written) and written <= len(frame))), 'FRAME_OUTCOME')
        _need((outcome == 'UNRESOLVED') == (written is None), 'FRAME_AVAILABILITY')
        _need(outcome != 'COMMITTED' or written == len(frame), 'FRAME_SHORT_SUCCESS')
        self._done(ticket)
        reservation = fields['reservation']
        self._budget.settle(reservation, 2, written)
        if outcome != 'COMMITTED':
            self._budget.settle(reservation, 3, 0)
            self._budget.settle(reservation, 4, 0)
            self._budget.settle(reservation, 5, 0)
            self._budget.settle(reservation, 6, 0)
            self._failure('FRAME_' + outcome, error)
            return None
        self._archive_size += len(frame)
        self._archive_hash.update(frame)
        self._observations.append(_copy(fields['token']))
        self._budget.settle(reservation, 3, len(fields['payload']))
        self._budget.settle(reservation, 4, fields['tokenBytes'])
        exported = _Export(self, self._binding, fields['token'], fields['payload'], reservation)
        self._exports.add(exported)
        return exported

    @_ack
    def _consume_export(self, exported):
        self._live()
        if not (type(exported) is _Export and exported._owner is self and
                exported in self._exports and not exported._viewed):
            self._failure('EXPORT_REFUSED')
            raise ValueError('CAPTURE_V2:EXPORT_REFUSED')
        token_size = len(_encoded(dict(binding=exported._binding, observation=exported._observation)))
        self._budget.settle(exported._reservation, 5, len(exported._payload))
        self._budget.settle(exported._reservation, 6, token_size)
        exported._viewed = True

    @_ack
    def acknowledge_export(self, exported):
        self._live()
        _need(type(exported) is _Export and exported._owner is self and
              exported in self._exports and exported._viewed, 'EXPORT_REFUSED')
        self._exports.remove(exported)

    def finish_discovery(self, reason):
        self._live()
        _need(self._binding['edge'] == 'electron' and self._discovery == 'OPEN' and
              type(reason) is str and reason in ('ENDPOINT_FOUND', 'DEADLINE', 'FAILED') and
              not any(t._kind == 'FRAME' for t in self._pending), 'DISCOVERY_END')
        self._discovery = reason
        if reason != 'ENDPOINT_FOUND':
            self._failure('DISCOVERY_' + reason)

    def request_cancel(self, channel):
        self._live()
        row = self._channel(channel)
        _need(row['cancel'] == 'NOT_REQUESTED', 'CANCEL_BEGIN')
        row['cancel'] = 'REQUESTED'
        self._failure('CANCEL_REQUESTED')
        return self._new('CANCEL', channel)

    @_ack
    def finish_cancel(self, ticket, outcome, error=None):
        fields, row = self._take(ticket, 'CANCEL')
        _need(type(outcome) is str and outcome in
              ('ACCEPTED', 'REJECTED', 'FAILED', 'UNRESOLVED'), 'CANCEL_OUTCOME')
        self._done(ticket)
        row['cancel'] = outcome
        if outcome != 'ACCEPTED':
            self._failure('CANCEL_' + outcome, error)

    def observe_reader_termination(self, channel, termination=None):
        self._live()
        row = self._channel(channel)
        _need(row['reader'] == 'RUNNING', 'READER_END')
        self._available(channel, ('READ', 'APPEND'))
        if row['termination'] == 'NONE':
            _need(type(termination) is str and termination in ('ERROR', 'CANCELLED', 'UNKNOWN'),
                  'READER_TERMINATION')
            row['termination'] = termination
            row['unknown'] = row['unknown'] or termination == 'UNKNOWN'
            self._failure('READER_' + termination)
        else:
            _need(termination is None, 'READER_TERMINATION_REPLACED')
        row['reader'] = 'TERMINATED'

    def request_sink_close(self, channel):
        self._live()
        row = self._channel(channel)
        _need(row['reader'] == 'TERMINATED' and row['sink'] == 'OPEN', 'CLOSE_BEGIN')
        self._available(channel, ('READ', 'APPEND'))
        row['sink'] = 'CLOSE_REQUESTED'
        return self._new('CLOSE', channel)

    @_ack
    def finish_sink_close(self, ticket, outcome, error=None):
        fields, row = self._take(ticket, 'CLOSE')
        _need(type(outcome) is str and outcome in ('CLOSED', 'FAILED', 'UNRESOLVED'), 'CLOSE_OUTCOME')
        self._done(ticket)
        row['sink'] = outcome
        if outcome != 'CLOSED':
            self._failure('CLOSE_' + outcome, error)

    def observe_archive_closed(self, outcome):
        self._live()
        _need(self._binding['edge'] == 'electron' and self._discovery != 'OPEN' and
              self._archive_close == 'NOT_ATTEMPTED' and type(outcome) is str and
              outcome in ('CLOSED', 'FAILED', 'UNRESOLVED'), 'ARCHIVE_CLOSE')
        self._archive_close = outcome
        if outcome != 'CLOSED':
            self._failure('ARCHIVE_CLOSE_' + outcome)

    def _index(self):
        return dict(schema=1, kind='CAPTURE_CORE_INDEX_V2', binding=_copy(self._binding),
                    archiveBytes=self._archive_size, archiveSha256=self._archive_hash.hexdigest(),
                    observations=_copy(self._observations), terminationReason=self._discovery)

    def index_bytes(self):
        self._live()
        _need(self._binding['edge'] == 'electron' and self._discovery != 'OPEN' and
              not any(t._kind == 'FRAME' for t in self._pending), 'INDEX_PHASE')
        raw = _encoded(self._index())
        _need(len(raw) <= _METADATA_MAX, 'INDEX_CAP')
        reservation = self._reserve((('INDEX', len(raw)),))
        self._budget.settle(reservation, 0, len(raw))
        return raw

    def begin_seal(self, maximum_lengths):
        self._live()
        _need(type(maximum_lengths) is tuple and len(maximum_lengths) == 4 and
              all(_uint(n) and n <= cap for n,cap in
                  zip(maximum_lengths, (_STREAM_MAX,_STREAM_MAX,_ARCHIVE_MAX,_METADATA_MAX))),
              'FINAL_READ_MAXIMA')
        _need(not any(t._kind == 'READBACK' for t in self._pending), 'READBACK_PENDING')
        if self._binding['edge'] != 'electron':
            _need(maximum_lengths[2:] == (0,0), 'FINAL_READ_ROLES')
        reservation = self._reserve(tuple(('FINAL_READ', n) for n in maximum_lengths))
        return self._new('READBACK', maxima=maximum_lengths, reservation=reservation)

    def seal_capture(self, ticket, streams, archive_bytes=b'', index_bytes=b''):
        self._live()
        try:
            fields, ignored = self._take(ticket, 'READBACK')
            _need(type(streams) is dict and set(streams) == set(_CHANNELS) and
                  all(type(streams[n]) is bytes and len(streams[n]) <= _STREAM_MAX
                      for n in _CHANNELS) and type(archive_bytes) is bytes and
                  len(archive_bytes) <= _ARCHIVE_MAX and type(index_bytes) is bytes and
                  len(index_bytes) <= _METADATA_MAX, 'SEAL_INPUT')
            bodies = (streams['stdout'], streams['stderr'], archive_bytes, index_bytes)
            if not all(len(raw) <= maximum for raw,maximum in zip(bodies,fields['maxima'])):
                self._budget._uncertain = True
                raise ValueError('CAPTURE_V2:FINAL_READ_OVERRUN')
            self._done(ticket)
            for i, raw in enumerate(bodies):
                self._budget.settle(fields['reservation'], i, len(raw))
            _need(not self._pending and not self._exports, 'PENDING_AT_SEAL')
            for name in _CHANNELS:
                row = self._channels[name]
                _need(streams[name] == bytes(row['physical']), 'STREAM_READBACK')
                if (row['reader'] != 'TERMINATED' or row['termination'] != 'EOF_REPORTED' or
                    row['sink'] != 'CLOSED' or row['overflow'] or row['unknown'] or
                    row['observed'] != len(row['committed']) or
                    row['physical'] != row['committed']):
                    self._failure(name + ':INCOMPLETE')
            if self._binding['edge'] == 'electron':
                _need(self._discovery != 'OPEN' and self._archive_close == 'CLOSED', 'DISCOVERY_UNCLOSED')
                _need(_equal(_read_index(index_bytes), self._index()), 'INDEX_READBACK')
                _need(len(archive_bytes) == self._archive_size and
                      hashlib.sha256(archive_bytes).hexdigest() == self._archive_hash.hexdigest(),
                      'ARCHIVE_READBACK')
                _frames(archive_bytes, self._observations, streams['stderr'])
            else:
                _need(archive_bytes == b'' and index_bytes == b'', 'UNEXPECTED_ARCHIVE')
            budget = self._budget.view()
            if not self._budget._settled(self._reservations) or budget['refused'] or budget['uncertain']:
                self._failure('BUDGET_INCOMPLETE')
            self._state = 'SEALED_ADVERSE' if self._failures else 'SEALED_COMPLETE'
            return self.view()
        except BaseException as error:
            self._failure('SEAL_REFUSED', error)
            self._state = 'SEALED_ADVERSE'
            raise

    def view(self):
        return dict(state=self._state, binding=_copy(self._binding),
                    failures=list(self._failures), pending=len(self._pending),
                    unacknowledgedExports=len(self._exports),
                    channels={name:dict(observed=r['observed'], committed=len(r['committed']),
                                        physicalKnown=len(r['physical']), unknown=r['unknown'],
                                        pendingKnown=sum(len(t._fields['bytes']) for t in self._pending
                                                         if t._channel == name and t._kind == 'APPEND'),
                                        uncommittedOrDiscarded=r['observed'] - len(r['committed']) -
                                            sum(len(t._fields['bytes']) for t in self._pending
                                                if t._channel == name and t._kind == 'APPEND'),
                                        generation=r['generation'], reader=r['reader'],
                                        termination=r['termination'], cancel=r['cancel'],
                                        sink=r['sink'], overflow=r['overflow'])
                              for name,r in self._channels.items()},
                    observations=_copy(self._observations), budget=self._budget.view(),
                    physicalCapture=False, nativeEligibility=False, wholeAttempt=False)
